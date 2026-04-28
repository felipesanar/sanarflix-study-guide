// Edge Function: admin-import-simulado-responses
// Importa respostas de alunos para um simulado já cadastrado, a partir de planilha externa.
// Idempotente por (batch_id, user_id, simulado_id).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Resposta = 'A' | 'B' | 'C' | 'D' | 'E' | null;

interface InputRow {
  email: string;
  answers: Record<string, Resposta>; // chave: numero_questao (string)
  tempo_segundos?: number;
  saidas_aba?: number;
  finalizado_em?: string; // ISO
}

interface RequestPayload {
  simulado_id: string;
  conflict_mode: 'skip' | 'replace';
  source_label: string;
  default_finalizado_em?: string;
  default_tempo_segundos?: number;
  rows: InputRow[];
  dry_run?: boolean;
  batch_id?: string; // se omitido em modo real, criamos um novo
}

interface RowResult {
  email: string;
  status: 'imported' | 'skipped' | 'replaced' | 'failed' | 'preview_ok' | 'preview_warning' | 'preview_error';
  reason?: string;
  details?: Record<string, unknown>;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Auth: validar JWT manualmente ---
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'invalid_token' }, 401);
    }
    const adminId = userData.user.id;

    // Confirmar role admin
    const { data: roleRows } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId);
    const isAdmin = (roleRows ?? []).some((r: { role: string }) => r.role === 'admin');
    if (!isAdmin) {
      return jsonResponse({ error: 'forbidden', message: 'Requer role admin' }, 403);
    }

    // --- Parse e validação do payload ---
    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }

    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return jsonResponse({ error: 'invalid_payload', details: errors }, 400);
    }

    // --- Carregar simulado e questões ---
    const { data: simulado, error: simErr } = await supabaseAdmin
      .from('simulados_admin')
      .select('id, nome, ies_ids, duracao_minutos')
      .eq('id', payload.simulado_id)
      .maybeSingle();

    if (simErr || !simulado) {
      return jsonResponse({ error: 'simulado_not_found' }, 404);
    }

    const { data: qmap, error: qErr } = await supabaseAdmin.rpc(
      'admin_simulado_question_map',
      { p_simulado_id: payload.simulado_id },
    );
    if (qErr) return jsonResponse({ error: 'question_map_failed', details: qErr.message }, 500);

    type QuestionRow = {
      numero_questao: number;
      ordem: number;
      question_id: string;
      correta: string;
      anulada: boolean;
    };
    const questions: QuestionRow[] = (qmap ?? []) as QuestionRow[];

    if (questions.length === 0) {
      return jsonResponse({ error: 'simulado_without_questions' }, 400);
    }

    // Mapa numero_questao -> question
    const byNumero = new Map<number, QuestionRow>();
    for (const q of questions) {
      const n = Number(q.numero_questao);
      if (!Number.isNaN(n)) byNumero.set(n, q);
    }
    const expectedNumeros = Array.from(byNumero.keys()).sort((a, b) => a - b);

    // --- Resolver e-mails -> user_id ---
    const emails = payload.rows.map((r) => (r.email || '').trim().toLowerCase()).filter(Boolean);
    const uniqueEmails = Array.from(new Set(emails));

    const { data: users, error: usersErr } = await supabaseAdmin.rpc(
      'admin_lookup_users_by_email_in_ies',
      { p_ies_ids: simulado.ies_ids, p_emails: uniqueEmails },
    );
    if (usersErr) return jsonResponse({ error: 'lookup_users_failed', details: usersErr.message }, 500);

    type UserRow = { email: string; user_id: string; semestre: number | null; in_ies: boolean };
    const userByEmail = new Map<string, UserRow>();
    for (const u of (users ?? []) as UserRow[]) {
      userByEmail.set(u.email.toLowerCase(), u);
    }

    // Detectar e-mails duplicados na planilha
    const emailCount = new Map<string, number>();
    for (const e of emails) emailCount.set(e, (emailCount.get(e) ?? 0) + 1);

    // --- Modo DRY RUN: só validar, não escreve nada ---
    if (payload.dry_run) {
      const results: RowResult[] = [];
      let okCount = 0, warnCount = 0, errCount = 0;

      for (const row of payload.rows) {
        const email = (row.email ?? '').trim().toLowerCase();
        const validation = validateRow(row, email, byNumero, expectedNumeros, userByEmail, emailCount);
        results.push(validation);
        if (validation.status === 'preview_ok') okCount++;
        else if (validation.status === 'preview_warning') warnCount++;
        else errCount++;
      }

      // Verificar quem já tem finalização (warning, não erro)
      const userIds = Array.from(new Set(
        results
          .filter((r) => r.status !== 'preview_error')
          .map((r) => userByEmail.get(r.email)?.user_id)
          .filter(Boolean) as string[],
      ));
      let alreadyFinalizedSet = new Set<string>();
      if (userIds.length > 0) {
        const { data: fins } = await supabaseAdmin
          .from('simulados_finalizados')
          .select('user_id')
          .eq('simulado_id', payload.simulado_id)
          .in('user_id', userIds);
        alreadyFinalizedSet = new Set((fins ?? []).map((f: { user_id: string }) => f.user_id));
      }

      // Anotar warnings de "já finalizado"
      for (const r of results) {
        const u = userByEmail.get(r.email);
        if (r.status === 'preview_ok' && u && alreadyFinalizedSet.has(u.user_id)) {
          r.status = 'preview_warning';
          r.reason = 'already_finalized';
          okCount--; warnCount++;
        }
      }

      return jsonResponse({
        dry_run: true,
        simulado: { id: simulado.id, nome: simulado.nome, total_questoes: questions.length },
        summary: {
          total: results.length,
          ok: okCount,
          warning: warnCount,
          error: errCount,
          already_finalized: alreadyFinalizedSet.size,
        },
        results,
      });
    }

    // --- Modo REAL: cria batch e processa ---
    const batchId = payload.batch_id ?? crypto.randomUUID();

    // Cria registro de batch (se ainda não existir — idempotente por reenvio)
    const { error: batchErr } = await supabaseAdmin
      .from('admin_import_batches')
      .upsert(
        {
          id: batchId,
          simulado_id: payload.simulado_id,
          source_label: payload.source_label,
          conflict_mode: payload.conflict_mode,
          total_rows: payload.rows.length,
          status: 'in_progress',
          created_by: adminId,
        },
        { onConflict: 'id', ignoreDuplicates: false },
      );
    if (batchErr) return jsonResponse({ error: 'batch_create_failed', details: batchErr.message }, 500);

    const results: RowResult[] = [];
    let imported = 0, skipped = 0, replaced = 0, failed = 0;

    for (const row of payload.rows) {
      const email = (row.email ?? '').trim().toLowerCase();
      const v = validateRow(row, email, byNumero, expectedNumeros, userByEmail, emailCount);
      if (v.status === 'preview_error') {
        results.push({ email, status: 'failed', reason: v.reason, details: v.details });
        failed++;
        // registrar falha
        await supabaseAdmin.from('admin_import_records').upsert({
          batch_id: batchId,
          user_id: userByEmail.get(email)?.user_id ?? '00000000-0000-0000-0000-000000000000',
          simulado_id: payload.simulado_id,
          status: 'failed',
          reason: v.reason ?? 'validation_failed',
        }, { onConflict: 'batch_id,user_id,simulado_id', ignoreDuplicates: true });
        continue;
      }

      const user = userByEmail.get(email)!;
      // Montar payload de respostas com correct calculado
      const answersPayload = expectedNumeros.map((n) => {
        const q = byNumero.get(n)!;
        const raw = row.answers[String(n)] ?? row.answers[String(n).padStart(2, '0')] ?? null;
        const resposta: Resposta = normalizeResposta(raw);
        const correct = q.anulada ? true : (resposta !== null && resposta === q.correta);
        return { question_id: q.question_id, resposta, correct };
      });

      const finalizadoEm = row.finalizado_em ?? payload.default_finalizado_em ?? new Date().toISOString();
      const tempoSeg = row.tempo_segundos ?? payload.default_tempo_segundos ?? (simulado.duracao_minutos ?? 180) * 60;
      const saidasAba = row.saidas_aba ?? 0;

      try {
        const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
          'admin_import_one_response',
          {
            p_batch_id: batchId,
            p_simulado_id: payload.simulado_id,
            p_user_id: user.user_id,
            p_answers: answersPayload,
            p_tempo_segundos: tempoSeg,
            p_saidas_aba: saidasAba,
            p_finalizado_em: finalizadoEm,
            p_conflict_mode: payload.conflict_mode,
          },
        );
        if (rpcErr) throw rpcErr;
        const status = (rpcResult as { status: string })?.status;
        if (status === 'imported') {
          imported++;
          results.push({ email, status: 'imported' });
        } else if (status === 'replaced') {
          replaced++;
          results.push({ email, status: 'replaced' });
        } else if (status === 'skipped') {
          skipped++;
          results.push({ email, status: 'skipped', reason: 'already_finalized' });
        } else if (status === 'already_in_batch') {
          // idempotência: contabilizar como o que já foi
          const { data: prev } = await supabaseAdmin
            .from('admin_import_records')
            .select('status')
            .eq('batch_id', batchId)
            .eq('user_id', user.user_id)
            .eq('simulado_id', payload.simulado_id)
            .maybeSingle();
          const prevStatus = (prev as { status: string } | null)?.status ?? 'imported';
          results.push({ email, status: prevStatus as RowResult['status'], reason: 'already_processed' });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[admin-import] Erro no aluno', email, msg);
        failed++;
        results.push({ email, status: 'failed', reason: msg });
        await supabaseAdmin.from('admin_import_records').upsert({
          batch_id: batchId,
          user_id: user.user_id,
          simulado_id: payload.simulado_id,
          status: 'failed',
          reason: msg.slice(0, 500),
        }, { onConflict: 'batch_id,user_id,simulado_id', ignoreDuplicates: true });
      }
    }

    // Atualizar contagens e status do batch
    await supabaseAdmin
      .from('admin_import_batches')
      .update({
        imported_count: imported,
        skipped_count: skipped,
        replaced_count: replaced,
        failed_count: failed,
        status: 'completed',
        finished_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    // Audit log
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      action: 'import_simulado_responses',
      metadata: {
        batch_id: batchId,
        simulado_id: payload.simulado_id,
        source_label: payload.source_label,
        conflict_mode: payload.conflict_mode,
        total: payload.rows.length,
        imported, skipped, replaced, failed,
      },
    });

    return jsonResponse({
      batch_id: batchId,
      summary: {
        total: payload.rows.length,
        imported, skipped, replaced, failed,
      },
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin-import] erro fatal', msg);
    return jsonResponse({ error: 'internal_error', message: msg }, 500);
  }
});

