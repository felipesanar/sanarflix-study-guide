import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { isAllowedOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (origin !== null && !isAllowedOrigin(origin)) {
    return new Response('forbidden', { status: 403 });
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'No authorization header' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verificação manual do JWT (padrão do projeto: verify_jwt = false)
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: 'Invalid token' }, 401);
    }

    // Somente admin pode falar com o Metabase
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) {
      return json({ error: 'Forbidden' }, 403);
    }

    const siteUrl = (Deno.env.get('METABASE_SITE_URL') ?? '').replace(/\/+$/, '');
    const apiKey = Deno.env.get('METABASE_API_KEY') ?? '';
    if (!siteUrl || !apiKey) {
      return json({ error: 'Metabase não configurado (METABASE_SITE_URL / METABASE_API_KEY)' }, 500);
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body?.action ?? 'ping';

    if (action !== 'ping') {
      // Consultas de dados ainda não habilitadas — apenas conexão configurada.
      return json({ error: `Ação não suportada: ${action}` }, 400);
    }

    // Teste de conexão: nenhum dado de negócio é lido.
    const res = await fetch(`${siteUrl}/api/user/current`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      return json(
        { ok: false, status: res.status, error: text.slice(0, 500) },
        res.status === 401 || res.status === 403 ? 401 : 502,
      );
    }

    const me = await res.json();
    return json({
      ok: true,
      site_url: siteUrl,
      metabase_user: { id: me?.id ?? null, email: me?.email ?? null, is_superuser: !!me?.is_superuser },
    });
  } catch (e) {
    console.error('metabase-proxy error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
