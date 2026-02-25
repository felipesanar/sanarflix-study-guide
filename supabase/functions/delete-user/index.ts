import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

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

    // Extract token and validate caller
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

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent self-deletion
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: 'Você não pode remover a si mesmo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[delete-user] Admin ${caller.email} removing user ${user_id}`);

    // Delete dependent tables in correct order (FK constraints)
    const dependentTables = [
      { table: 'user_roles', filters: [{ col: 'user_id', val: user_id }, { col: 'granted_by', val: user_id }] },
      { table: 'answer_progress_historico', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'answer_progress', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'simulados_finalizados', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'simulados_iniciados', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'user_progress_nodes', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'user_progress', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'study_progress', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'user_exams', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'user_sessions', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'page_views', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'analytics_events', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'aula_views', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'push_subscriptions', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'study_reminders', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'calendar_subjects', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'calendar_arrangements', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'announcements_viewed', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'sanarclass_views', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'performance_notifications_sent', filters: [{ col: 'user_id', val: user_id }] },
      { table: 'supabase_to_metabase', filters: [{ col: 'id', val: user_id }] },
    ];

    const errors: string[] = [];

    for (const { table, filters } of dependentTables) {
      for (const { col, val } of filters) {
        const { error } = await supabaseAdmin.from(table).delete().eq(col, val);
        if (error && !error.message.includes('0 rows')) {
          errors.push(`${table}.${col}: ${error.message}`);
        }
      }
    }

    // Delete from public.users
    const { error: publicError } = await supabaseAdmin.from('users').delete().eq('id', user_id);
    if (publicError) {
      console.error('[delete-user] public.users error:', publicError.message);
      return new Response(JSON.stringify({ 
        error: `Erro ao remover dados do usuário: ${publicError.message}`,
        cleanup_errors: errors.length > 0 ? errors : undefined,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authDeleteError) {
      console.error('[delete-user] auth.users error:', authDeleteError.message);
      return new Response(JSON.stringify({
        error: `Erro ao remover autenticação: ${authDeleteError.message}`,
        partial: true,
      }), {
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
