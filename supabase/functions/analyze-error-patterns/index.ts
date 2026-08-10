import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { isAllowedOrigin } from "../_shared/cors.ts";
import {
  AI_MODEL_RACIOCINIO,
  AiGatewayError,
  extrairJson,
  gravarCache,
  hashChave,
  lerCache,
  streamChatCompletion,
  TTL,
  type ToolSchema,
} from "../_shared/ai.ts";
import { ANTI_INVENCAO, BASE_ENAMED } from "../_shared/enamed.ts";

// Caderno de Erros — análise de padrão de erro do aluno.
//
// Streaming sempre (não morre no corte de ~2 min do host), saída garantida por
// schema (tool call) e cache no servidor por conteúdo do caderno — a chave já
// inclui os erros, então caderno inalterado não gasta crédito de novo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é tutor médico sênior especialista em preparação para o ENAMED e em ciência da aprendizagem (prática de recuperação, repetição espaçada, intercalação, correção de erro conceitual x erro de manejo de prova).

${BASE_ENAMED}

Sua tarefa: ler o caderno de erros de UM estudante e devolver, via a tool analise_de_erros, uma análise que o faça mudar o que estuda amanhã.

Como você pensa:
- Separe erro de CONHECIMENTO (não sabia o conteúdo), erro de RACIOCÍNIO CLÍNICO (sabia as peças, errou a decisão), erro de INTERPRETAÇÃO (leu mal o enunciado/imagem) e erro de MANEJO DE PROVA (tempo, ansiedade, troca de alternativa). A correção é diferente em cada caso.
- Agrupe por padrão real, não por rótulo do sistema: dois erros de temas distintos podem ser o mesmo padrão.
- Priorize pelo que mais move a proficiência: área com muitos itens no exame + erro em item que a maioria acerta.
- Fale direto com o estudante, em 2ª pessoa, tom firme e encorajador. Sem enrolação, sem elogio vazio.

