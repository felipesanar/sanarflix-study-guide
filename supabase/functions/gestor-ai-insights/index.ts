import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildCorsHeaders, corsHeaders } from "../_shared/cors.ts";
import {
  AI_MODEL_RACIOCINIO,
  AI_MODEL_RAPIDO,
  AiGatewayError,
  extrairJson,
  gravarCache,
  hashChave,
  lerCache,
  streamChatCompletion,
  TTL,
  type ToolSchema,
} from "../_shared/ai.ts";
import { ANTI_INVENCAO, BASE_ENAMED, DOUTRINA_CONSULTOR } from "../_shared/enamed.ts";

// Portal do Gestor — insights por IA.
//
// Esta function NUNCA usa service_role para ler dado de aluno/IES: cria um
// client Supabase com a anon key, repassando o header Authorization do request
// original, para que as RPCs corram como o usuário autenticado e herdem
// has_role + gestor_pode_acessar_ies. O client "admin" (service role) só é
// usado para validar o JWT e para ler/gravar o cache de IA.
//
// Streaming: todas as chamadas ao gateway usam `stream: true` (ver _shared/ai.ts)
// para não morrer no corte de ~2 min do host. O stream é consumido aqui e o
// front recebe um JSON único.
//
// Cache: respostas ficam em public.ai_response_cache com chave = modo + recorte,
// então o segundo gestor da mesma IES (ou o F5, ou outra aba) não gasta crédito.

const ANTI_INVENCAO_GESTOR = `${ANTI_INVENCAO} Tom profissional, para um gestor de curso de medicina.`;

const SYSTEM_PROMPT_PEDAGOGICO = `Você é analista pedagógico sênior de cursos de medicina, especialista em desempenho no ENAMED.

${BASE_ENAMED}

Com base nos dados institucionais fornecidos, gere um insight pedagógico curto (no máximo 4 frases) que diga: onde a instituição está, o que explica isso e o que olhar primeiro. Cada afirmação precisa se apoiar em um número do contexto. ${ANTI_INVENCAO_GESTOR}`;

const SYSTEM_PROMPT_ALUNO = `Você é analista pedagógico sênior de cursos de medicina, especialista em desempenho no ENAMED, falando com o gestor sobre UM aluno.

${BASE_ENAMED}

Com base na trajetória de simulados e no desempenho por área do aluno, gere um insight curto (no máximo 4 frases): tendência (melhora, piora ou estabilidade), distância em relação à faixa de proficiência, área que mais pesa contra ele e qual intervenção tem maior retorno. ${ANTI_INVENCAO_GESTOR}`;

const BASE_CONSULTOR = `Você é consultor sênior de desempenho no ENAMED, com histórico de levar cursos de medicina às melhores notas do exame. Fala com o gestor da instituição: direto, estratégico, acionável.

${BASE_ENAMED}

${DOUTRINA_CONSULTOR}

Entregue, via a tool leitura_estrategica: uma leitura central curta e no máximo 3 movimentos priorizados. Cada movimento precisa de um número que exista no contexto e precisa dizer o que fazer, não apenas o que está ruim. Ordene do maior para o menor impacto na proficiência da instituição. Sem saudação, sem linguagem dirigida ao aluno, sem citar nome de aluno. ${ANTI_INVENCAO_GESTOR}`;

/**
 * Recorte de simulados (tela Detalhamento): a leitura é APLICADA aos simulados
 * que o gestor selecionou. Fala do que aquela(s) aplicação(ões) revelou.
 */
const SYSTEM_PROMPT_CONSULTOR_RECORTE = `${BASE_CONSULTOR}

Escopo desta leitura: os SIMULADOS SELECIONADOS pelo gestor, nada além disso. Trate cada movimento como resposta ao que essa(s) aplicação(ões) revelou: questão/área com pior acerto, diferença entre semestres dentro do recorte, quem ficou logo abaixo do corte nesse resultado. Quando houver mais de um simulado, compare-os explicitamente (o que melhorou, o que piorou) e nunca dissolva os simulados numa média única. Fale no tempo do resultado ("neste simulado", "entre os dois simulados"), não em tendência de ano.`;

