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
import { ANTI_INVENCAO, BASE_ENAMED } from "../_shared/enamed.ts";

// Tutor do aluno (Progress Hub).
//
// Dois modos no mesmo endpoint: `quick` (uma frase para o card) e `full` (plano
// estruturado). Ambos com streaming ao gateway (o `full` gera muitos tokens e
// era o mais exposto ao corte de ~2 min do host) e com cache no servidor, para
// F5/outra aba/outro device não recobrarem a mesma geração.

const CONTEXT_PACK = `Contexto: Estudante de medicina no Brasil, preparando-se para o ENAMED.
- Ciclo básico (1º-4º período): anatomia, fisiologia, bioquímica, histologia, farmacologia, patologia.
- Ciclo clínico (5º-8º período): clínica médica, cirurgia, pediatria, ginecologia/obstetrícia, saúde coletiva.
- Internato (9º-12º período): rodízios práticos, plantões, ENAMED e preparação para residência.
- Estratégias com maior retorno comprovado: prática de recuperação (questões antes de reler), repetição espaçada, intercalação de áreas, correção ativa do erro (registrar o porquê), simulado cronometrado para manejo de prova.
- Tom: PT-BR, empático, firme, prático. Nunca diagnosticar nem prescrever conduta médica.

${BASE_ENAMED}`;

const TOOL_SCHEMA: ToolSchema = {
  type: "function",
  function: {
    name: "generate_study_plan",
    description: "Generate a structured study plan for the medical student based on their data.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "1 frase do foco principal de hoje" },
        whyThisMatters: { type: "string", description: "Por que isso é importante agora, baseado nos dados" },
        todayPlan: {
          type: "object",
          properties: {
            durationMin: { type: "number" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  detail: { type: "string" },
                  check: { type: "string" },
                },
                required: ["title", "detail", "check"],
              },
            },
          },
          required: ["durationMin", "steps"],
        },
        weekPlan: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayLabel: { type: "string" },
              focus: { type: "string" },
              outcome: { type: "string" },
            },
            required: ["dayLabel", "focus", "outcome"],
          },
        },
        priorities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              reason: { type: "string" },
              impact: { type: "string", enum: ["high", "med", "low"] },
            },
            required: ["item", "reason", "impact"],
          },
        },
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              risk: { type: "string" },
              mitigation: { type: "string" },
            },
            required: ["risk", "mitigation"],
          },
        },
        studyMethods: {
          type: "array",
          items: {
            type: "object",
            properties: {
              method: { type: "string" },
              whenToUse: { type: "string" },
            },
            required: ["method", "whenToUse"],
          },
        },
        references: { type: "array", items: { type: "string" } },
      },
      required: ["headline", "whyThisMatters", "todayPlan", "weekPlan", "priorities", "risks", "studyMethods"],
    },
  },
};

