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
import { ANTI_INVENCAO, BASE_ENAMED } from "../_shared/enamed.ts";

// Portal do Mentor — Diagnóstico da IA do Detalhamento por Simulados (docs/08 Fase 2 · 2.4).
//
// Mesmo desenho de `gestor-ai-insights`:
// - dado de aluno/turma NUNCA é lido com service role: o client `supabaseUser` usa a anon key com o
//   Authorization do request, então as RPCs `mentor_*` correm como o mentor logado e o recorte é a
//   turma dele (`mentor_ativo_id()` no servidor). O client admin só valida o JWT e lê/grava o cache;
// - streaming sempre (consumido aqui; o front recebe um JSON único);
// - cache em public.ai_response_cache com chave = modalidade + mentor + simulados; `refresh: true`
//   ("Gerar de novo") ignora o cache e regrava.
// E-mails de quem marcou cada alternativa vêm nas RPCs, mas não vão para o modelo.

interface Corpo {
  modalidade: "b2c" | "b2b";
  simulados: string[];
  refresh?: boolean;
}

const SYSTEM_PROMPT = `Você é um mentor pedagógico sênior de estudantes de medicina, especialista no ENAMED, escrevendo para outro mentor sobre a turma dele.

${BASE_ENAMED}

Entregue, via a tool diagnostico_turma:
- "resumo": no máximo 2 frases, dizendo como a turma está no recorte e o que explica isso;
- "itens": de 2 a 4 pontos de "o que olhar primeiro", em ordem de prioridade. Cada item tem "destaque" (o fato, curto, com um número do contexto, ex.: "Preventiva em alta prevalência: 58%.") e "texto" (uma frase do porquê ou do que fazer).

Como escrever:
- Frases curtas, palavras do dia a dia, sem jargão ("alavancar", "potencializar", "gap", "performance", "insight").
- Priorize por peso na prova (prevalência alta pesa mais) e por quantos alunos o problema atinge.
- Um distrator que concentra muita resposta errada indica confusão de conceito, não falta de estudo.
- Nunca cite aluno pelo nome nem por e-mail. Nunca invente número, tema ou tendência.
- Para B2B, "TRI projetado" e "Conceito ENAMED" são projeções, não resultado oficial do INEP; proficiente = 60 ou mais.

${ANTI_INVENCAO}`;

const TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "diagnostico_turma",
    description: "Diagnóstico curto do desempenho da turma no recorte de simulados.",
    parameters: {
      type: "object",
      properties: {
        resumo: { type: "string", description: "No máximo 2 frases, até 280 caracteres." },
        itens: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              destaque: { type: "string", description: "Até 70 caracteres, com um número do contexto." },
              texto: { type: "string", description: "Uma frase, até 160 caracteres." },
            },
            required: ["destaque", "texto"],
          },
        },
      },
      required: ["resumo", "itens"],
    },
  },
};

type Linha = Record<string, unknown>;
const lista = (v: unknown): Linha[] => (Array.isArray(v) ? (v as Linha[]) : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v: unknown) => (num(v) === null ? "sem dado" : `${num(v)}%`);

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function statusForRpcError(error: { code?: string; message?: string }): number {
  if (error.code === "42501" || /permission denied|access denied|sem acesso/i.test(error.message ?? "")) return 403;
  return 400;
}

