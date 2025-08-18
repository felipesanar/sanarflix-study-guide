import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Restrict CORS to approved domains only
const restrictedCorsHeaders = {
  'Access-Control-Allow-Origin': 'https://gvqvrmkizemwsasmupmo.lovableproject.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Trata a requisição "preflight" do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: restrictedCorsHeaders
    });
  }
  try {
    // Inicializa o cliente Supabase. É seguro usar a chave anônima aqui,
    // pois as operações de auth e a consulta à tabela 'users' devem ser permitidas pelas suas políticas (RLS).
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    // Extrai email e senha do corpo da requisição
    const { email, password, sessionToken } = await req.json();
    if (!email || (!password && !sessionToken)) {
      return new Response(JSON.stringify({
        error: 'Email e senha ou sessionToken são obrigatórios'
      }), {
        status: 400,
        headers: {
          ...restrictedCorsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ETAPA 1: Autenticar o usuário contra o `auth.users` do Supabase
    let sessionData, signInError, user;
    
    if (sessionToken) {
      // Magic link authentication - verify session token
      const { data: userData, error } = await supabase.auth.getUser(sessionToken);
      if (error || !userData.user) {
        return new Response(JSON.stringify({
          error: 'Session token inválido'
        }), {
          status: 401,
          headers: {
            ...restrictedCorsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      user = userData.user;
      sessionData = { user: userData.user, session: null };
      signInError = null;
    } else {
      // Password authentication
      const authResult = await supabase.auth.signInWithPassword({
        email: email,
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
            ...restrictedCorsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      user = sessionData.user;
    }
    // ETAPA 2: Verificar a flag 'must_change_password' nos metadados do usuário
    const needsPasswordChange = user.user_metadata?.must_change_password === true;
    // ETAPA 3: Buscar o perfil detalhado do usuário na tabela `public.users`
    // Usamos o `user.id` da sessão para encontrar o perfil correspondente.
    // Buscar perfil do usuário na tabela public.users (sem join)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('nome, cpf, id_ies, semestre')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Usuário autenticado sem perfil em public.users.', profileError);
      return new Response(JSON.stringify({
        error: 'Perfil do usuário não encontrado.'
      }), {
        status: 404,
        headers: {
          ...restrictedCorsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Buscar nome da IES se houver id_ies
    let iesNome: string | null = null;
    if (userProfile.id_ies) {
      const { data: iesData, error: iesError } = await supabase
        .from('ies')
        .select('nome')
        .eq('id', userProfile.id_ies)
        .single();
      if (iesError) {
        console.warn('Falha ao obter nome da IES:', iesError);
      } else {
        iesNome = iesData?.nome ?? null;
      }
    }
    // ETAPA 4: Construir e retornar a resposta completa para o front-end
    const responsePayload = {
      user: {
        id: user.id,
        email: user.email,
        nome: userProfile.nome,
        cpf: userProfile.cpf,
        id_ies: userProfile.id_ies,
        semestre: userProfile.semestre,
        ies_nome: iesNome
      },
      session: sessionData.session,
      needsPasswordChange: needsPasswordChange
    };
    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...restrictedCorsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Erro inesperado na função de login:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: {
        ...restrictedCorsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