${ANTI_INVENCAO} Nunca dê conduta clínica: o foco é estudo.`;

const TOOL_ANALISE: ToolSchema = {
  type: "function",
  function: {
    name: "analise_de_erros",
    description: "Devolve a análise estruturada do caderno de erros do estudante.",
    parameters: {
      type: "object",
      properties: {
        leitura: { type: "string", description: "Diagnóstico central em até 240 caracteres." },
        clusters: {
          type: "array",
          description: "Até 3 padrões de erro recorrentes, do mais custoso ao menos.",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Nome do padrão, até 50 caracteres." },
              tipo: {
                type: "string",
                enum: ["conhecimento", "raciocinio_clinico", "interpretacao", "manejo_de_prova"],
              },
              evidencia: { type: "string", description: "Quais erros do caderno sustentam esse padrão, até 180 caracteres." },
            },
            required: ["titulo", "tipo", "evidencia"],
          },
        },
        plano: {
          type: "array",
          description: "Até 3 ações priorizadas para os próximos 7 dias.",
          items: {
            type: "object",
            properties: {
              acao: { type: "string", description: "O que fazer, até 120 caracteres." },
              porque: { type: "string", description: "Por que isso move a nota, até 140 caracteres." },
              quando: { type: "string", description: "Quando fazer, ex: hoje, amanhã, 2x nesta semana." },
            },
            required: ["acao", "porque", "quando"],
          },
        },
        frase_final: { type: "string", description: "Uma frase curta de fechamento, sem clichê." },
      },
      required: ["leitura", "clusters", "plano", "frase_final"],
    },
  },
};

interface Cluster {
  titulo: string;
  tipo: string;
  evidencia: string;
}
interface Acao {
  acao: string;
  porque: string;
  quando: string;
}
interface Analise {
  leitura: string;
  clusters?: Cluster[];
  plano?: Acao[];
  frase_final?: string;
}

const ROTULO_TIPO: Record<string, string> = {
  conhecimento: "lacuna de conteúdo",
  raciocinio_clinico: "raciocínio clínico",
  interpretacao: "interpretação do enunciado",
  manejo_de_prova: "manejo de prova",
};

/** Monta o markdown que o card do front renderiza, a partir da saída estruturada. */
function montarMarkdown(a: Analise): string {
  const partes: string[] = [a.leitura];

  if (a.clusters?.length) {
    partes.push(
      ["**Padrões que se repetem**", ...a.clusters.slice(0, 3).map(
        (c) => `- **${c.titulo}** (${ROTULO_TIPO[c.tipo] ?? c.tipo}): ${c.evidencia}`
      )].join("\n")
    );
  }

  if (a.plano?.length) {
    partes.push(
      ["**O que fazer nos próximos 7 dias**", ...a.plano.slice(0, 3).map(
        (p, i) => `${i + 1}. **${p.acao}** — ${p.porque} _(${p.quando})_`
      )].join("\n")
    );
  }

  if (a.frase_final) partes.push(a.frase_final);
  return partes.join("\n\n");
}

function resumoAgregados(agregados: any): string {
  if (!agregados) return "";
  const porArea: any[] = Array.isArray(agregados?.byArea)
    ? agregados.byArea
    : Array.isArray(agregados?.por_area)
      ? agregados.por_area
      : [];
  const geral = agregados?.overall ?? agregados?.geral ?? null;
  const linhas: string[] = [];
  if (geral) linhas.push(`- Acerto geral em simulados: ${JSON.stringify(geral)}`);
  for (const a of porArea.slice(0, 8)) {
    linhas.push(`- ${a.area ?? a.nome ?? "área"}: ${a.acertoPct ?? a.percentual ?? "sem dado"}% de acerto`);
  }
  return linhas.length ? `Desempenho do estudante em simulados (para cruzar com os erros):\n${linhas.join("\n")}` : "";
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // fase-2-cors-gatekeep
  const __origin = req.headers.get("Origin");
  if (__origin !== null && !isAllowedOrigin(__origin)) {
    return new Response("forbidden", { status: 403 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const entries = body?.entries;
    const refresh = Boolean(body?.refresh);
    if (!entries || !Array.isArray(entries) || entries.length < 3) {
      return jsonResponse({ error: "Need at least 3 entries" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI not configured" }, 500);
    }

    const usados = entries.slice(0, 50);
    const cacheKey = await hashChave(["analyze-error-patterns", user.id, usados]);
    if (!refresh) {
      const cached = await lerCache(supabaseAdmin, cacheKey);
      if (cached) return jsonResponse({ ...cached, cached: true }, 200);
    }

    // Cruzamento: os erros do caderno + o desempenho real do aluno em simulados.
    // Client com a anon key repassando o token do usuário, para as RPCs correrem
    // como ele (auth.uid()) e respeitarem RLS.
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [agregadosRes, perfilRes] = await Promise.all([
      supabaseUser.rpc("get_user_performance_aggregates", { p_simulado_id: null }),
      supabaseUser.from("users").select("semestre").eq("id", user.id).maybeSingle(),
    ]);
    if (agregadosRes.error) {
      console.error("[analyze-error-patterns]", "agregados (opcional):", agregadosRes.error.message);
    }

    const entriesSummary = usados
      .map(
        (e: any, i: number) =>
          `${i + 1}. Área: ${e.area || "?"} | Especialidade: ${e.especialidade || "?"} | Tema: ${e.tema || "?"} | Motivo declarado: ${e.reason} | Aprendizado registrado: ${e.learning || "não registrado"}`
      )
      .join("\n");

    const userPrompt = [
      `Estudante do ${perfilRes?.data?.semestre ?? "semestre não informado"}º semestre.`,
      `Erros registrados no caderno (${usados.length} registro(s)):\n${entriesSummary}`,
      agregadosRes.error ? "" : resumoAgregados(agregadosRes.data),
      "Gere a análise usando a tool analise_de_erros e apenas esses dados.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { texto, toolArguments } = await streamChatCompletion({
      apiKey: LOVABLE_API_KEY,
      model: AI_MODEL_RACIOCINIO,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 900,
      temperature: 0.5,
      tool: TOOL_ANALISE,
      signal: req.signal,
    });

    const analise =
      (toolArguments ? extrairJson<Analise>(toolArguments) : null) ?? extrairJson<Analise>(texto);

    if (!analise || typeof analise.leitura !== "string") {
      console.error("[analyze-error-patterns]", "sem saída estruturada");
      return jsonResponse({ error: "AI analysis failed" }, 500);
    }

    const payload = {
      insight: montarMarkdown(analise),
      leitura: analise.leitura,
      clusters: Array.isArray(analise.clusters) ? analise.clusters.slice(0, 3) : [],
      plano: Array.isArray(analise.plano) ? analise.plano.slice(0, 3) : [],
    };

    await gravarCache(supabaseAdmin, {
      cacheKey,
      fn: "analyze-error-patterns",
      modo: "caderno",
      payload,
      model: AI_MODEL_RACIOCINIO,
      ttlSegundos: TTL.cadernoErros,
    });

    return jsonResponse({ ...payload, cached: false }, 200);
  } catch (err) {
    if (err instanceof AiGatewayError) {
      if (err.status === 429) return jsonResponse({ error: "Rate limit exceeded" }, 429);
      if (err.status === 402) return jsonResponse({ error: "Payment required" }, 402);
      console.error("[analyze-error-patterns]", "AI gateway error:", err.status, err.message);
      return jsonResponse({ error: "AI analysis failed" }, 500);
    }
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(null, { status: 499, headers: corsHeaders });
    }
    console.error("analyze-error-patterns error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