async function aggregateSnapshot(supabaseUser: any, userId: string) {
  const start = Date.now();

  const [userRes, examsRes, progressRes, simuladoRes, errosRes, flashRes] = await Promise.all([
    supabaseUser.from("users").select("semestre, nome").eq("id", userId).single(),
    supabaseUser
      .from("user_exams")
      .select("exam_name, materia, exam_date")
      .eq("user_id", userId)
      .gte("exam_date", new Date().toISOString().split("T")[0])
      .order("exam_date", { ascending: true })
      .limit(10),
    supabaseUser.rpc("get_progress_hub_summary"),
    supabaseUser.rpc("get_user_performance_aggregates"),
    // Cruzamento novo: o que o aluno já reconheceu como erro e o que está vencido
    // para revisão. Isso muda a prioridade do plano.
    supabaseUser
      .from("error_notebook_entries")
      .select("grande_area, especialidade, tema, reason, srs_due_at, mastered_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
    supabaseUser
      .from("flashcards")
      .select("srs_due_at, mastered_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(200),
  ]);

  const user = userRes.data;
  const exams = examsRes.data || [];
  const hubData = progressRes.data;
  const perfData = simuladoRes.data;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const examsList = exams.map((e: any) => {
    const examDate = new Date(e.exam_date);
    examDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { title: e.exam_name, materia: e.materia, date: e.exam_date, daysUntil };
  });

  const overview = hubData?.overview || { percentage: 0, completed: 0, total: 0 };
  const byMateria = (hubData?.by_materia || []).map((m: any) => ({
    materia: m.materia,
    percentage: m.percentage || 0,
    completed: m.completed || 0,
    total: m.total || 0,
  }));

  const topGaps = [...byMateria]
    .filter((m: any) => m.total > 0 && m.percentage < 100)
    .sort((a: any, b: any) => a.percentage - b.percentage)
    .slice(0, 5)
    .map((m: any) => ({ materia: m.materia, tema: null, percentage: m.percentage, total: m.total, completed: m.completed }));

  const byArea = perfData?.byArea || [];
  const simuladoPerformance = byArea.map((a: any) => ({
    area: a.name,
    acertos: a.acertos,
    total: a.total,
    percentage: a.total > 0 ? Math.round((a.acertos / a.total) * 100) : 0,
  }));

  const bySubspecialty = perfData?.bySubspecialty || [];
  const topWeaknesses = [...bySubspecialty]
    .filter((s: any) => s.total >= 2)
    .sort((a: any, b: any) => a.acertos / a.total - b.acertos / b.total)
    .slice(0, 5)
    .map((s: any) => ({ tema: s.name, area: s.area_name, acertos: s.acertos, total: s.total }));

  // Caderno de erros: onde o erro se concentra e o que já venceu a revisão.
  const erros = errosRes.data || [];
  const contagemPorArea = new Map<string, number>();
  const motivos = new Map<string, number>();
  let errosVencidos = 0;
  const agora = Date.now();
  for (const e of erros) {
    const area = e.grande_area || "não classificado";
    contagemPorArea.set(area, (contagemPorArea.get(area) ?? 0) + 1);
    if (e.reason) motivos.set(e.reason, (motivos.get(e.reason) ?? 0) + 1);
    if (!e.mastered_at && e.srs_due_at && new Date(e.srs_due_at).getTime() <= agora) errosVencidos += 1;
  }
  const errorNotebook = {
    total: erros.length,
    dueForReview: errosVencidos,
    byArea: [...contagemPorArea.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area, count]) => ({ area, count })),
    topReasons: [...motivos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count })),
  };

  const flashcards = flashRes.data || [];
  const flashcardsDue = flashcards.filter(
    (f: any) => !f.mastered_at && f.srs_due_at && new Date(f.srs_due_at).getTime() <= agora
  ).length;

  const streak = hubData?.streak || { current: 0 };
  const lastActive = hubData?.last_activity?.completed_at || null;

  console.log(
    "[AITutorEngine]",
    "snapshot aggregated",
    `latency=${Date.now() - start}ms`,
    `exams=${examsList.length}`,
    `gaps=${topGaps.length}`,
    `weaknesses=${topWeaknesses.length}`,
    `erros=${errorNotebook.total}`
  );

  return {
    semester: user?.semestre || null,
    streakDays: streak.current || 0,
    lastActiveAt: lastActive,
    exams: examsList,
    progress: { percentage: overview.percentage || 0, completed: overview.completed || 0, total: overview.total || 0 },
    topGaps,
    simuladoPerformance,
    topWeaknesses,
    byMateria,
    errorNotebook,
    flashcardsDue,
  };
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function respostaDeErroDeGateway(e: unknown, cors: Record<string, string>): Response {
  if (e instanceof AiGatewayError) {
    if (e.status === 429) return jsonResponse({ error: "Rate limit exceeded" }, 429, cors);
    if (e.status === 402) return jsonResponse({ error: "Payment required" }, 402, cors);
    console.error("[AITutorEngine]", "AI gateway error:", e.status, e.message);
    return jsonResponse({ error: "AI error" }, 500, cors);
  }
  if (e instanceof Error && e.name === "AbortError") {
    return new Response(null, { status: 499, headers: cors });
  }
  console.error("[AITutorEngine]", "error:", e);
  return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500, cors);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin) || corsHeaders;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI not configured" }, 500, cors);
    }

    const body = await req.json();
    const mode = body.mode || "quick";
    const refresh = Boolean(body.refresh);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Auth: exigida nos dois modos — o cache é por usuário.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, cors);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401, cors);
    }
    const userId = userData.user.id;

    // Client no escopo do usuário: as RPCs correm como ele (auth.uid()) e a
    // leitura de tabelas herda RLS.
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // === QUICK MODE ===
    if (mode === "quick") {
      const { progress, top_materias, risk_alerts, next_exam } = body;
      const parts: string[] = [];
      if (progress)
        parts.push(`Progresso geral: ${progress.percentage}% (${progress.completed}/${progress.total} aulas concluídas).`);
      if (next_exam)
        parts.push(
          `Próxima prova: ${next_exam.materia} em ${next_exam.days_remaining} dias (progresso: ${next_exam.progress ?? "desconhecido"}%).`
        );
      if (top_materias?.length) {
        parts.push(`Matérias: ${top_materias.map((m: any) => `${m.materia}: ${m.percentage}%`).join(", ")}.`);
      }
      if (risk_alerts?.length) {
        parts.push(
          `Alertas de risco: ${risk_alerts
            .map((r: any) => `${r.tema} (${r.days_inactive} dias parado, ${Math.round(r.percentage)}%)`)
            .join("; ")}.`
        );
      }
      const contextStr = parts.join(" ");

      const cacheKey = await hashChave(["ai-study-recommendation", "quick", userId, contextStr]);
      if (!refresh) {
        const cached = await lerCache(supabaseAdmin, cacheKey);
        if (cached) return jsonResponse({ ...cached, cached: true }, 200, cors);
      }

      const { texto } = await streamChatCompletion({
        apiKey: LOVABLE_API_KEY,
        model: AI_MODEL_RAPIDO,
        messages: [
          {
            role: "system",
            content: `${CONTEXT_PACK}

Você é um tutor de medicina conciso e motivador. Com base no contexto do aluno (progresso, provas e alertas), diga em 2-3 frases (máximo 280 caracteres) o que ele deve estudar AGORA e por que isso move a nota. Prefira a ação com maior retorno: prova mais próxima, depois maior lacuna em área de grande volume no ENAMED. Sem saudação, sem formatação especial. ${ANTI_INVENCAO}`,
          },
          {
            role: "user",
            content: contextStr || "Aluno sem dados de progresso ainda. Dê uma dica inicial de estudo focada em prática de recuperação.",
          },
        ],
        maxTokens: 250,
        temperature: 0.7,
        signal: req.signal,
      });

      const payload = { recommendation: texto };
      await gravarCache(supabaseAdmin, {
        cacheKey,
        fn: "ai-study-recommendation",
        modo: "quick",
        payload,
        model: AI_MODEL_RAPIDO,
        ttlSegundos: TTL.aluno,
      });
      return jsonResponse({ ...payload, cached: false }, 200, cors);
    }

    // === FULL MODE ===
    console.log("[AITutorEngine]", "full mode requested");
    const startTime = Date.now();

    const snapshot = await aggregateSnapshot(supabaseUser, userId);
    console.log(
      "[AITutorEngine]",
      "snapshot",
      JSON.stringify({
        semester: snapshot.semester,
        progress: snapshot.progress.percentage,
        exams: snapshot.exams.length,
        gaps: snapshot.topGaps.length,
      })
    );

    // A chave inclui o snapshot: se o aluno concluiu aula, registrou erro ou
    // mudou a agenda, o plano é regerado; se nada mudou, sai do cache.
    const cacheKey = await hashChave(["ai-study-recommendation", "full", userId, snapshot]);
    if (!refresh) {
      const cached = await lerCache(supabaseAdmin, cacheKey);
      if (cached) return jsonResponse({ ...cached, cached: true }, 200, cors);
    }

    const systemPrompt = `${CONTEXT_PACK}

Você é tutor e coach de estudos de um estudante de medicina, especialista em desempenho no ENAMED.
Você recebe um "StudentSnapshot" com dados reais de desempenho, caderno de erros e agenda. Gere um plano específico, executável e convincente.

Regras:
- Português do Brasil, 2ª pessoa, objetivo e com explicação forte do "por quê".
- Nunca invente dados: o que não estiver no snapshot é "não informado".
- Sem diagnóstico ou conduta clínica; foco em estudo.
- Prioridade, nesta ordem: (1) prova mais próxima; (2) revisão vencida do caderno de erros e flashcards (o erro já reconhecido e não revisado é a maior perda de nota); (3) maior lacuna em área de grande volume no ENAMED; (4) consistência.
- Trate erro de conhecimento, de raciocínio clínico, de interpretação e de manejo de prova com métodos diferentes — diga qual método usar e quando.
- Produza um plano "para hoje" e um plano da semana com 5 dias.
- Use a tool generate_study_plan para retornar o plano estruturado. ${ANTI_INVENCAO}`;

    const { texto, toolArguments } = await streamChatCompletion({
      apiKey: LOVABLE_API_KEY,
      model: AI_MODEL_RACIOCINIO,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `StudentSnapshot:\n${JSON.stringify(snapshot, null, 0)}\n\nGere o plano de estudos personalizado usando a tool generate_study_plan.`,
        },
      ],
      maxTokens: 2400,
      temperature: 0.6,
      tool: TOOL_SCHEMA,
      signal: req.signal,
    });

    const latencyMs = Date.now() - startTime;
    const plan = (toolArguments ? extrairJson<any>(toolArguments) : null) ?? extrairJson<any>(texto);

    if (!plan || !plan.headline) {
      if (texto) {
        console.warn("[AITutorEngine]", "sem tool call; devolvendo texto como recomendação");
        return jsonResponse({ recommendation: texto, plan: null }, 200, cors);
      }
      return jsonResponse({ error: "No structured response from AI" }, 500, cors);
    }

    plan.meta = { model: AI_MODEL_RACIOCINIO, latencyMs, usedOnlineResearch: false };
    console.log(
      "[AITutorEngine]",
      "plan generated",
      `latencyMs=${latencyMs}`,
      `steps=${plan.todayPlan?.steps?.length || 0}`
    );

    const payload = { plan };
    await gravarCache(supabaseAdmin, {
      cacheKey,
      fn: "ai-study-recommendation",
      modo: "full",
      payload,
      model: AI_MODEL_RACIOCINIO,
      ttlSegundos: TTL.aluno,
    });

    return jsonResponse({ ...payload, cached: false }, 200, cors);
  } catch (e) {
    return respostaDeErroDeGateway(e, cors);
  }
});
