import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { maskEmail } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const FN_NAME = 'delete-user';

const DEPENDENT_TABLES = [
  { table: 'user_roles', filters: ['user_id', 'granted_by'] },
  { table: 'answer_progress_historico', filters: ['user_id'] },
  { table: 'answer_progress', filters: ['user_id'] },
  { table: 'simulados_finalizados', filters: ['user_id'] },
  { table: 'simulados_iniciados', filters: ['user_id'] },
  { table: 'user_progress_nodes', filters: ['user_id'] },
  { table: 'user_progress', filters: ['user_id'] },
  { table: 'study_progress', filters: ['user_id'] },
  { table: 'user_exams', filters: ['user_id'] },
  { table: 'user_sessions', filters: ['user_id'] },
  { table: 'page_views', filters: ['user_id'] },
  { table: 'analytics_events', filters: ['user_id'] },
  { table: 'aula_views', filters: ['user_id'] },
  { table: 'push_subscriptions', filters: ['user_id'] },
  { table: 'study_reminders', filters: ['user_id'] },
  { table: 'calendar_subjects', filters: ['user_id'] },
  { table: 'calendar_arrangements', filters: ['user_id'] },
  { table: 'announcements_viewed', filters: ['user_id'] },
  { table: 'sanarclass_views', filters: ['user_id'] },
  { table: 'performance_notifications_sent', filters: ['user_id'] },
  { table: 'error_notebook_entries', filters: ['user_id'] },
  // consumo_metabase references supabase_to_metabase via FK — must be deleted first
  { table: 'consumo_metabase', filters: ['id'] },
  { table: 'supabase_to_metabase', filters: ['id'] },
  { table: 'resultados_alunos_tri', filters: ['student_id'] },
];

// Max users per single invocation to avoid CPU timeout
// Each user requires ~23 DB calls, so keep this low
const MAX_BATCH_SIZE = 3;

function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (!xff) return null;
  return xff.split(',')[0]?.trim() || null;
}

async function auditDelete(
  supabaseAdmin: ReturnType<typeof createClient>,
  adminId: string,
  targetUserId: string,
  email: string | null | undefined,
  modo: 'single' | 'lote',
  ip: string | null,
) {
  try {
    const { error } = await supabaseAdmin.from('admin_audit_log').insert({
      admin_id: adminId,
      action: 'delete_user',
      target_user_id: targetUserId,
      metadata: { email: email ?? null, modo, ip },
    });
    if (error) console.warn('[delete-user] audit log insert failed:', error.message);
  } catch (e) {
    console.warn('[delete-user] audit log exception:', (e as Error).message);
  }
}

async function deleteSingleUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  // First, resolve metabase mapping (consumo_metabase.id = supabase_to_metabase.user_id_metabase)
  // Must delete consumo_metabase before supabase_to_metabase due to FK
  const { data: stmRow } = await supabaseAdmin
    .from('supabase_to_metabase')
    .select('user_id_metabase')
    .eq('id', userId)
    .maybeSingle();

  if (stmRow?.user_id_metabase) {
    const { error } = await supabaseAdmin
      .from('consumo_metabase')
      .delete()
      .eq('id', stmRow.user_id_metabase);
    if (error) {
      console.warn(`[delete-user] consumo_metabase cleanup warning: ${error.message}`);
    }
  }

  for (const { table, filters } of DEPENDENT_TABLES) {
    // Skip consumo_metabase — already handled above with proper key lookup
    if (table === 'consumo_metabase') continue;

    for (const col of filters) {
      const { error } = await supabaseAdmin.from(table).delete().eq(col, userId);
      if (error && !error.message.includes('0 rows')) {
        console.warn(`[delete-user] ${table}.${col} cleanup warning: ${error.message}`);
      }
    }
  }

  const { error: publicError } = await supabaseAdmin.from('users').delete().eq('id', userId);
  if (publicError) {
    return { success: false, error: `public.users: ${publicError.message}` };
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return { success: false, error: `auth: ${authDeleteError.message}` };
  }

  return { success: true };
}

/**
 * Paginated fetch of user IDs from an IES.
 * Accepts a `cursor` (offset) and `page_size` to avoid loading everything at once.
 */