// ===== Helpers =====

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validatePayload(p: RequestPayload): string[] {
  const errs: string[] = [];
  if (!p?.simulado_id || typeof p.simulado_id !== 'string') errs.push('simulado_id obrigatório');
  if (!['skip', 'replace'].includes(p?.conflict_mode)) errs.push('conflict_mode inválido');
  if (!p?.source_label || typeof p.source_label !== 'string') errs.push('source_label obrigatório');
  if (!Array.isArray(p?.rows)) errs.push('rows deve ser array');
  else if (p.rows.length === 0) errs.push('rows vazio');
  else if (p.rows.length > 200) errs.push('máximo 200 alunos por chamada (faça em lotes)');
  return errs;
}

function normalizeResposta(raw: unknown): Resposta {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === '' || s === '-' || s === '?' || s === 'BRANCO' || s === 'NULL' || s === '0') return null;
  // Aceita "A", "A)", "ALTERNATIVA A"
  const m = s.match(/[A-E]/);
  if (m && ['A', 'B', 'C', 'D', 'E'].includes(m[0])) return m[0] as Resposta;
  return null;
}

function validateRow(
  row: InputRow,
  email: string,
  byNumero: Map<number, { question_id: string; correta: string; anulada: boolean }>,
  expectedNumeros: number[],
  userByEmail: Map<string, { user_id: string; in_ies: boolean }>,
  emailCount: Map<string, number>,
): RowResult {
  if (!email || !email.includes('@')) {
    return { email, status: 'preview_error', reason: 'invalid_email' };
  }
  if ((emailCount.get(email) ?? 0) > 1) {
    return { email, status: 'preview_error', reason: 'duplicate_email_in_file' };
  }
  const user = userByEmail.get(email);
  if (!user) {
    return { email, status: 'preview_error', reason: 'user_not_found' };
  }
  if (!user.in_ies) {
    return { email, status: 'preview_error', reason: 'user_not_in_ies' };
  }
  if (!row.answers || typeof row.answers !== 'object') {
    return { email, status: 'preview_error', reason: 'answers_missing' };
  }

  // Normaliza chaves do answers para números
  const providedNumeros = new Set<number>();
  for (const k of Object.keys(row.answers)) {
    const n = Number(String(k).trim());
    if (Number.isFinite(n)) providedNumeros.add(n);
  }

  const missing = expectedNumeros.filter((n) => !providedNumeros.has(n));
  const extra = Array.from(providedNumeros).filter((n) => !byNumero.has(n));

  if (extra.length > 0) {
    return {
      email,
      status: 'preview_error',
      reason: 'invalid_question_numbers',
      details: { extra: extra.slice(0, 10) },
    };
  }
  if (missing.length > 0) {
    // Permite missing como warning (questões em branco serão null), mas se faltar tudo, é erro
    if (missing.length === expectedNumeros.length) {
      return { email, status: 'preview_error', reason: 'no_answers' };
    }
    return {
      email,
      status: 'preview_warning',
      reason: 'partial_answers',
      details: { missing_count: missing.length },
    };
  }
  return { email, status: 'preview_ok' };
}