/**
 * Visão Geral: leitura institucional, sem recorte de simulado. Responde a
 * pergunta da página — "como estamos e onde dói" — na escala do curso.
 */
const SYSTEM_PROMPT_CONSULTOR_INSTITUCIONAL = `${BASE_CONSULTOR}

Escopo desta leitura: a INSTITUIÇÃO como um todo no período, não um simulado específico. Trate os movimentos na escala do curso: trajetória do conceito ENAMED projetado e da proporção de alunos que cruza a faixa, áreas cronicamente frágeis no diagnóstico curricular, semestres que puxam o resultado para baixo e cobertura de aplicação de simulados. Não recomende ação sobre questão isolada — o nível aqui é currículo, calendário e política de preparação. Se houver evolução entre aplicações, leia a direção do movimento, não o número de uma prova só.`;


// Saída ESTRUTURADA garantida por schema (não por instrução no prompt).
const TOOL_LEITURA: ToolSchema = {
  type: "function",
  function: {
    name: "leitura_estrategica",
    description: "Devolve a leitura estratégica do recorte e os movimentos priorizados.",
    parameters: {
      type: "object",
      properties: {
        leitura: {
          type: "string",
          description: "Diagnóstico central do recorte, no máximo 220 caracteres.",
        },
        itens: {
          type: "array",
          description: "No máximo 3 movimentos, do maior para o menor impacto.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Até 44 caracteres, o movimento em si." },
              metrica: { type: "string", description: "Número curto vindo do contexto, ex: 61% ou -5 p.p." },
              texto: { type: "string", description: "Até 180 caracteres: o que fazer e por que move a nota." },
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
              natureza: {
                type: "string",
                enum: ["cobertura", "calendario", "engajamento", "manejo_de_prova"],
                description: "Tipo do problema que este movimento resolve.",
              },
            },
            required: ["titulo", "metrica", "texto", "prioridade", "natureza"],
          },
        },
      },
      required: ["leitura", "itens"],
    },
  },
};

interface PedagogicoBody {
  modo: "pedagogico";
  iesId: string;
  semestre: string | null;
  refresh?: boolean;
}

interface ConsultorBody {
  modo: "consultor";
  iesId: string;
  semestre: string | null;
  simulados?: string[];
  /**
   * `recorte` (padrão) = Detalhamento: leitura aplicada aos simulados escolhidos.
   * `institucional` = Visão Geral: leitura na escala do curso, sem simulado.
   */
  escopo?: "recorte" | "institucional";
  refresh?: boolean;
}


interface AlunoBody {
  modo: "aluno";
  iesId: string;
  alunoId: string;
  simulados: string[];
  refresh?: boolean;
}

type RequestBody = PedagogicoBody | ConsultorBody | AlunoBody;

