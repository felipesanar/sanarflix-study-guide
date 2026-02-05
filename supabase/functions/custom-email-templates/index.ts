import React from 'https://esm.sh/react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1,react-dom@18.3.1'
import { MagicLinkEmail } from './_templates/magic-link.tsx'
import { ResetPasswordEmail } from './_templates/reset-password.tsx'
import { InviteUserEmail } from './_templates/invite-user.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''

// Allow configuring a verified sender domain without code changes.
// Example: "SanarFlix Academy <onboarding@sanar.com>"
const resendFrom = Deno.env.get('RESEND_FROM') ?? 'SanarFlix Academy <onboarding@resend.dev>'

const resend = new Resend(resendApiKey)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isWebhookAuthError(error: unknown) {
  const name = String((error as any)?.name ?? '').toLowerCase()
  const message = String((error as any)?.message ?? '').toLowerCase()

  // standardwebhooks throws verification-related errors; treat them as 401.
  return name.includes('webhook') || message.includes('signature') || message.includes('webhook')
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: { message: 'not allowed' } }, 405)
  }

  // Explicit config checks (helps debugging on Supabase hooks)
  if (!hookSecret) {
    return jsonResponse({ error: { message: 'Missing SEND_EMAIL_HOOK_SECRET' } }, 500)
  }

  if (!resendApiKey) {
    return jsonResponse({ error: { message: 'Missing RESEND_API_KEY' } }, 500)
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
          redirect_to: redirect_to || 'https://preview--sanarflix-study-guide.lovable.app/reset-password',
          email_action_type,
        })
      )
      subject = 'Redefina sua senha - SanarFlix Academy'
    } else if (email_action_type === 'invite') {
      html = await renderAsync(
        React.createElement(InviteUserEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token,
          token_hash,
          redirect_to: redirect_to || 'https://preview--sanarflix-study-guide.lovable.app/auth/update-password',
          email_action_type,
        })
      )
      subject = 'Bem-vindo ao SanarFlix Academy! 🎓'
    } else {
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
      from: resendFrom,
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)

      // IMPORTANT: returning 401 here makes Supabase show "Hook requires authorization token",
      // which is misleading for email provider errors.
      return jsonResponse(
        {
          error: {
            provider: 'resend',
            name: (error as any)?.name,
            statusCode: (error as any)?.statusCode,
            message: (error as any)?.message || 'Failed to send email',
          },
        },
        500
      )
    }

    return jsonResponse({ success: true }, 200)
  } catch (error) {
    console.error('Email function error:', error)

    const status = isWebhookAuthError(error) ? 401 : 500

    return jsonResponse(
      {
        error: {
          name: (error as any)?.name,
          statusCode: (error as any)?.statusCode,
          message: (error as any)?.message || 'Internal server error',
        },
      },
      status
    )
  }
})
