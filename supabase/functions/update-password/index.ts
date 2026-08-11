import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

// Input validation schema
const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(100, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
});

// SECURITY: Flexible CORS configuration with origin validation for known environments
const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) return false;
  return (
    origin.startsWith('http://localhost') ||
    origin.endsWith('.lovableproject.com') ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.app.github.dev') ||
    origin === 'https://guiadeestudos.sanar.com.br' ||
    origin === 'https://academy.sanar.com.br' ||
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);
  
  // Reject requests from unknown origins
  if (!corsHeaders) {
    return new Response('Forbidden', { status: 403 });
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    
    // Validate input with zod schema
    let validatedData;
    try {
      validatedData = passwordSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: errorMessages }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    const { newPassword } = validatedData;

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { data: userData, error: getUserError } = await supabase.auth.getUser(token)

    if (getUserError || !userData?.user) {
      // SECURITY: Log detailed error server-side only
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const userId = userData.user.id
    const currentMetadata = (userData.user.user_metadata ?? {}) as Record<string, unknown>

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password: newPassword })

    if (updateError) {
      // SECURITY: Log detailed error server-side only
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // A flag `must_change_password` é o que faz o app exibir "Primeiro acesso
    // detectado" + o modal bloqueante de troca de senha. Ela precisa ser
    // desligada aqui (mesclando o metadado existente, para não perder
    // full_name/id_ies/semestre), senão o aviso volta em todo login.
    let flagCleared = true
    if (currentMetadata.must_change_password !== false) {
      const clearFlag = () => supabase.auth.admin.updateUserById(userId, {
        user_metadata: { ...currentMetadata, must_change_password: false }
      })

      let { error: metaError } = await clearFlag()
      if (metaError) {
        // Uma nova tentativa no mesmo request: falha transitória do Auth admin
        // não deve deixar o usuário preso no modal de primeiro acesso.
        console.error('[Internal] Failed to clear must_change_password (attempt 1):', metaError)
        const retry = await clearFlag()
        metaError = retry.error
      }
      if (metaError) {
        console.error('[Internal] Failed to clear must_change_password (attempt 2):', metaError)
        flagCleared = false
      }
    }

    return new Response(
      JSON.stringify({ success: true, mustChangePasswordCleared: flagCleared }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )


  } catch (error) {
    // SECURITY: Log detailed error server-side only
    console.error('[Internal] Password update error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro ao processar requisição' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})