// Edge function: notifica no Slack quando um novo feedback de aluno é criado.
// Disparada por trigger AFTER INSERT em public.user_feedback via pg_net.
// - verify_jwt = false (chamada interna a partir do banco)
// - Busca o feedback + dados do aluno via service role
// - Só posta se o feedback foi criado nos últimos 5 minutos (proteção anti-replay)
// - Canal configurável via env SLACK_FEEDBACK_CHANNEL (default: #suporte-sanarflix-academy)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAdminClient } from "../_shared/auth.ts";

const SLACK_GATEWAY = "https://connector-gateway.lovable.dev/slack/api";

const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  bug: { emoji: "🐛", label: "Problema" },
  suggestion: { emoji: "💡", label: "Sugestão" },
  feature_request: { emoji: "✨", label: "Pedido de funcionalidade" },
  praise: { emoji: "💚", label: "Elogio" },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const feedbackId: string | undefined = body?.feedback_id ?? body?.record?.id;

    if (!feedbackId) {
      return new Response(JSON.stringify({ error: "feedback_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createAdminClient();

    const { data: fb, error: fbErr } = await admin
      .from("user_feedback")
      .select("id, user_id, category, message, page_url, viewport, screenshot_url, semestre, ies_id, user_role, created_at")
      .eq("id", feedbackId)
      .maybeSingle();

    if (fbErr || !fb) {
      console.error("[notify-feedback-slack] feedback not found", fbErr);
      return new Response(JSON.stringify({ error: "feedback not found" }), { status: 404 });
    }

    // Anti-replay: só notifica feedback recente (últimos 5 min)
    const createdAt = new Date(fb.created_at).getTime();
    if (Date.now() - createdAt > 5 * 60 * 1000) {
      return new Response(JSON.stringify({ skipped: "too_old" }), { status: 200 });
    }

    // Dados do aluno
    const { data: userRow } = await admin
      .from("users")
      .select("nome, email")
      .eq("id", fb.user_id)
      .maybeSingle();

    // Nome da IES
    let iesNome: string | null = null;
    if (fb.ies_id) {
      const { data: iesRow } = await admin
        .from("ies")
        .select("nome")
        .eq("id", fb.ies_id)
        .maybeSingle();
      iesNome = iesRow?.nome ?? null;
    }

    // Signed URL do screenshot (7 dias)
    let screenshotUrl: string | null = null;
    if (fb.screenshot_url) {
      const { data: signed } = await admin.storage
        .from("feedback-screenshots")
        .createSignedUrl(fb.screenshot_url, 60 * 60 * 24 * 7);
      screenshotUrl = signed?.signedUrl ?? null;
    }

    const cat = CATEGORY_LABELS[fb.category] ?? { emoji: "📝", label: fb.category };
    const nome = userRow?.nome ?? "Aluno";
    const email = userRow?.email ?? "—";
    const ies = iesNome ?? "—";
    const sem = fb.semestre != null ? `${fb.semestre}º` : "—";
    const page = fb.page_url ?? "—";
    const viewport = fb.viewport ?? "—";

    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `${cat.emoji} Novo feedback — ${cat.label}`, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `>>> ${fb.message.slice(0, 2900)}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Aluno:*\n${nome}` },
          { type: "mrkdwn", text: `*Email:*\n${email}` },
          { type: "mrkdwn", text: `*IES:*\n${ies}` },
          { type: "mrkdwn", text: `*Semestre:*\n${sem}` },
          { type: "mrkdwn", text: `*Página:*\n\`${page}\`` },
          { type: "mrkdwn", text: `*Viewport:*\n${viewport}` },
        ],
      },
    ];

    if (screenshotUrl) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `📎 <${screenshotUrl}|Ver print anexado>` }],
      });
    }

    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_id: \`${fb.id}\` • ${new Date(fb.created_at).toLocaleString("pt-BR")}_` }],
    });

    const channel = Deno.env.get("SLACK_FEEDBACK_CHANNEL") ?? "#suporte-sanarflix-academy";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const slackKey = Deno.env.get("SLACK_API_KEY");

    if (!lovableKey || !slackKey) {
      console.error("[notify-feedback-slack] missing gateway credentials");
      return new Response(JSON.stringify({ error: "slack not configured" }), { status: 500 });
    }

    const slackRes = await fetch(`${SLACK_GATEWAY}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": slackKey,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel,
        text: `${cat.emoji} Novo feedback (${cat.label}) de ${nome}`,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });

    const slackBody = await slackRes.text();
    let slackJson: any = {};
    try { slackJson = JSON.parse(slackBody); } catch { /* keep text */ }

    if (!slackRes.ok || slackJson?.ok === false) {
      console.error(`[notify-feedback-slack] slack error [${slackRes.status}]:`, slackBody);
      return new Response(
        JSON.stringify({ error: "slack post failed", status: slackRes.status, details: slackJson || slackBody }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, ts: slackJson.ts, channel: slackJson.channel }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[notify-feedback-slack] unexpected", e);
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), { status: 500 });
  }
});
