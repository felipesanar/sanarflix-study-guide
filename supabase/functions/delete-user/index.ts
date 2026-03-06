import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEPENDENT_TABLES = [
  { table: 'user_roles', filters: [{ col: 'user_id' }, { col: 'granted_by' }] },
  { table: 'answer_progress_historico', filters: [{ col: 'user_id' }] },
  { table: 'answer_progress', filters: [{ col: 'user_id' }] },
  { table: 'simulados_finalizados', filters: [{ col: 'user_id' }] },
  { table: 'simulados_iniciados', filters: [{ col: 'user_id' }] },
  { table: 'user_progress_nodes', filters: [{ col: 'user_id' }] },
  { table: 'user_progress', filters: [{ col: 'user_id' }] },
  { table: 'study_progress', filters: [{ col: 'user_id' }] },
  { table: 'user_exams', filters: [{ col: 'user_id' }] },
  { table: 'user_sessions', filters: [{ col: 'user_id' }] },
  { table: 'page_views', filters: [{ col: 'user_id' }] },
  { table: 'analytics_events', filters: [{ col: 'user_id' }] },
  { table: 'aula_views', filters: [{ col: 'user_id' }] },
  { table: 'push_subscriptions', filters: [{ col: 'user_id' }] },
  { table: 'study_reminders', filters: [{ col: 'user_id' }] },
  { table: 'calendar_subjects', filters: [{ col: 'user_id' }] },
  { table: 'calendar_arrangements', filters: [{ col: 'user_id' }] },
  { table: 'announcements_viewed', filters: [{ col: 'user_id' }] },
  { table: 'sanarclass_views', filters: [{ col: 'user_id' }] },
  { table: 'performance_notifications_sent', filters: [{ col: 'user_id' }] },
  { table: 'supabase_to_metabase', filters: [{ col: 'id' }] },
];

async function deleteSingleUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const errors: string[] = [];

  // Delete dependent tables
  for (const { table, filters } of DEPENDENT_TABLES) {
    for (const { col } of filters) {
      const { error } = await supabaseAdmin.from(table).delete().eq(col, userId);
      if (error && !error.message.includes('0 rows')) {
        errors.push(`${table}.${col}: ${error.message}`);
      }
    }
  }

  // Delete from public.users
  const { error: publicError } = await supabaseAdmin.from('users').delete().eq('id', userId);
  if (publicError) {
    return { success: false, error: `public.users: ${publicError.message}` };
  }

  // Delete from auth.users
  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    return { success: false, error: `auth: ${authDeleteError.message}` };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is admin
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

    // Check admin role
    const { data: roles } = await supabaseAdmin.rpc('get_user_roles', { _user_id: caller.id });
    if (!roles?.includes('admin')) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { user_id, user_ids, ies_id } = body;

    // ──── Mode 1: Delete all users from an IES ────
    if (ies_id) {
      console.log(`[delete-user] Admin ${caller.email} deleting all users from IES ${ies_id}`);

      // Get all users from IES (excluding admins and caller)
      const { data: iesUsers, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id_ies', ies_id);

      if (fetchError) {
        return new Response(JSON.stringify({ error: `Erro ao buscar usuários da IES: ${fetchError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const allIds = (iesUsers || []).map(u => u.id).filter(id => id !== caller.id);

      // Filter out admins
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .in('user_id', allIds);

      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      const idsToDelete = allIds.filter(id => !adminIds.has(id));

      if (idsToDelete.length === 0) {
        return new Response(JSON.stringify({ success: true, results: { deleted: [], failed: [] } }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const deleted: string[] = [];
      const failed: { id: string; error: string }[] = [];

      for (const id of idsToDelete) {
        const result = await deleteSingleUser(supabaseAdmin, id);
        if (result.success) {
          deleted.push(id);
        } else {
          failed.push({ id, error: result.error || 'Unknown error' });
        }
      }

      console.log(`[delete-user] IES batch: ${deleted.length} deleted, ${failed.length} failed`);

      return new Response(JSON.stringify({ success: true, results: { deleted, failed } }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──── Mode 2: Delete multiple users by IDs ────
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      console.log(`[delete-user] Admin ${caller.email} batch deleting ${user_ids.length} users`);

      const deleted: string[] = [];
      const failed: { id: string; error: string }[] = [];

      for (const id of user_ids) {
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

      console.log(`[delete-user] Batch: ${deleted.length} deleted, ${failed.length} failed`);

      return new Response(JSON.stringify({ success: true, results: { deleted, failed } }), {
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
