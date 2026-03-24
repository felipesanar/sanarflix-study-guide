import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildCorsHeaders, corsHeaders } from "../_shared/cors.ts";

const CONTEXT_PACK = `Contexto: Estudante de medicina no Brasil.
- Ciclo básico (1º-4º período): anatomia, fisiologia, bioquímica, histologia, farmacologia, patologia.
- Ciclo clínico (5º-8º período): clínica médica, cirurgia, pediatria, ginecologia/obstetrícia, saúde coletiva.
- Internato (9º-12º período): rodízios práticos, plantões, preparação para residência.
- Estratégias eficazes: active recall, spaced repetition, questões comentadas, mapas mentais, revisão periódica.
- Avaliações: provas regulares, simulados tipo residência, OSCE, avaliações práticas.
- Tom: PT-BR, empático, firme, prático. Nunca diagnosticar/prescrever condutas médicas.`;

const TOOL_SCHEMA = {
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

async function aggregateSnapshot(supabaseAdmin: any, userId: string) {
  const start = Date.now();

  // Parallel queries
  const [userRes, examsRes, progressRes, simuladoRes] = await Promise.all([
    supabaseAdmin.from("users").select("semestre, nome").eq("id", userId).single(),
    supabaseAdmin.from("user_exams").select("exam_name, materia, exam_date").eq("user_id", userId).gte("exam_date", new Date().toISOString().split("T")[0]).order("exam_date", { ascending: true }).limit(10),
    supabaseAdmin.rpc("get_progress_hub_summary"),
    supabaseAdmin.rpc("get_user_performance_aggregates"),
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

  // Progress from hub
  const overview = hubData?.overview || { percentage: 0, completed: 0, total: 0 };
  const byMateria = (hubData?.by_materia || []).map((m: any) => ({
    materia: m.materia,
    percentage: m.percentage || 0,
    completed: m.completed || 0,
    total: m.total || 0,
  }));

  // Top gaps (lowest percentage with content)
  const topGaps = [...byMateria]
    .filter((m: any) => m.total > 0 && m.percentage < 100)
    .sort((a: any, b: any) => a.percentage - b.percentage)
    .slice(0, 5)
    .map((m: any) => ({ materia: m.materia, tema: null, percentage: m.percentage, total: m.total, completed: m.completed }));

  // Simulado performance
  const byArea = perfData?.byArea || [];
  const simuladoPerformance = byArea.map((a: any) => ({
    area: a.name,
    acertos: a.acertos,
    total: a.total,
    percentage: a.total > 0 ? Math.round((a.acertos / a.total) * 100) : 0,
  }));

  // Top weaknesses from subspecialties
  const bySubspecialty = perfData?.bySubspecialty || [];
  const topWeaknesses = [...bySubspecialty]
    .filter((s: any) => s.total >= 2)
    .sort((a: any, b: any) => (a.acertos / a.total) - (b.acertos / b.total))
    .slice(0, 5)
    .map((s: any) => ({ tema: s.name, area: s.area_name, acertos: s.acertos, total: s.total }));

  // Streak
  const streak = hubData?.streak || { current: 0 };

  // Last activity
  const lastActive = hubData?.last_activity?.completed_at || null;

  console.log("[AITutorEngine]", "snapshot aggregated", `latency=${Date.now() - start}ms`, `exams=${examsList.length}`, `gaps=${topGaps.length}`, `weaknesses=${topWeaknesses.length}`);

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
  };
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
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode = body.mode || "quick";

    // === QUICK MODE (backwards compatible) ===
    if (mode === "quick") {
      const { progress, top_materias, risk_alerts, next_exam } = body;
      const parts: string[] = [];
      if (progress) parts.push(`Progresso geral: ${progress.percentage}% (${progress.completed}/${progress.total} aulas concluídas).`);
      if (next_exam) parts.push(`Próxima prova: ${next_exam.materia} em ${next_exam.days_remaining} dias (progresso: ${next_exam.progress ?? "desconhecido"}%).`);
      if (top_materias?.length) {
        const materias = top_materias.map((m: any) => `${m.materia}: ${m.percentage}%`).join(", ");
        parts.push(`Matérias: ${materias}.`);
      }
      if (risk_alerts?.length) {
        const risks = risk_alerts.map((r: any) => `${r.tema} (${r.days_inactive} dias parado, ${Math.round(r.percentage)}%)`).join("; ");
        parts.push(`Alertas de risco: ${risks}.`);
      }
      const contextStr = parts.join(" ");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um tutor de medicina conciso e motivador. Com base no contexto do aluno (progresso, provas e alertas), dê uma recomendação curta (2-3 frases, máximo 280 caracteres) do que ele deveria estudar agora e por quê. Seja direto, prático e encorajador. Responda apenas com a recomendação, sem saudação nem formatação especial." },
            { role: "user", content: contextStr || "Aluno sem dados de progresso ainda. Dê uma dica genérica de estudos de medicina." },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      const recommendation = data.choices?.[0]?.message?.content?.trim() || "";
      return new Response(JSON.stringify({ recommendation }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // === FULL MODE (holistic tutor) ===
    console.log("[AITutorEngine]", "full mode requested");
    const startTime = Date.now();

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for data queries but use user's token for auth
    const { createClient: createSupaClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    
    // Verify user
    const supabaseAdmin = createSupaClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    // Create user-scoped client for RPC calls that use auth.uid()
    const supabaseUser = createSupaClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Aggregate snapshot using user-scoped client
    const snapshot = await aggregateSnapshot(supabaseUser, userId);
    console.log("[AITutorEngine]", "snapshot", JSON.stringify({ semester: snapshot.semester, progress: snapshot.progress.percentage, exams: snapshot.exams.length, gaps: snapshot.topGaps.length }));

    // Build prompt
    const snapshotStr = JSON.stringify(snapshot, null, 0);
    const systemPrompt = `${CONTEXT_PACK}

Você é um tutor/coach de estudos para estudantes de medicina no Brasil.
Você recebe um "StudentSnapshot" com dados reais de desempenho e agenda. Sua tarefa é gerar um plano excelente, específico e motivador, explicando claramente o que o aluno deve fazer e por quê, priorizando pelo que traz maior impacto no desempenho e pelo tempo até as provas.
Regras:
- Use português do Brasil.
- Seja objetivo, mas com explicações fortes e convincentes.
- Nunca invente dados: se algo não estiver no snapshot, diga "não informado" de forma elegante.
- Não ofereça diagnóstico/conduta clínica; foco em estudo.
- Priorize: prova mais próxima + maiores lacunas + consistência.
- Produza um plano "executável hoje" e um plano "da semana" com 5 dias.
- Use a tool generate_study_plan para retornar o plano estruturado.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `StudentSnapshot:\n${snapshotStr}\n\nGere o plano de estudos personalizado usando a tool generate_study_plan.` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "generate_study_plan" } },
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      const t = await aiResponse.text();
      console.error("[AITutorEngine]", "AI gateway error:", aiResponse.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    console.log("[AITutorEngine]", "latencyMs", latencyMs);

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      // Fallback: try to parse content as JSON
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          parsed.meta = { model: "google/gemini-3-flash-preview", latencyMs, usedOnlineResearch: false };
          return new Response(JSON.stringify({ plan: parsed }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch {
          // Return as quick recommendation fallback
          return new Response(JSON.stringify({ recommendation: content, plan: null }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ error: "No structured response from AI" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let plan: any;
    try {
      plan = typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
    } catch {
      console.error("[AITutorEngine]", "Failed to parse tool call arguments");
      return new Response(JSON.stringify({ error: "Invalid AI response format" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    plan.meta = { model: "google/gemini-3-flash-preview", latencyMs, usedOnlineResearch: false };

    console.log("[AITutorEngine]", "plan generated", `headline="${plan.headline?.substring(0, 50)}..."`, `steps=${plan.todayPlan?.steps?.length || 0}`);

    return new Response(JSON.stringify({ plan }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[AITutorEngine]", "error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