interface RpcErrorLike {
  code?: string;
  message?: string;
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// As RPCs `get_gestor_*` fazem RAISE EXCEPTION para negar acesso ou para input
// inválido. 42501 é sempre falta de permissão sobre a linha.
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

// ---------------------------------------------------------------------------
// Modo consultor — contexto cruzado
// ---------------------------------------------------------------------------

function linhasAreas(detalhamento: any): string {
  const d = detalhamento?.data ?? detalhamento ?? {};
  const bloco = d.acertoPorAreaESemestre ?? {};
  const areas: any[] = Array.isArray(bloco.areas) ? bloco.areas : Array.isArray(bloco.porArea) ? bloco.porArea : [];
  if (!areas.length) return "Sem dado por grande área neste recorte.";
  return areas.map((a: any) => `- ${a.nome ?? a.area}: ${formatNumber(a.acertoPct)}% de acerto`).join("\n");
}

function linhasSemestres(detalhamento: any): string {
  const d = detalhamento?.data ?? detalhamento ?? {};
  const semestres: any[] = Array.isArray(d.acertoPorAreaESemestre?.semestres) ? d.acertoPorAreaESemestre.semestres : [];
  if (!semestres.length) return "Sem dado por semestre neste recorte.";
  return semestres
    .map((s: any) => `- ${s.semestre}º semestre: ${formatNumber(s.acertoPct)}% de acerto`)
    .join("\n");
}

function linhasDiagnostico(diagnostico: any): string {
  const areas: any[] = Array.isArray(diagnostico?.data) ? diagnostico.data : [];
  if (!areas.length) return "Sem diagnóstico curricular com amostra suficiente.";
  return areas
    .map(
      (a: any) =>
        `- ${a.nome}: ${formatNumber(a.acertoPct)}% (${a.desempenho ?? "sem classificação"}, ${formatNumber(a.amostra)} aluno(s)${a.lowSample ? ", amostra baixa" : ""})`
    )
    .join("\n");
}

function linhasVisaoGeral(visaoGeral: any): string {
  const kpis = visaoGeral?.data?.kpis ?? {};
  const enamed = kpis.enamedProjetado ?? {};
  const prof = kpis.proficientesPct ?? {};
  const acerto = kpis.acertoPct ?? {};
  const simulados = kpis.simulados ?? {};
  const distribuicao: any[] = Array.isArray(visaoGeral?.data?.distribuicaoAlunos)
    ? visaoGeral.data.distribuicaoAlunos
    : [];
  const distribuicaoTxt = distribuicao.length
    ? distribuicao
        .map((g: any) => `  - ${g.grupo}: ${formatNumber(g.quantidade)} aluno(s) (${formatNumber(g.percentual)}%)`)
        .join("\n")
    : "  - sem dado de distribuição.";

  return [
    `- Conceito ENAMED projetado: ${formatNumber(enamed.valor)} (variação ${formatNumber(enamed.delta)}).`,
    `- Alunos que cruzam a faixa de proficiência: ${formatNumber(prof.valor)}% (variação ${formatNumber(prof.delta)} p.p.).`,
    `- Acerto geral: ${formatNumber(acerto.valor)}% (variação ${formatNumber(acerto.delta)} p.p.).`,
    `- Simulados aplicados: ${formatNumber(simulados.realizados)} de ${formatNumber(simulados.contratados)} contratados.`,
    `- Distribuição dos alunos por evolução:\n${distribuicaoTxt}`,
  ].join("\n");
}

function linhasQuestoes(questoes: any): string {
  const linhas: any[] = Array.isArray(questoes?.data?.items)
    ? questoes.data.items
    : Array.isArray(questoes?.data)
      ? questoes.data
      : [];
  if (!linhas.length) return "Sem detalhamento de questões neste recorte.";
  return linhas
    .slice(0, 10)
    .map(
      (q: any) =>
        `- questão ${formatNumber(q.numero ?? q.numeroQuestao ?? q.ordem)} (${q.grandeArea ?? q.area ?? "área não informada"}${q.tema ? ` / ${q.tema}` : ""}): ${formatNumber(q.acertoPct)}% de acerto`
    )
    .join("\n");
}

function linhasAlunos(detalhamento: any): string {
  const d = detalhamento?.data ?? detalhamento ?? {};
  const alunos: any[] = Array.isArray(d.alunos) ? d.alunos : [];
  const comProf = alunos.filter((a: any) => a.proficiencia !== null && a.proficiencia !== undefined);
  if (!comProf.length) return "Sem alunos com proficiência calculada neste recorte.";
  const valores = comProf.map((a: any) => Number(a.proficiencia)).filter((n) => Number.isFinite(n));
  const acima = valores.filter((n) => n >= 60).length;
  const naBorda = valores.filter((n) => n >= 50 && n < 60).length;
  const muitoAbaixo = valores.filter((n) => n < 50).length;
  return [
    `- Alunos com resultado: ${comProf.length}.`,
    `- Acima da faixa (>= 60): ${acima}.`,
    `- Na borda do corte (50 a 59,9) — maior ganho por hora investida: ${naBorda}.`,
    `- Bem abaixo (< 50) — precisam de recuperação de base: ${muitoAbaixo}.`,
  ].join("\n");
}

function buildConsultorPrompt(
  detalhamento: any,
  visaoGeral: any,
  diagnostico: any,
  questoes: any
): string {
  const d = detalhamento?.data ?? detalhamento ?? {};
  const periodo = d.meta?.periodo ?? detalhamento?.meta?.periodo ?? "período não informado";

  return [
    `Recorte analisado: ${periodo}.`,
    `Indicadores institucionais:\n${linhasVisaoGeral(visaoGeral)}`,
    `Indicadores do recorte de simulados: ${JSON.stringify(d.metricas ?? {})}.`,
    `Acerto por grande área no recorte:\n${linhasAreas(detalhamento)}`,
    `Acerto por semestre no recorte:\n${linhasSemestres(detalhamento)}`,
    `Diagnóstico curricular por grande área (classificação e amostra):\n${linhasDiagnostico(diagnostico)}`,
    `Questões com pior acerto no simulado mais recente do recorte:\n${linhasQuestoes(questoes)}`,
    `Posição dos alunos em relação à faixa de proficiência:\n${linhasAlunos(detalhamento)}`,
    "Gere a leitura estratégica usando a tool leitura_estrategica e apenas esses números.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildPedagogicoPrompt(diagnostico: any, visaoGeral: any): string {
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
    `Indicadores institucionais:\n${linhasVisaoGeral(visaoGeral)}`,
    `Desempenho por grande área, do pior para o melhor:\n${linhasDiagnostico(diagnostico)}`,
    avisos.join(" "),
    "Gere o insight pedagógico com base apenas nesses números.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildAlunoPrompt(aluno: any, porArea: any): string {
  const linhas: any[] = Array.isArray(aluno?.data) ? aluno.data : [];
  const nome = linhas[0]?.nome ?? "aluno";
  const semestre = linhas[0]?.semestre ?? "não informado";

  const trajetoriaTxt = linhas.length
    ? linhas
        .map((l: any) => {
          if (!l.participou) return `- ${l.simuladoNome}: não participou deste simulado.`;
          const prof =
            l.proficiencia !== null && l.proficiencia !== undefined ? `${l.proficiencia}` : "aguardando resultado";
          const variacao =
            l.variacao !== null && l.variacao !== undefined ? ` (variação de ${l.variacao} em relação ao anterior)` : "";
          const posicao = l.posicao
            ? `, posição ${l.posicao.lugar} de ${l.posicao.total} (percentil ${l.posicao.percentil})`
            : "";
          return `- ${l.simuladoNome}: proficiência ${prof}, situação "${l.situacao}"${variacao}${posicao}.`;
        })
        .join("\n")
    : "Sem simulados no recorte selecionado.";

  const areasHistorico: any[] = Array.isArray(porArea?.data) ? porArea.data : [];
  const areasHistoricoTxt = areasHistorico.length
    ? areasHistorico
        .map(
          (a: any) =>
            `- ${a.area ?? a.nome}: ${formatNumber(a.acertoPct)}% de acerto acumulado${a.critica ? " (área crítica na IES)" : ""}${a.total ? `, ${a.total} questões` : ""}.`
        )
        .join("\n")
    : "Sem histórico consolidado por grande área.";

  const ultimo = [...linhas]
    .reverse()
    .find((l: any) => l.participou && Array.isArray(l.acertoPorArea) && l.acertoPorArea.length);
  const ultimoTxt = ultimo
    ? ultimo.acertoPorArea
        .map(
          (a: any) =>
            `- ${a.area}: ${formatNumber(a.acertoPct)}% no simulado "${ultimo.simuladoNome}"${a.critica ? " (área crítica na IES)" : ""}.`
        )
        .join("\n")
    : "Sem dado por grande área no simulado mais recente.";

  const avisos: string[] = [];
  if (aluno?.meta?.lowSample) avisos.push("Atenção: posição/percentil usam amostra baixa (menos de 10 alunos).");
  if (aluno?.meta?.partial) avisos.push("Atenção: há simulados aguardando processamento de resultado (partial=true).");

  return [
    `Aluno: ${nome} (semestre ${semestre}).`,
    `Período analisado: ${aluno?.meta?.periodo ?? "não informado"}.`,
    `Trajetória nos simulados, do mais antigo para o mais recente:\n${trajetoriaTxt}`,
    `Desempenho acumulado por grande área:\n${areasHistoricoTxt}`,
    `Desempenho por grande área no simulado mais recente em que participou:\n${ultimoTxt}`,
    avisos.join(" "),
    "Gere o insight sobre esse aluno com base apenas nesses números.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function respostaDeErroDeGateway(e: unknown, cors: Record<string, string>): Response {
  if (e instanceof AiGatewayError) {
    if (e.status === 429) return jsonResponse({ error: "Rate limit exceeded" }, 429, cors);
    if (e.status === 402) return jsonResponse({ error: "Payment required" }, 402, cors);
    console.error("[gestor-ai-insights]", "AI gateway error:", e.status, e.message);
    return jsonResponse({ error: "AI error" }, 500, cors);
  }
  if (e instanceof Error && e.name === "AbortError") {
    return new Response(null, { status: 499, headers: cors });
  }
  console.error("[gestor-ai-insights]", "error:", e);
  return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500, cors);
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, cors);
    }

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

