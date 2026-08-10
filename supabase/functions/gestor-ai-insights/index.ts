import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildCorsHeaders, corsHeaders } from "../_shared/cors.ts";

// Portal do Gestor 2.0 — A5: insights por IA sob demanda.
//
// Duas RPCs de leitura (get_gestor_diagnostico / get_gestor_visao_geral / get_gestor_aluno)
// já existem e já implementam toda a autorização (papel + gestor_pode_acessar_ies). Esta
// function NUNCA usa service_role para ler dado de aluno/IES: cria um client Supabase com
// a anon key, repassando o header Authorization do request original, para que as chamadas
// RPC corram como o usuário autenticado e herdem essa autorização. Só é usado um client
// "admin" (service role) para validar o JWT via auth.getUser — igual ao ai-study-recommendation.

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";

const ANTI_INVENCAO =
  "Use apenas os números fornecidos abaixo, nunca invente ou estime valores que não estão no contexto. Responda em português do Brasil, tom profissional para um gestor de instituição de ensino.";

const SYSTEM_PROMPT_PEDAGOGICO = `Você é um assistente de análise pedagógica para gestores de instituições de ensino médico que usam a plataforma SanarFlix para preparar alunos para o ENAMED e a residência médica. Com base nos dados de desempenho institucional fornecidos pelo usuário, gere um insight pedagógico curto (no máximo 4 frases), destacando pontos fortes, pontos fracos e tendências relevantes. ${ANTI_INVENCAO}`;

const SYSTEM_PROMPT_ALUNO = `Você é um assistente de análise pedagógica para gestores de instituições de ensino médico que usam a plataforma SanarFlix. Com base na trajetória de simulados de um aluno fornecida pelo usuário, gere um insight curto (no máximo 4 frases) sobre esse aluno, destacando pontos fortes, pontos fracos e a evolução (melhora, piora ou estabilidade) ao longo dos simulados. ${ANTI_INVENCAO}`;

interface PedagogicoBody {
  modo: "pedagogico";
  iesId: string;
  semestre: string | null;
}

interface ConsultorBody {
  modo: "consultor";
  iesId: string;
  semestre: string | null;
  simulados: string[];
}

interface AlunoBody {
  modo: "aluno";
  iesId: string;
  alunoId: string;
  simulados: string[];
}

type RequestBody = PedagogicoBody | ConsultorBody | AlunoBody;

// Consultoria estratégica do recorte de simulados (Detalhamento). Saída ESTRUTURADA
// (JSON) para render em dashboard: uma leitura curta + até 3 movimentos priorizados.
const SYSTEM_PROMPT_CONSULTOR = `Você é um consultor sênior especialista em aprovação no ENAMED, com histórico de levar faculdades de medicina às melhores notas do exame. Fala com o gestor da instituição de forma direta, estratégica e acionável, como quem já virou o resultado de várias escolas.

Responda SOMENTE com JSON válido, sem markdown, no formato:
{"leitura":"uma frase de no máximo 200 caracteres com o diagnóstico central do recorte","itens":[{"titulo":"até 40 caracteres","metrica":"número curto vindo dos dados, ex: 62% ou 3,4 ou -5 p.p.","texto":"até 160 caracteres: o que fazer e por que isso move a nota no ENAMED","prioridade":"alta|media|baixa"}]}

Regras: no máximo 3 itens, ordenados pelo maior impacto na nota do ENAMED. Sem saudação, sem linguagem dirigida ao aluno, sem citar nome de aluno. Cada item precisa de um número que exista no contexto. ${ANTI_INVENCAO}`;

