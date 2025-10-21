import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = buildCorsHeaders(origin)
  
  // Reject unauthorized origins
  if (!corsHeaders) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const { action, userId } = await req.json()
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let result

    switch (action) {
      case 'invalidate_sessions':
        // Invalidate all sessions for a user (useful after password change)
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required for session invalidation' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        // Sign out user from all devices
        const { error: signOutError } = await supabase.auth.admin.signOut(userId, 'global')
        
        if (signOutError) {
          throw signOutError
        }
        
        result = { message: 'All sessions invalidated successfully' }
        break

      case 'check_session_health':
        // Check if current session is still valid
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Invalid authorization header' }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: user, error: userError } = await supabase.auth.getUser(token)
        
        if (userError || !user) {
          result = { valid: false, error: 'Session invalid' }
        } else {
          result = { valid: true, user: user.user }
        }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    // SECURITY: Log detailed error server-side only, return generic message to client
    console.error('[Internal] Session security error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar requisição de segurança'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})