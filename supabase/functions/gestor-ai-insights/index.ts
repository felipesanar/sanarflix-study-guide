import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildCorsHeaders, corsHeaders } from "../_shared/cors.ts";
import {
  AI_MODEL_RAPIDO,
  AiGatewayError,
  extrairJson,
  gravarCache,
  hashChave,
  lerCache,
  repararJsonParcial,
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

const BASE_CONSULTOR = `Você é consultor sênior de desempenho no ENAMED, com histórico de levar faculdades de medicina às melhores notas do exame. Fala com o gestor da instituição: direto, estratégico, acionável.

${BASE_ENAMED}

${DOUTRINA_CONSULTOR}

Entregue, via a tool leitura_estrategica: uma leitura central curta e no máximo 3 movimentos priorizados. Cada movimento precisa de um número que exista no contexto e precisa dizer o que fazer, não apenas o que está ruim. Ordene do maior para o menor impacto na proficiência da instituição. Sem saudação, sem linguagem dirigida ao aluno, sem citar nome de aluno.

Como escrever (obrigatório):
- Fale como uma pessoa real conversando com outra: frases curtas, palavras do dia a dia, uma ideia por frase.
- Explique de forma mastigada: diga o que o número mostra e, na sequência, o que fazer com isso, como se estivesse explicando para alguém que entrou agora na conversa.
- Proibido jargão de consultoria e enfeite ("alavancar", "potencializar", "sinergia", "acionável", "otimizar", "insight", "gap", "driver", "performance"). Troque por palavra simples.
- Nada de frase-jornal com muitas vírgulas encadeadas, nada de voz passiva, nada de introdução antes do ponto. Comece pelo essencial.
- Não repita o que o gestor já vê no gráfico e não use bullet dentro dos textos.
- Se precisar usar termo técnico do exame (proficiência, TRI, faixa), explique em três ou quatro palavras na mesma frase.

Como chamar as coisas (obrigatório):
- Nunca escreva "o curso". Chame de "a faculdade", "a instituição" ou "a escola médica". Para o grupo de alunos do recorte, use "a turma" ou "os alunos".
- Respeite o recorte de semestre informado no contexto e fale de acordo com ele:
  - Todos os semestres: fale da faculdade/instituição como um todo, sem atribuir o número a um único ano.
  - 6º ano: são os alunos do 11º e 12º semestres juntos. Escreva "os alunos do 6º ano" — nunca "6º semestre".
  - Um semestre específico (ex.: 8º): diga explicitamente de quem é o número ("os alunos do 8º semestre") e não generalize para toda a faculdade.
- Nunca misture os dois: se o recorte é de um semestre (ou do 6º ano), todas as frases e movimentos falam daquele recorte.


${ANTI_INVENCAO_GESTOR}`;

/**
 * Recorte de simulados (tela Detalhamento): a leitura é APLICADA aos simulados
 * que o gestor selecionou. Fala do que aquela(s) aplicação(ões) revelou.
 */
const SYSTEM_PROMPT_CONSULTOR_RECORTE = `${BASE_CONSULTOR}

Escopo desta leitura: os SIMULADOS SELECIONADOS pelo gestor, nada além disso. Trate cada movimento como resposta ao que essa(s) aplicação(ões) revelou: questão/área com pior acerto, diferença entre semestres dentro do recorte, quem ficou logo abaixo do corte nesse resultado. Quando houver mais de um simulado, compare-os explicitamente (o que melhorou, o que piorou) e nunca dissolva os simulados numa média única. Fale no tempo do resultado ("neste simulado", "entre os dois simulados"), não em tendência de ano.`;

/**
 * Visão Geral: leitura institucional, sem recorte de simulado. Responde a
 * pergunta da página — "como estamos e onde dói" — na escala da instituição.
 */
const SYSTEM_PROMPT_CONSULTOR_INSTITUCIONAL = `${BASE_CONSULTOR}

Escopo desta leitura: a INSTITUIÇÃO como um todo no período, não um simulado específico. Trate os movimentos na escala da instituição: trajetória do conceito ENAMED projetado e da proporção de alunos que cruza a faixa, áreas cronicamente frágeis no diagnóstico curricular, semestres que puxam o resultado para baixo e cobertura de aplicação de simulados. Não recomende ação sobre questão isolada — o nível aqui é currículo, calendário e política de preparação. Se houver evolução entre aplicações, leia a direção do movimento, não o número de uma prova só.`;


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
          description: "Uma ou duas frases simples dizendo, em linguagem do dia a dia, qual é o problema principal e por que ele importa. No máximo 200 caracteres, sem jargão.",
        },
        itens: {
          type: "array",
          description: "No máximo 3 movimentos, do maior para o menor impacto.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Até 44 caracteres: a ação em palavras simples, começando por verbo (ex: 'Reforçar Pediatria no 11º')." },
              metrica: { type: "string", description: "Número curto vindo do contexto, ex: 61% ou -5 p.p." },
              texto: { type: "string", description: "Até 180 caracteres, em duas frases curtas e simples: primeiro o que o número mostra, depois o que fazer. Sem jargão de consultoria." },
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
  /** `true` = resposta em SSE (leitura aparecendo aos poucos na tela). */
  stream?: boolean;

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