    const refresh = Boolean((body as { refresh?: boolean })?.refresh);

    // -------------------------------------------------------------------
    if (body?.modo === "pedagogico") {
      const { iesId, semestre } = body;
      if (!iesId) return jsonResponse({ error: "iesId_obrigatorio" }, 400, cors);

      const cacheKey = await hashChave(["gestor-ai-insights", "pedagogico", iesId, semestre ?? null]);
      if (!refresh) {
        const cached = await lerCache(supabaseAdmin, cacheKey);
        if (cached) return jsonResponse({ ...cached, cached: true }, 200, cors);
      }

      const [diagnosticoRes, visaoGeralRes] = await Promise.all([
        supabaseUser.rpc("get_gestor_diagnostico", { p_ies_id: iesId, p_semestre: semestre ?? null, p_node: null }),
        supabaseUser.rpc("get_gestor_visao_geral", { p_ies_id: iesId, p_semestre: semestre ?? null }),
      ]);

      if (diagnosticoRes.error) {
        return jsonResponse({ error: diagnosticoRes.error.message }, statusForRpcError(diagnosticoRes.error), cors);
      }
      if (visaoGeralRes.error) {
        return jsonResponse({ error: visaoGeralRes.error.message }, statusForRpcError(visaoGeralRes.error), cors);
      }

      const { texto } = await streamChatCompletion({
        apiKey: LOVABLE_API_KEY,
        model: AI_MODEL_RAPIDO,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_PEDAGOGICO },
          { role: "user", content: buildPedagogicoPrompt(diagnosticoRes.data, visaoGeralRes.data) },
        ],
        maxTokens: 500,
        temperature: 0.4,
        signal: req.signal,
      });

      const payload = { insight: texto };
      await gravarCache(supabaseAdmin, {
        cacheKey,
        fn: "gestor-ai-insights",
        modo: "pedagogico",
        payload,
        model: AI_MODEL_RAPIDO,
        ttlSegundos: TTL.gestorRecorte,
      });
      return jsonResponse({ ...payload, cached: false }, 200, cors);
    }

    // -------------------------------------------------------------------
    if (body?.modo === "consultor") {
      const { iesId, semestre, simulados } = body;
      const escopo = body.escopo === "institucional" ? "institucional" : "recorte";
      if (!iesId) return jsonResponse({ error: "iesId_obrigatorio" }, 400, cors);

      const listaSimulados =
        escopo === "institucional" ? null : Array.isArray(simulados) && simulados.length ? [...simulados] : null;
      const cacheKey = await hashChave([
        "gestor-ai-insights",
        "consultor",
        escopo,
        iesId,
        semestre ?? null,
        listaSimulados ? [...listaSimulados].sort() : null,
      ]);
      if (!refresh) {
        const cached = await lerCache(supabaseAdmin, cacheKey);
        if (cached) return jsonResponse({ ...cached, cached: true }, 200, cors);
      }

      // Visão Geral não tem recorte de simulado: a leitura é institucional, então
      // nem `get_gestor_detalhamento` nem o mapa de questões entram no contexto —
      // recomendar ação sobre questão isolada seria fora do nível da tela.
      const institucional = escopo === "institucional";
      const simuladoFoco = listaSimulados ? listaSimulados[listaSimulados.length - 1] : null;

      const [detalhamentoRes, visaoGeralRes, diagnosticoRes, questoesRes] = await Promise.all([
        institucional
          ? Promise.resolve({ data: null, error: null })
          : supabaseUser.rpc("get_gestor_detalhamento", {
              p_ies_id: iesId,
              p_semestre: semestre ?? null,
              p_simulados: listaSimulados,
            }),
        supabaseUser.rpc("get_gestor_visao_geral", { p_ies_id: iesId, p_semestre: semestre ?? null }),
        supabaseUser.rpc("get_gestor_diagnostico", { p_ies_id: iesId, p_semestre: semestre ?? null, p_node: null }),
        !institucional && simuladoFoco
          ? supabaseUser.rpc("get_gestor_questoes", {
              p_ies_id: iesId,
              p_simulado_id: simuladoFoco,
              p_page: 1,
              p_page_size: 10,
              p_sort: "acerto",
              p_area: null,
              p_semestre: semestre ?? null,
            })
          : Promise.resolve({ data: null, error: null }),
      ]);

      // A RPC que sustenta a leitura muda com o escopo: no recorte é o
      // detalhamento dos simulados; na Visão Geral é a visão institucional.
      const principal = institucional ? visaoGeralRes : detalhamentoRes;
      if (principal.error) {
        console.error("[gestor-ai-insights]", "rpc principal error:", principal.error);
        return jsonResponse({ error: principal.error.message }, statusForRpcError(principal.error), cors);
      }
      // Os complementos são opcionais: se um deles falhar, a leitura continua
      // com o núcleo em vez de derrubar a tela.
      if (visaoGeralRes.error) console.error("[gestor-ai-insights]", "visao_geral (opcional):", visaoGeralRes.error.message);
      if (diagnosticoRes.error) console.error("[gestor-ai-insights]", "diagnostico (opcional):", diagnosticoRes.error.message);
      if (questoesRes.error) console.error("[gestor-ai-insights]", "questoes (opcional):", questoesRes.error.message);

      const userPrompt = institucional
        ? buildInstitucionalPrompt(visaoGeralRes.data, diagnosticoRes.error ? null : diagnosticoRes.data)
        : buildConsultorPrompt(
            detalhamentoRes.data,
            visaoGeralRes.error ? null : visaoGeralRes.data,
            diagnosticoRes.error ? null : diagnosticoRes.data,
            questoesRes.error ? null : questoesRes.data
          );

      const { texto, toolArguments } = await streamChatCompletion({
        apiKey: LOVABLE_API_KEY,
        model: AI_MODEL_RACIOCINIO,
        messages: [
          {
            role: "system",
            content: institucional ? SYSTEM_PROMPT_CONSULTOR_INSTITUCIONAL : SYSTEM_PROMPT_CONSULTOR_RECORTE,
          },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 900,
        temperature: 0.4,
        tool: TOOL_LEITURA,
        signal: req.signal,
      });


      const estruturado =
        (toolArguments ? extrairJson<{ leitura?: string; itens?: unknown[] }>(toolArguments) : null) ??
        extrairJson<{ leitura?: string; itens?: unknown[] }>(texto);

      if (!estruturado || typeof estruturado.leitura !== "string") {
        console.error("[gestor-ai-insights]", "consultor sem saída estruturada");
        return jsonResponse({ error: "sem_leitura" }, 500, cors);
      }

      const payload = {
        leitura: estruturado.leitura,
        itens: Array.isArray(estruturado.itens) ? estruturado.itens.slice(0, 3) : [],
        // Compatibilidade com o parse defensivo antigo do front.
        insight: JSON.stringify({
          leitura: estruturado.leitura,
          itens: Array.isArray(estruturado.itens) ? estruturado.itens.slice(0, 3) : [],
        }),
      };

      await gravarCache(supabaseAdmin, {
        cacheKey,
        fn: "gestor-ai-insights",
        modo: "consultor",
        payload,
        model: AI_MODEL_RACIOCINIO,
        ttlSegundos: TTL.gestorRecorte,
      });
      return jsonResponse({ ...payload, cached: false }, 200, cors);
    }

    // -------------------------------------------------------------------
    if (body?.modo === "aluno") {
      const { iesId, alunoId, simulados } = body;
      if (!iesId || !alunoId) return jsonResponse({ error: "ies_e_aluno_obrigatorios" }, 400, cors);

      const listaSimulados = Array.isArray(simulados) && simulados.length ? [...simulados] : null;
      const cacheKey = await hashChave([
        "gestor-ai-insights",
        "aluno",
        iesId,
        alunoId,
        listaSimulados ? [...listaSimulados].sort() : null,
      ]);
      if (!refresh) {
        const cached = await lerCache(supabaseAdmin, cacheKey);
        if (cached) return jsonResponse({ ...cached, cached: true }, 200, cors);
      }

      const [alunoRes, porAreaRes] = await Promise.all([
        supabaseUser.rpc("get_gestor_aluno", {
          p_ies_id: iesId,
          p_aluno_id: alunoId,
          p_simulados: listaSimulados,
        }),
        supabaseUser.rpc("get_gestor_aluno_desempenho_por_area", {
          p_ies_id: iesId,
          p_aluno_id: alunoId,
          p_simulados: listaSimulados,
        }),
      ]);

      if (alunoRes.error) {
        console.error("[gestor-ai-insights]", "get_gestor_aluno error:", alunoRes.error);
        return jsonResponse({ error: alunoRes.error.message }, statusForRpcError(alunoRes.error), cors);
      }
      if (porAreaRes.error) {
        console.error("[gestor-ai-insights]", "por_area (opcional):", porAreaRes.error.message);
      }

      const { texto } = await streamChatCompletion({
        apiKey: LOVABLE_API_KEY,
        model: AI_MODEL_RAPIDO,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_ALUNO },
          { role: "user", content: buildAlunoPrompt(alunoRes.data, porAreaRes.error ? null : porAreaRes.data) },
        ],
        maxTokens: 500,
        temperature: 0.4,
        signal: req.signal,
      });

      const payload = { insight: texto };
      await gravarCache(supabaseAdmin, {
        cacheKey,
        fn: "gestor-ai-insights",
        modo: "aluno",
        payload,
        model: AI_MODEL_RAPIDO,
        ttlSegundos: TTL.gestorAluno,
      });
      return jsonResponse({ ...payload, cached: false }, 200, cors);
    }

    return jsonResponse({ error: "modo_invalido" }, 400, cors);
  } catch (e) {
    return respostaDeErroDeGateway(e, cors);
  }
});
