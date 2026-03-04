import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, corsHeaders } from "../_shared/cors.ts";

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

    const { progress, top_materias, risk_alerts, next_exam } = await req.json();

    // Build compact context string
    const parts: string[] = [];
    
    if (progress) {
      parts.push(`Progresso geral: ${progress.percentage}% (${progress.completed}/${progress.total} aulas concluídas).`);
    }

    if (next_exam) {
      parts.push(`Próxima prova: ${next_exam.materia} em ${next_exam.days_remaining} dias (progresso: ${next_exam.progress ?? 'desconhecido'}%).`);
    }

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
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você é um tutor de medicina conciso e motivador. Com base no contexto do aluno (progresso, provas e alertas), dê uma recomendação curta (2-3 frases, máximo 280 caracteres) do que ele deveria estudar agora e por quê. Seja direto, prático e encorajador. Responda apenas com a recomendação, sem saudação nem formatação especial.",
          },
          {
            role: "user",
            content: contextStr || "Aluno sem dados de progresso ainda. Dê uma dica genérica de estudos de medicina.",
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const recommendation = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ recommendation }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-study-recommendation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