/** Contexto enxuto e sem identificação de aluno (só agregados). */
function contexto(modalidade: "b2c" | "b2b", det: Linha, serie: Linha[], temas: Linha[]): string {
  const areas = lista(det.areas)
    .map((a) => `- ${a.grande_area}: ${pct(a.acerto_pct)} (${a.respostas ?? 0} respostas); piores especialidades: ${
      lista(a.especialidades).slice(0, 3).map((e) => `${e.especialidade ?? "sem especialidade"} ${pct(e.acerto_pct)}`).join(", ") || "—"}`)
    .join("\n");
  const questoes = lista(det.questoes)
    .filter((q) => num(q.acerto_pct) !== null)
    .sort((a, b) => (num(a.acerto_pct) ?? 0) - (num(b.acerto_pct) ?? 0))
    .slice(0, 8)
    .map((q) => {
      const dist = (q.distribuicao ?? {}) as Record<string, number>;
      const total = Object.entries(dist).filter(([l]) => l !== "branco").reduce((s, [, n]) => s + (n ?? 0), 0);
      const correta = String(q.correta_label ?? "");
      const erradas = Object.entries(dist).filter(([l]) => l !== "branco" && l !== correta).sort((a, b) => b[1] - a[1]);
      const dom = erradas[0];
      return `- Q${q.numero} (${q.grande_area} · ${q.tema_curto ?? q.tema}): ${pct(q.acerto_pct)} de acerto; ${
        dom && total ? `distrator ${dom[0]} com ${dom[1]} respostas (${Math.round((100 * dom[1]) / total)}%)` : "sem distrator dominante"}`;
    })
    .join("\n");
  const prev = temas
    .filter((t) => t.prevalencia)
    .sort((a, b) => (num(a.acerto_pct) ?? 0) - (num(b.acerto_pct) ?? 0))
    .slice(0, 8)
    .map((t) => `- ${t.tema} (${t.grande_area}, prevalência ${t.prevalencia}): ${pct(t.acerto_pct)} em ${t.respostas ?? 0} respostas`)
    .join("\n");
  const evolucao = serie
    .map((s) => `- ${s.sequence_number}º simulado: ${s.participantes ?? 0} participantes, acerto médio ${pct(s.acerto_medio)}, acima do corte da meta ${pct(s.acima_corte_pct)}`)
    .join("\n");
  const projetados = modalidade === "b2b"
    ? `Indicadores projetados (não oficiais): conceito ENAMED ${JSON.stringify(det.conceito_enamed ?? null)}, TRI projetado ${JSON.stringify(det.tri_projetado ?? null)}, proficientes ${pct(det.proficientes_pct)}, acerto médio ${pct(det.acerto_medio_pct)}.`
    : "";
  return [
    `Modalidade: ${modalidade === "b2c" ? "B2C (tribo; régua de acerto 78/66; meta individual do aluno)" : "B2B (instituição; limiar de proficiência 60; potencial de virada 52–59)"}.`,
    evolucao ? `Evolução por simulado do recorte:\n${evolucao}` : "",
    projetados,
    `Acerto por grande área no recorte:\n${areas || "sem dado"}`,
    prev ? `Temas com prevalência cadastrada (piores primeiro):\n${prev}` : "Prevalência dos temas ainda não cadastrada: não fale de prevalência.",
    `Questões mais erradas:\n${questoes || "sem dado"}`,
    "Com base apenas nesses números, chame a tool diagnostico_turma.",
  ].filter(Boolean).join("\n\n");
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("origin")) || corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured" }, 500, cors);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401, cors);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401, cors);

    // Client do usuário: as RPCs do mentor correm com o JWT dele (nunca service role para dado).
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: Corpo;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400, cors);
    }
    const modalidade = body?.modalidade === "b2b" ? "b2b" : body?.modalidade === "b2c" ? "b2c" : null;
    const simulados = Array.isArray(body?.simulados) ? body.simulados.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
    if (!modalidade) return jsonResponse({ error: "modalidade_obrigatoria" }, 400, cors);
    if (simulados.length === 0) return jsonResponse({ error: "escolha ao menos um simulado" }, 400, cors);
    const refresh = body.refresh === true;

    // Chave = modo + recorte: o recorte do mentor é a turma dele (por isso o usuário entra na chave).
    const cacheKey = await hashChave(["mentor-ai-insights", "v1", modalidade, userData.user.id, [...simulados].sort()]);
    if (!refresh) {
      const cached = await lerCache(supabaseAdmin, cacheKey);
      if (cached) return jsonResponse({ ...cached, cached: true }, 200, cors);
    }

    let det: Linha;
    let serie: Linha[] = [];
    let temas: Linha[] = [];
    if (modalidade === "b2c") {
      const [detRes, serieRes, temasRes] = await Promise.all([
        supabaseUser.rpc("mentor_detalhamento", { p_simulados: simulados, p_emails: null }),
        supabaseUser.rpc("mentor_serie_turma", { p_simulados: simulados }),
        supabaseUser.rpc("mentor_temas_turma", { p_simulados: simulados }),
      ]);
      const falha = detRes.error ?? serieRes.error ?? temasRes.error;
      if (falha) return jsonResponse({ error: falha.message }, statusForRpcError(falha), cors);
      det = (detRes.data ?? {}) as Linha;
      serie = lista(serieRes.data);
      temas = lista(temasRes.data);
    } else {
      const detRes = await supabaseUser.rpc("mentor_detalhamento_b2b", { p_simulados: simulados });
      if (detRes.error) return jsonResponse({ error: detRes.error.message }, statusForRpcError(detRes.error), cors);
      // Envelope { data, meta } das RPCs B2B (ou o objeto direto).
      const bruto = (detRes.data ?? {}) as Linha;
      det = (bruto.data && typeof bruto.data === "object" ? bruto.data : bruto) as Linha;
    }

    const { toolArguments, texto } = await streamChatCompletion({
      apiKey: LOVABLE_API_KEY,
      model: AI_MODEL_RAPIDO,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contexto(modalidade, det, serie, temas) },
      ],
      tool: TOOL,
      maxTokens: 2500,
      temperature: 0.4,
      signal: req.signal,
    });

    const lido = (toolArguments ? repararJsonParcial<{ resumo?: unknown; itens?: unknown }>(toolArguments) : null)
      ?? extrairJson<{ resumo?: unknown; itens?: unknown }>(texto);
    const resumo = typeof lido?.resumo === "string" ? lido.resumo.trim() : "";
    const itens = lista(lido?.itens)
      .map((i) => ({ destaque: String(i.destaque ?? "").trim(), texto: String(i.texto ?? "").trim() }))
      .filter((i) => i.destaque || i.texto)
      .slice(0, 4);
    if (!resumo) return jsonResponse({ error: "sem_leitura" }, 500, cors);

    const payload = { resumo, itens, geradoEm: new Date().toISOString() };
    await gravarCache(supabaseAdmin, {
      cacheKey,
      fn: "mentor-ai-insights",
      modo: modalidade,
      payload,
      model: AI_MODEL_RAPIDO,
      ttlSegundos: TTL.gestorRecorte,
    });
    return jsonResponse({ ...payload, cached: false }, 200, cors);
  } catch (e) {
    if (e instanceof AiGatewayError) {
      if (e.status === 429) return jsonResponse({ error: "Rate limit exceeded" }, 429, cors);
      if (e.status === 402) return jsonResponse({ error: "Payment required" }, 402, cors);
      console.error("[mentor-ai-insights]", "AI gateway error:", e.status, e.message);
      return jsonResponse({ error: "AI error" }, 500, cors);
    }
    if (e instanceof Error && e.name === "AbortError") return new Response(null, { status: 499, headers: cors });
    console.error("[mentor-ai-insights]", "error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500, cors);
  }
});