/**
 * Descreve o recorte de semestre em linguagem natural para o prompt: a leitura
 * precisa dizer de quem é o número (faculdade inteira vs. um semestre).
 */
function descreverRecorteSemestre(semestre: string | null | undefined): string {
  const bruto = (semestre ?? "").toString().trim();
  const chave = bruto.toLowerCase();
  if (!bruto || chave === "todos" || chave === "geral") {
    return "Recorte de semestre: TODOS OS SEMESTRES (visão geral da faculdade). Fale da instituição como um todo e não atribua os números a um único semestre ou ano.";
  }
  // `6ano` é o recorte PADRÃO do portal e não é um semestre: são os alunos do
  // 6º ano, ou seja, 11º e 12º semestres juntos. Chamar isso de "6º semestre"
  // fala de outra população.
  if (chave === "6ano" || chave === "6º ano" || chave === "6 ano") {
    return 'Recorte de semestre: APENAS o 6º ANO (11º e 12º semestres juntos, os alunos em internato/final do curso). Todos os números abaixo são só desses alunos. Diga isso explicitamente ("os alunos do 6º ano") e NUNCA escreva "6º semestre" nem trate isso como um semestre único; não generalize para toda a faculdade.';
  }
  const n = Number(bruto.replace(/\D/g, ""));
  const rotulo = Number.isFinite(n) && n > 0 ? `${n}º semestre` : bruto;
  const ano = Number.isFinite(n) && n > 0 ? ` (equivale ao ${Math.ceil(n / 2)}º ano)` : "";
  return `Recorte de semestre: APENAS ${rotulo}${ano}. Todos os números abaixo são só desses alunos. Diga isso explicitamente ("os alunos do ${rotulo}") e não generalize para toda a faculdade.`;
}


function buildConsultorPrompt(
  detalhamento: any,
  visaoGeral: any,
  diagnostico: any,
  questoes: any,
  semestre: string | null
): string {
  const d = detalhamento?.data ?? detalhamento ?? {};
  const periodo = d.meta?.periodo ?? detalhamento?.meta?.periodo ?? "período não informado";

  return [
    `Recorte analisado: ${periodo}.`,
    descreverRecorteSemestre(semestre),
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

/** Evolução institucional (régua de aplicações) — direção do movimento, não nota de uma prova. */
function linhasEvolucao(visaoGeral: any): string {
  const pontos: any[] = Array.isArray(visaoGeral?.data?.evolucao) ? visaoGeral.data.evolucao : [];
  if (!pontos.length) return "Sem régua de evolução entre aplicações.";
  return pontos
    .map((p: any) => `- ${p.nome ?? "aplicação"}: nota ${formatNumber(p.valor)}${p.data ? ` (${p.data})` : ""}`)
    .join("\n");
}

function linhasDispersaoPorSemestre(visaoGeral: any): string {
  const pontos: any[] = Array.isArray(visaoGeral?.data?.dispersao) ? visaoGeral.data.dispersao : [];
  if (!pontos.length) return "Sem distribuição por semestre.";
  const porSemestre = new Map<number, number[]>();
  for (const p of pontos) {
    const s = Number(p.semestre);
    const v = Number(p.proficiencia ?? p.valor);
    if (!Number.isFinite(s) || !Number.isFinite(v)) continue;
    porSemestre.set(s, [...(porSemestre.get(s) ?? []), v]);
  }
  if (!porSemestre.size) return "Sem distribuição por semestre.";
  return [...porSemestre.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semestre, valores]) => {
      const media = valores.reduce((acc, n) => acc + n, 0) / valores.length;
      const acima = valores.filter((n) => n >= 60).length;
      return `- ${semestre}º semestre: ${valores.length} aluno(s), média de proficiência ${media.toFixed(1)}, ${acima} acima da faixa`;
    })
    .join("\n");
}

