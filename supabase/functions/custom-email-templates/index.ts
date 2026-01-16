import React from 'https://esm.sh/react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1,react-dom@18.3.1'
import { MagicLinkEmail } from './_templates/magic-link.tsx'
import { ResetPasswordEmail } from './_templates/reset-password.tsx'
import { InviteUserEmail } from './_templates/invite-user.tsx'


const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const wh = new Webhook(hookSecret)

    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    let html: string
    let subject: string

    // Determine which template to use based on email_action_type
    if (email_action_type === 'recovery') {
      html = await renderAsync(
        React.createElement(ResetPasswordEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to: redirect_to || 'https://sanarflix-study-guide.lovable.app/reset-password',
          email_action_type,
        })
      )
      subject = 'Redefina sua senha - SanarFlix Academy'
    }

    else if (email_action_type === 'invite') {
      // NOVO: Convite de usuário
      html = await renderAsync(React.createElement(InviteUserEmail, {
        supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
        token,
        token_hash,
        redirect_to: redirect_to || 'https://sanarflix-study-guide.lovable.app/auth/update-password',
        email_action_type,
      }))
      subject = 'Bem-vindo ao SanarFlix Academy! 🎓'
    }

    else {
      // Default to magic link for login
      html = await renderAsync(
        React.createElement(MagicLinkEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to: redirect_to || 'https://sanarflix-study-guide.lovable.app/',
          email_action_type,
        })
      )
      subject = 'Acesse sua conta - SanarFlix Academy'
    }

    const { error } = await resend.emails.send({
      from: 'SanarFlix Academy <onboarding@resend.dev>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }



  } catch (error) {
    console.error('Email function error:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: (error as any).code || 500,
          message: (error as any).message || 'Internal server error',
        },
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})