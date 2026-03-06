import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

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
  // consumo_metabase references supabase_to_metabase via FK — must be deleted first
  { table: 'consumo_metabase', filters: ['id'] },
  { table: 'supabase_to_metabase', filters: ['id'] },
];

// Max users per single invocation to avoid CPU timeout
// Each user requires ~23 DB calls, so keep this low
const MAX_BATCH_SIZE = 3;

async function deleteSingleUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  for (const { table, filters } of DEPENDENT_TABLES) {
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
): Promise<{ ids: string[]; hasMore: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id_ies', iesId)
    .range(cursor, cursor + pageSize - 1);

  if (error) throw error;
  const ids = (data || []).map(u => u.id);
  return { ids, hasMore: ids.length === pageSize };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

      const { ids: rawIds, hasMore } = await fetchIesUserIdsPage(supabaseAdmin, ies_id, cursor, pageSize);

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

      console.log(`[delete-user] Admin ${caller.email} batch deleting ${batch.length} users`);

      const deleted: string[] = [];
      const failed: { id: string; error: string }[] = [];

      for (const id of batch) {
        if (id === caller.id) {
          failed.push({ id, error: 'Não pode remover a si mesmo' });
          continue;
        }
        const result = await deleteSingleUser(supabaseAdmin, id);
        if (result.success) {
          deleted.push(id);
        } else {
          failed.push({ id, error: result.error || 'Unknown error' });
        }
      }

      console.log(`[delete-user] Batch done: ${deleted.length} deleted, ${failed.length} failed`);

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

    console.log(`[delete-user] Admin ${caller.email} removing user ${user_id}`);

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