/**
 * Contexto da leitura da VISÃO GERAL: escala institucional. Nada de questão
 * isolada e nada de recorte de simulado — o nível aqui é currículo, calendário
 * e política de preparação.
 */
function buildInstitucionalPrompt(visaoGeral: any, diagnostico: any, semestre: string | null): string {
  const periodo = visaoGeral?.meta?.periodo ?? "período não informado";
  const avisos: string[] = [];
  if (visaoGeral?.meta?.lowSample) avisos.push("Atenção: amostra de alunos com resultado é baixa (menos de 10).");
  if (visaoGeral?.meta?.partial) avisos.push("Atenção: parte dos dados do período está incompleta.");

  return [
    `Período analisado: ${periodo}. Esta leitura é INSTITUCIONAL: nenhum simulado específico foi selecionado.`,
    descreverRecorteSemestre(semestre),
    `Indicadores institucionais:\n${linhasVisaoGeral(visaoGeral)}`,
    `Evolução entre aplicações, da mais antiga para a mais recente:\n${linhasEvolucao(visaoGeral)}`,
    `Diagnóstico curricular por grande área (classificação e amostra):\n${linhasDiagnostico(diagnostico)}`,
    `Alunos por semestre em relação à faixa de proficiência:\n${linhasDispersaoPorSemestre(visaoGeral)}`,
    avisos.join(" "),
    "Gere a leitura estratégica institucional usando a tool leitura_estrategica e apenas esses números.",
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
        maxTokens: 2500,
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
        // Versão do prompt: mudar o jeito de escrever invalida o cache antigo,
        // senão o gestor continua lendo o texto duro já gravado.
        "v4-6ano-nao-e-semestre",
        escopo,
        iesId,
        semestre ?? null,
        listaSimulados ? [...listaSimulados].sort() : null,
      ]);
      if (!refresh) {
        const cached = await lerCache(supabaseAdmin, cacheKey);
        if (cached) {
          // No modo stream o cache também sai como SSE, para o front ter um só
          // caminho de leitura (evento `final` já completo, sem parciais).
          if (body?.stream === true) {
            const corpo = `data: ${JSON.stringify({ tipo: "final", ...cached, cached: true })}\n\ndata: [DONE]\n\n`;
            return new Response(corpo, {
              status: 200,
              headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            });
          }
          return jsonResponse({ ...cached, cached: true }, 200, cors);
        }
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
        ? buildInstitucionalPrompt(visaoGeralRes.data, diagnosticoRes.error ? null : diagnosticoRes.data, semestre ?? null)
        : buildConsultorPrompt(
            detalhamentoRes.data,
            visaoGeralRes.error ? null : visaoGeralRes.data,
            diagnosticoRes.error ? null : diagnosticoRes.data,
            questoesRes.error ? null : questoesRes.data,
            semestre ?? null
          );

      // Leitura estratégica precisa ser rápida na tela: o modelo flash entrega
      // a mesma estrutura em uma fração do tempo do modelo de raciocínio.
      const modeloLeitura = AI_MODEL_RAPIDO;
      // Teto folgado de propósito: o corte por `max_tokens` era o que derrubava
      // a leitura inteira. Com o repasse em SSE + reparo de JSON parcial, um
      // corte deixa de ser fatal, então não há motivo para apertar o teto.
      const tetoTokens = 4000;
      const mensagensLeitura = [
        {
          role: "system" as const,
          content: institucional ? SYSTEM_PROMPT_CONSULTOR_INSTITUCIONAL : SYSTEM_PROMPT_CONSULTOR_RECORTE,
        },
        { role: "user" as const, content: userPrompt },
      ];

      function montarPayload(estruturado: { leitura?: string; itens?: unknown[] } | null) {
        if (!estruturado || typeof estruturado.leitura !== "string") return null;
        const itens = Array.isArray(estruturado.itens) ? estruturado.itens.slice(0, 3) : [];
        return {
          leitura: estruturado.leitura,
          itens,
          // Compatibilidade com o parse defensivo antigo do front.
          insight: JSON.stringify({ leitura: estruturado.leitura, itens }),
        };
      }

      /* STREAMING ATÉ A TELA. Antes o front esperava o JSON final: qualquer
         corte (teto de tokens, modelo lento) virava "não foi possível montar a
         leitura". Agora os deltas do gateway são repassados em SSE e o front
         renderiza a leitura sendo escrita; o `final` só confirma o que já está
         na tela. O modo bufferizado continua para clientes antigos e cache. */
      if (body?.stream === true) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const enviar = (evento: Record<string, unknown>) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`));
            };
            try {
              let ultimoEnviado = "";
              const { texto, toolArguments } = await streamChatCompletion({
                apiKey: LOVABLE_API_KEY,
                model: modeloLeitura,
                messages: mensagensLeitura,
                maxTokens: tetoTokens,
                temperature: 0.4,
                tool: TOOL_LEITURA,
                signal: req.signal,
                onDelta: ({ texto: parcialTexto, toolArguments: parcialArgs }) => {
                  const bruto = parcialArgs ?? parcialTexto;
                  const parcial = repararJsonParcial<{ leitura?: string; itens?: unknown[] }>(bruto);
                  if (!parcial || typeof parcial.leitura !== "string") return;
                  const assinatura = JSON.stringify(parcial);
                  if (assinatura === ultimoEnviado) return;
                  ultimoEnviado = assinatura;
                  enviar({
                    tipo: "parcial",
                    leitura: parcial.leitura,
                    itens: Array.isArray(parcial.itens) ? parcial.itens.slice(0, 3) : [],
                  });
                },
              });

              const bruto = toolArguments ?? texto;
              const payload =
                montarPayload(repararJsonParcial<{ leitura?: string; itens?: unknown[] }>(bruto)) ??
                montarPayload(extrairJson<{ leitura?: string; itens?: unknown[] }>(bruto));

              if (!payload) {
                console.error("[gestor-ai-insights]", "consultor sem saída estruturada (stream)");
                enviar({ tipo: "erro", error: "sem_leitura" });
              } else {
                await gravarCache(supabaseAdmin, {
                  cacheKey,
                  fn: "gestor-ai-insights",
                  modo: `consultor:${escopo}`,
                  payload,
                  model: modeloLeitura,
                  ttlSegundos: TTL.gestorRecorte,
                });
                enviar({ tipo: "final", ...payload, cached: false });
              }
            } catch (e) {
              const status = e instanceof AiGatewayError ? e.status : 500;
              console.error("[gestor-ai-insights]", "stream error:", e instanceof Error ? e.message : e);
              enviar({ tipo: "erro", status, error: status === 429 ? "rate_limit" : status === 402 ? "payment_required" : "ai_error" });
            } finally {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      const { texto, toolArguments } = await streamChatCompletion({
        apiKey: LOVABLE_API_KEY,
        model: modeloLeitura,
        messages: mensagensLeitura,
        maxTokens: tetoTokens,
        temperature: 0.4,
        tool: TOOL_LEITURA,
        signal: req.signal,
      });

      const bruto = toolArguments ?? texto;
      const payload =
        montarPayload(repararJsonParcial<{ leitura?: string; itens?: unknown[] }>(bruto)) ??
        montarPayload(extrairJson<{ leitura?: string; itens?: unknown[] }>(bruto));

      if (!payload) {
        console.error("[gestor-ai-insights]", "consultor sem saída estruturada");
        return jsonResponse({ error: "sem_leitura" }, 500, cors);
      }

      await gravarCache(supabaseAdmin, {
        cacheKey,
        fn: "gestor-ai-insights",
        modo: `consultor:${escopo}`,
        payload,
        model: modeloLeitura,
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
        maxTokens: 2500,
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