function buildConsultorPrompt(detalhamento: any): string {
  const d = detalhamento?.data ?? detalhamento ?? {};
  const m = d.metricas ?? {};
  const areas: any[] = Array.isArray(d.acertoPorAreaESemestre?.areas)
    ? d.acertoPorAreaESemestre.areas
    : Array.isArray(d.acertoPorAreaESemestre?.porArea)
      ? d.acertoPorAreaESemestre.porArea
      : [];
  const semestres: any[] = Array.isArray(d.acertoPorAreaESemestre?.semestres) ? d.acertoPorAreaESemestre.semestres : [];
  const alunos: any[] = Array.isArray(d.alunos) ? d.alunos : [];

  const areasTxt = areas.length
    ? areas.map((a: any) => `- ${a.nome ?? a.area}: ${formatNumber(a.acertoPct)}% de acerto`).join("\n")
    : "Sem dado por grande área neste recorte.";
  const semestresTxt = semestres.length
    ? semestres.map((s: any) => `- ${s.semestre}º semestre: ${formatNumber(s.acertoPct)}% de acerto`).join("\n")
    : "Sem dado por semestre neste recorte.";

  const comProf = alunos.filter((a: any) => a.proficiencia !== null && a.proficiencia !== undefined);
  const proficientes = comProf.filter((a: any) => Number(a.proficiencia) > 60).length;

  return [
    `Recorte: ${formatNumber(d.meta?.periodo ?? detalhamento?.meta?.periodo)}.`,
    `Indicadores do recorte: ${JSON.stringify(m)}.`,
    `Acerto por grande área:\n${areasTxt}`,
    `Acerto por semestre:\n${semestresTxt}`,
    `Alunos com resultado: ${comProf.length}; acima de 60 de proficiência: ${proficientes}.`,
    "Gere o JSON da consultoria usando apenas esses números.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface RpcErrorLike {
  code?: string;
  message?: string;
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// As RPCs `get_gestor_*` fazem RAISE EXCEPTION para negar acesso (papel sem permissão,
// gestor_pode_acessar_ies=false, IES/aluno não resolvido) ou para input inválido
// (ex.: semestre_invalido, ERRCODE 22023). 42501 é sempre falta de permissão sobre a
// linha (aluno_nao_encontrado). O texto "Access denied"/"Permission denied" cobre os
// RAISE EXCEPTION sem ERRCODE explícito (ficam com o SQLSTATE genérico P0001).
function statusForRpcError(error: RpcErrorLike): number {
  const message = error.message || "";
  if (error.code === "42501") return 403;
  if (/permission denied|access denied/i.test(message)) return 403;
  return 400;
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return "sem dado";
  return String(value);
}

function buildPedagogicoPrompt(diagnostico: any, visaoGeral: any): string {
  const areas: any[] = Array.isArray(diagnostico?.data) ? diagnostico.data : [];
  const areasTxt = areas.length
    ? areas
        .map(
          (a: any) =>
            `- ${a.nome}: ${formatNumber(a.acertoPct)}% de acerto (${a.desempenho ?? "sem classificação"}, amostra de ${formatNumber(a.amostra)} aluno(s)${a.lowSample ? ", amostra baixa" : ""})`
        )
        .join("\n")
    : "Nenhuma grande área com dado suficiente neste recorte.";

  const kpis = visaoGeral?.data?.kpis ?? {};
  const enamed = kpis.enamedProjetado ?? {};
  const proficientes = kpis.proficientesPct ?? {};
  const acerto = kpis.acertoPct ?? {};
  const simulados = kpis.simulados ?? {};

  const distribuicao: any[] = Array.isArray(visaoGeral?.data?.distribuicaoAlunos) ? visaoGeral.data.distribuicaoAlunos : [];
  const distribuicaoTxt = distribuicao.length
    ? distribuicao.map((g: any) => `- ${g.grupo}: ${formatNumber(g.quantidade)} aluno(s) (${formatNumber(g.percentual)}%)`).join("\n")
    : "Sem dados de distribuição por grupo de evolução.";

  const periodo = visaoGeral?.meta?.periodo ?? diagnostico?.meta?.periodo ?? "período não informado";
  const avisos: string[] = [];
  if (visaoGeral?.meta?.lowSample || diagnostico?.meta?.lowSample) {
    avisos.push("Atenção: a amostra de alunos com resultado neste recorte é baixa (menos de 10).");
  }
  if (visaoGeral?.meta?.partial || diagnostico?.meta?.partial) {
    avisos.push("Atenção: parte dos dados está incompleta para este recorte (partial=true).");
  }

  return [
    `Período analisado: ${periodo}.`,
    `Conceito ENAMED projetado atual: ${formatNumber(enamed.valor)} (variação de ${formatNumber(enamed.delta)} em relação ao ponto anterior da régua).`,
    `Percentual de alunos proficientes: ${formatNumber(proficientes.valor)}% (variação de ${formatNumber(proficientes.delta)} pontos).`,
    `Percentual de acerto geral: ${formatNumber(acerto.valor)}% (variação de ${formatNumber(acerto.delta)} pontos).`,
    `Simulados realizados: ${formatNumber(simulados.realizados)} de ${formatNumber(simulados.contratados)} contratados.`,
    `Desempenho por grande área, do pior para o melhor:\n${areasTxt}`,
    `Distribuição dos alunos por grupo de evolução na proficiência:\n${distribuicaoTxt}`,
    avisos.join(" "),
    "Gere o insight pedagógico com base apenas nesses números.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildAlunoPrompt(aluno: any): string {
  const linhas: any[] = Array.isArray(aluno?.data) ? aluno.data : [];
  const nome = linhas[0]?.nome ?? "aluno";
  const semestre = linhas[0]?.semestre ?? "não informado";

  const trajetoriaTxt = linhas.length
    ? linhas
        .map((l: any) => {
          if (!l.participou) return `- ${l.simuladoNome}: não participou deste simulado.`;
          const prof = l.proficiencia !== null && l.proficiencia !== undefined ? `${l.proficiencia}` : "aguardando resultado";
          const variacao =
            l.variacao !== null && l.variacao !== undefined ? ` (variação de ${l.variacao} em relação ao simulado anterior)` : "";
          const posicao = l.posicao
            ? `, posição ${l.posicao.lugar} de ${l.posicao.total} (percentil ${l.posicao.percentil})`
            : "";
          return `- ${l.simuladoNome}: proficiência ${prof}, situação "${l.situacao}"${variacao}${posicao}.`;
        })
        .join("\n")
    : "Sem simulados no recorte selecionado.";

  const ultimoComParticipacao = [...linhas].reverse().find((l: any) => l.participou && Array.isArray(l.acertoPorArea) && l.acertoPorArea.length);
  const areasTxt = ultimoComParticipacao
    ? ultimoComParticipacao.acertoPorArea
        .map((a: any) => `- ${a.area}: ${formatNumber(a.acertoPct)}% de acerto no simulado "${ultimoComParticipacao.simuladoNome}"${a.critica ? " (área crítica na IES)" : ""}.`)
        .join("\n")
    : "Sem dado de desempenho por grande área no simulado mais recente que ele participou.";

  const avisos: string[] = [];
  if (aluno?.meta?.lowSample) avisos.push("Atenção: a comparação de posição/percentil usa uma amostra baixa (menos de 10 alunos).");
  if (aluno?.meta?.partial) avisos.push("Atenção: parte dos dados está incompleta (partial=true) — há simulados aguardando processamento de resultado.");

  return [
    `Aluno: ${nome} (semestre ${semestre}).`,
    `Período analisado: ${aluno?.meta?.periodo ?? "não informado"}.`,
    `Trajetória nos simulados selecionados, do mais antigo para o mais recente:\n${trajetoriaTxt}`,
    `Desempenho por grande área no simulado mais recente em que participou:\n${areasTxt}`,
    avisos.join(" "),
    "Gere o insight sobre esse aluno com base apenas nesses números.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function generateInsight(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  cors: Record<string, string>
): Promise<Response> {
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) return jsonResponse({ error: "Rate limit exceeded" }, 429, cors);
    if (response.status === 402) return jsonResponse({ error: "Payment required" }, 402, cors);
    const t = await response.text();
    console.error("[gestor-ai-insights]", "AI gateway error:", response.status, t);
    return jsonResponse({ error: "AI error" }, 500, cors);
  }

  const data = await response.json();
  const insight = data.choices?.[0]?.message?.content?.trim() || "";
  return jsonResponse({ insight }, 200, cors);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin) || corsHeaders;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI not configured" }, 500, cors);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client admin: só para validar o JWT (auth.getUser). Nunca usado pra ler dado de
    // aluno/IES — ver cabeçalho do arquivo.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, cors);
    }

    // Client escopado ao JWT de quem chamou: as RPCs abaixo correm como o usuário
    // autenticado e herdam gestor_pode_acessar_ies, exatamente como o front já faz.
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400, cors);
    }

    if (body?.modo === "pedagogico") {
      const { iesId, semestre } = body;
      if (!iesId) {
        return jsonResponse({ error: "iesId_obrigatorio" }, 400, cors);
      }

      const [diagnosticoRes, visaoGeralRes] = await Promise.all([
        supabaseUser.rpc("get_gestor_diagnostico", { p_ies_id: iesId, p_semestre: semestre ?? null, p_node: null }),
        supabaseUser.rpc("get_gestor_visao_geral", { p_ies_id: iesId, p_semestre: semestre ?? null }),
      ]);

      if (diagnosticoRes.error) {
        console.error("[gestor-ai-insights]", "get_gestor_diagnostico error:", diagnosticoRes.error);
        return jsonResponse({ error: diagnosticoRes.error.message }, statusForRpcError(diagnosticoRes.error), cors);
      }
      if (visaoGeralRes.error) {
        console.error("[gestor-ai-insights]", "get_gestor_visao_geral error:", visaoGeralRes.error);
        return jsonResponse({ error: visaoGeralRes.error.message }, statusForRpcError(visaoGeralRes.error), cors);
      }

      const userPrompt = buildPedagogicoPrompt(diagnosticoRes.data, visaoGeralRes.data);
      return await generateInsight(SYSTEM_PROMPT_PEDAGOGICO, userPrompt, LOVABLE_API_KEY, cors);
    }

    if (body?.modo === "consultor") {
      const { iesId, semestre, simulados } = body;
      if (!iesId) {
        return jsonResponse({ error: "iesId_obrigatorio" }, 400, cors);
      }

      const detalhamentoRes = await supabaseUser.rpc("get_gestor_detalhamento", {
        p_ies_id: iesId,
        p_semestre: semestre ?? null,
        p_simulados: Array.isArray(simulados) && simulados.length ? simulados : null,
      });

      if (detalhamentoRes.error) {
        console.error("[gestor-ai-insights]", "get_gestor_detalhamento error:", detalhamentoRes.error);
        return jsonResponse({ error: detalhamentoRes.error.message }, statusForRpcError(detalhamentoRes.error), cors);
      }

      const userPrompt = buildConsultorPrompt(detalhamentoRes.data);
      return await generateInsight(SYSTEM_PROMPT_CONSULTOR, userPrompt, LOVABLE_API_KEY, cors);
    }

    if (body?.modo === "aluno") {
      const { iesId, alunoId, simulados } = body;
      if (!iesId || !alunoId) {
        return jsonResponse({ error: "ies_e_aluno_obrigatorios" }, 400, cors);
      }

      const alunoRes = await supabaseUser.rpc("get_gestor_aluno", {
        p_ies_id: iesId,
        p_aluno_id: alunoId,
        p_simulados: Array.isArray(simulados) ? simulados : null,
      });

      if (alunoRes.error) {
        console.error("[gestor-ai-insights]", "get_gestor_aluno error:", alunoRes.error);
        return jsonResponse({ error: alunoRes.error.message }, statusForRpcError(alunoRes.error), cors);
      }

      const userPrompt = buildAlunoPrompt(alunoRes.data);
      return await generateInsight(SYSTEM_PROMPT_ALUNO, userPrompt, LOVABLE_API_KEY, cors);
    }

    return jsonResponse({ error: "modo_invalido" }, 400, cors);
  } catch (e) {
    console.error("[gestor-ai-insights]", "error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500, cors);
  }
});
