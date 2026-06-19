// Caderno de Erros — lembrete diário de revisão (SCAFFOLD, Fase 4).
//
// Estado: DESATIVADO até o time configurar. Para ativar é preciso:
//   1) Secrets: CADERNO_REMINDERS_SECRET (gate interno) e CADERNO_REMINDER_WORKFLOW
//      (nome do workflow Novu). Enquanto CADERNO_REMINDER_WORKFLOW não existir, a
//      função roda em modo no-op (não dispara nada) e responde 200.
//   2) Agendamento: pg_cron + pg_net chamando esta função 1×/dia (ex.: 08:00 BRT),
//      enviando o header x-internal-secret = CADERNO_REMINDERS_SECRET.
//   3) Migração 20260619140000_caderno_notification_preferences.sql aplicada.
//
// Não há PII no log. Dispara via Kong/Novu (sem API key) usando triggerNovuEvent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';
import { triggerNovuEvent } from '../_shared/novu.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// comparação de segredo em tempo ~constante
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // gate interno (cron envia o segredo)
  const secret = Deno.env.get('CADERNO_REMINDERS_SECRET') ?? '';
  const provided = req.headers.get('x-internal-secret') ?? '';
  if (!secret || !safeEqual(secret, provided)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const workflow = Deno.env.get('CADERNO_REMINDER_WORKFLOW') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // entradas devidas hoje, não bloqueadas, não dominadas
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('error_notebook_entries')
    .select('user_id, last_review_outcome')
    .lte('srs_due_at', nowIso)
    .is('deleted_at', null)
    .is('mastered_at', null);
  if (error) return json({ error: error.message }, 500);

  // conta devidas por usuário (exclui bloqueados)
  const counts = new Map<string, number>();
  for (const row of due ?? []) {
    const blocked = row.last_review_outcome === 'awaiting_lesson' || row.last_review_outcome === 'leech_blocked';
    if (blocked) continue;
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  const userIds = [...counts.keys()];

  // modo no-op até o workflow estar configurado
  if (!workflow) {
    return json({ mode: 'noop_unconfigured', users_with_due: userIds.length });
  }
  if (userIds.length === 0) return json({ mode: 'sent', sent: 0 });

  // preferências (opt-out) + perfis (email/nome)
  const [{ data: prefs }, { data: profiles }] = await Promise.all([
    supabase.from('notification_preferences').select('user_id, caderno_daily_review').in('user_id', userIds),
    supabase.from('profiles').select('id, email, nome').in('id', userIds),
  ]);
  const optedOut = new Set((prefs ?? []).filter((p) => p.caderno_daily_review === false).map((p) => p.user_id));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  let sent = 0;
  for (const uid of userIds) {
    if (optedOut.has(uid)) continue;
    const prof = profileById.get(uid);
    const email = (prof as { email?: string } | undefined)?.email;
    if (!email) continue;
    const nome = ((prof as { nome?: string } | undefined)?.nome ?? '').trim();
    const count = counts.get(uid) ?? 0;
    const res = await triggerNovuEvent({
      name: workflow,
      to: [{ subscriberId: uid, email, firstName: nome || undefined }],
      payload: { email, nome, due_count: count, cta_url: '/caderno-de-erros/revisao' },
    });
    if (res.ok) sent++;
  }

  return json({ mode: 'sent', sent, candidates: userIds.length });
});
