import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json()

    console.log('Login attempt for email:', email)

    // Query user from database with IES join
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        nome,
        cpf,
        id_ies,
        semestre,
        senha_hash,
        ies!inner(nome)
      `)
      .eq('email', email)
      .single()

    if (userError || !user) {
      console.log('User not found:', userError)
      return new Response(
        JSON.stringify({ error: 'Email ou senha inválidos' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if password is the default random hash (needs password change)
    const needsPasswordChange = user.senha_hash.length === 64 // Default random hash

    if (!needsPasswordChange) {
      // Verify password using pgcrypto
      const { data: passwordCheck, error: passwordError } = await supabase
        .rpc('crypt', { 
          password: password, 
          salt: user.senha_hash 
        })

      if (passwordError || passwordCheck !== user.senha_hash) {
        console.log('Invalid password')
        return new Response(
          JSON.stringify({ error: 'Email ou senha inválidos' }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      // For first login, accept any password and require password change
      console.log('First login detected, password change required')
    }

    // Create auth session
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        data: {
          user_id: user.id,
          nome: user.nome,
          cpf: user.cpf,
          id_ies: user.id_ies,
          semestre: user.semestre,
          ies_nome: user.ies.nome
        }
      }
    })

    if (authError) {
      console.log('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Erro interno do servidor' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return user data and session info
    const userData = {
      id: user.id,
      email: user.email,
      nome: user.nome,
      cpf: user.cpf,
      id_ies: user.id_ies,
      ies_nome: user.ies.nome,
      semestre: user.semestre
    }

    return new Response(
      JSON.stringify({ 
        user: userData,
        needsPasswordChange,
        session: authData
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Login error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})