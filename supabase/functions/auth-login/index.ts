import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SECURITY: Flexible CORS configuration with origin validation for known environments
const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) return false;
  return (
    origin.startsWith('http://localhost') ||
    origin.endsWith('.lovableproject.com') ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.app.github.dev') ||
    origin === 'https://guiadeestudos.sanar.com.br' ||
    origin === 'https://sanarflix-study-guide.lovable.app' ||
    origin === 'https://preview--sanarflix-study-guide.lovable.app'
  );
};

const buildCorsHeaders = (origin?: string | null): Record<string, string> | null => {
  if (!isAllowedOrigin(origin)) {
    return null; // Reject unknown origins
  }
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
};
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);
  
  // Reject requests from unknown origins
  if (!corsHeaders) {
    return new Response('Forbidden', { status: 403 });
  }

  // Trata a requisição "preflight" do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Inicializa dois clientes Supabase:
    // 1. Cliente anônimo para autenticação
    const supabaseAnon = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    // 2. Cliente service_role para consultas que precisam bypassa RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    // Extrai email e senha do corpo da requisição
    const { email, password, sessionToken } = await req.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || (!password && !sessionToken)) {
      return new Response(JSON.stringify({
        error: 'Email e senha ou sessionToken são obrigatórios'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ETAPA 1: Autenticar o usuário contra o `auth.users` do Supabase
    let sessionData, signInError, user;
    
    if (sessionToken) {
      // Magic link authentication
      const { data: userData, error } = await supabaseAnon.auth.getUser(sessionToken);
      if (error || !userData.user) {
        return new Response(JSON.stringify({
          error: 'Session token inválido'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      user = userData.user;
      sessionData = { user: userData.user, session: null };
      signInError = null;
    } else {
      // Password authentication
      const authResult = await supabaseAnon.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      });
      sessionData = authResult.data;
      signInError = authResult.error;
      
      // Se houver um erro de autenticação (email não existe, senha incorreta), retorna 401.
      if (signInError) {
        return new Response(JSON.stringify({
          error: 'Email ou senha inválidos'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      user = sessionData.user;
    }

    if (!user) {
      return new Response(JSON.stringify({
        error: 'User not found in session'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ETAPA 2: Verificar a flag 'must_change_password' nos metadados do usuário
    const needsPasswordChange = user.user_metadata?.must_change_password === true;
    // ETAPA 3: Buscar o perfil detalhado do usuário na tabela `public.users`
    // Usamos o cliente admin para bypassar RLS, já que a edge function precisa acessar dados do usuário
    // SECURITY: Reduced PII exposure - only fetch necessary fields
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('nome, id_ies, semestre')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      // SECURITY: Log detailed error server-side only
      console.error('[Internal] Profile fetch error:', profileError);
      return new Response(JSON.stringify({
        error: 'Erro ao processar autenticação.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!userProfile) {
      // SECURITY: Log detailed info server-side only
      console.error('[Internal] User authenticated without profile:', {
        user_id: user.id,
        email: user.email
      });
      return new Response(JSON.stringify({
        error: 'Perfil não encontrado. Contate o suporte.'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Buscar nome da IES se houver id_ies
    let iesNome: string | null = null;
    if (userProfile.id_ies) {
      const { data: iesData, error: iesError } = await supabaseAdmin
        .from('ies')
        .select('nome')
        .eq('id', userProfile.id_ies)
        .single();
      if (iesError) {
        // SECURITY: Log detailed error server-side only
        console.warn('[Internal] IES fetch error:', iesError);
      } else {
        iesNome = iesData?.nome ?? null;
      }
    }
    
    // Buscar roles do usuário
    let userRoles: string[] = [];
    try {
      const { data: rolesData, error: rolesError } = await supabaseAdmin.rpc('get_user_roles', {
        _user_id: user.id
      });
      if (!rolesError && rolesData) {
        userRoles = rolesData;
      }
    } catch (roleError) {
      // SECURITY: Log detailed error server-side only
      console.warn('[Internal] Role fetch error:', roleError);
    }
    
    // ETAPA 4: Construir e retornar a resposta completa para o front-end
    // SECURITY: Removed CPF from response to reduce PII exposure
    const responsePayload = {
      user: {
        id: user.id,
        email: user.email,
        nome: userProfile.nome,
        id_ies: userProfile.id_ies,
        semestre: userProfile.semestre,
        ies_nome: iesNome,
        roles: userRoles
        // CPF removed from response for security
      },
      session: sessionData.session,
      needsPasswordChange: needsPasswordChange
    };
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // SECURITY: Log detailed error server-side only, return generic message to client
    console.error('[Internal] Login function error:', error);
    return new Response(JSON.stringify({
      error: 'Erro ao processar login. Tente novamente.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