async function fetchIesUserIdsPage(
  supabaseAdmin: ReturnType<typeof createClient>,
  iesId: string,
  cursor: number,
  pageSize: number,
  semestre?: number,
): Promise<{ ids: string[]; hasMore: boolean }> {
  let query = supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_ies', iesId);

  if (semestre !== undefined && semestre !== null) {
    query = query.eq('semestre', semestre);
  }

  const { data, error } = await query.range(cursor, cursor + pageSize - 1);

  if (error) throw error;
  const ids = (data || []).map(u => u.id);
  return { ids, hasMore: ids.length === pageSize };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (!corsHeaders) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Rate limit por admin/IP — operação destrutiva sensível.
    const rl = await checkRateLimit(req, { key: FN_NAME, limitPerMin: 20 });
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabaseAdmin.rpc('get_user_roles', { _user_id: caller.id });
    if (!roles?.includes('admin')) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { user_id, user_ids, ies_id } = body;

    // ──── Mode 1: Paginated resolve of IES user IDs ────
    // Client sends { ies_id, resolve_only: true, cursor?: number, page_size?: number }
    // Returns a page of deletable IDs so the client can iterate without CPU timeout
    if (ies_id && body.resolve_only) {
      const cursor = body.cursor ?? 0;
      const pageSize = Math.min(body.page_size ?? 500, 500);

      console.log(`[delete-user] Resolving users for IES ${ies_id} (cursor=${cursor}, pageSize=${pageSize})`);

      const semestre = body.semestre ? parseInt(body.semestre) : undefined;
      const { ids: rawIds, hasMore } = await fetchIesUserIdsPage(supabaseAdmin, ies_id, cursor, pageSize, semestre);

      // Filter out self and admins
      const filteredIds = rawIds.filter(id => id !== caller.id);

      // Check admin status only for this page (small set, fast)
      let deletableIds = filteredIds;
      if (filteredIds.length > 0) {
        const { data: adminRoles } = await supabaseAdmin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .in('user_id', filteredIds);

        const adminIds = new Set((adminRoles || []).map(r => r.user_id));
        deletableIds = filteredIds.filter(id => !adminIds.has(id));
      }

      return new Response(JSON.stringify({
        success: true,
        user_ids: deletableIds,
        has_more: hasMore,
        next_cursor: hasMore ? cursor + pageSize : null,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──── Mode 2: Delete batch of user IDs (capped at MAX_BATCH_SIZE) ────
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      const batch = user_ids.slice(0, MAX_BATCH_SIZE);
      if (user_ids.length > MAX_BATCH_SIZE) {
        console.log(`[delete-user] Capping batch from ${user_ids.length} to ${MAX_BATCH_SIZE}`);
      }

      console.log(`[delete-user] Admin ${maskEmail(caller.email)} batch deleting ${batch.length} users`);

      // Pre-fetch user details for failure reporting
      const { data: userDetails } = await supabaseAdmin
        .from('users')
        .select('id, nome, email')
        .in('id', batch);

      const detailsMap = new Map(
        (userDetails || []).map(u => [u.id, { nome: u.nome, email: u.email }])
      );

      const deleted: string[] = [];
      const failed: { id: string; nome: string; email: string; error: string }[] = [];

      for (const id of batch) {
        if (id === caller.id) {
          const info = detailsMap.get(id);
          failed.push({ id, nome: info?.nome || '', email: info?.email || '', error: 'Não pode remover a si mesmo' });
          continue;
        }
        const result = await deleteSingleUser(supabaseAdmin, id);
        if (result.success) {
          deleted.push(id);
        } else {
          const info = detailsMap.get(id);
          failed.push({ id, nome: info?.nome || '', email: info?.email || '', error: result.error || 'Erro desconhecido' });
        }
      }

      console.log(`[delete-user] Batch done: ${deleted.length} deleted, ${failed.length} failed`);
      if (failed.length > 0) {
        console.warn(`[delete-user] Failed users: ${failed.map(f => `${maskEmail(f.email)}: ${f.error}`).join('; ')}`);
      }

      return new Response(JSON.stringify({
        success: true,
        results: { deleted, failed },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──── Mode 3: Delete single user (backwards compatible) ────
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id, user_ids ou ies_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Você não pode remover a si mesmo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-user] Admin ${maskEmail(caller.email)} removing user ${user_id}`);

    const result = await deleteSingleUser(supabaseAdmin, user_id);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-user] User ${user_id} removed successfully`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[delete-user] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
