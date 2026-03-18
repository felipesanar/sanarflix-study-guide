import { createClient } from "npm:@supabase/supabase-js@2";
import { triggerNovuEvent } from "../_shared/novu.ts";
import { buildCanonicalLink } from "../_shared/auth-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildResetPasswordHtml(confirmationUrl: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light only" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redefina sua senha</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      table { border-collapse: collapse !important; }
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #FFFFFF; }
      .wrapper { width: 100%; table-layout: fixed; background-color: #FFFFFF; background-image: linear-gradient(180deg, #FFFFFF 0%, #FDE8E8 65%, #FBD1D1 100%); }
      .webkit { max-width: 600px; margin: 0 auto; }
      .outer { margin: 0 auto; width: 100%; max-width: 600px; }
      .card { background-color: #FFFFFF; border-radius: 14px; border: 1px solid #F1F1F1; box-shadow: 0 10px 32px rgba(0,0,0,0.08); }
      .heading { font-family: Helvetica, Arial, sans-serif; font-size: 22px; line-height: 1.3; color: #111111; margin: 0; }
      .body { font-family: Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #444444; margin: 0; }
      .small { font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #888888; margin: 0; }
      .cta { display: inline-block; background-color: #DC2626; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-family: Helvetica, Arial, sans-serif; font-size: 15px; border-radius: 10px; padding: 14px 24px; border: 1px solid #DC2626; box-shadow: 0 8px 16px rgba(220, 38, 38, 0.25); }
      .cta:hover, .cta:focus { background-color: #B91C1C; border-color: #B91C1C; }
      .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; max-height: 0; overflow: hidden; mso-hide: all; }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff;">
    <div class="preheader">Recebemos uma solicitação para redefinir sua senha no SanarFlix Academy.</div>
    <center class="wrapper">
      <div class="webkit">
        <table class="outer" align="center" role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 36px 0 20px 0;">
              <img src="https://sanarflix-study-guide.lovable.app/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png" alt="SanarFlix Academy" width="120" style="display:block; border:0; border-radius:16px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 12px;">
              <table class="card" width="100%" role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 36px 28px 8px 28px;">
                    <h1 class="heading">Redefina sua senha</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 28px 0 28px;">
                    <p class="body">Recebemos uma solicitação para redefinir a senha da sua conta no <strong>SanarFlix Academy</strong>. Para criar uma nova senha, clique no botão abaixo.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 18px 28px 12px 28px;">
                    <a href="${confirmationUrl}" class="cta" target="_blank" rel="noopener">Redefinir minha senha</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 28px 12px 28px;">
                    <p class="small">Se você não solicitou essa redefinição, pode ignorar este e-mail com segurança.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 28px 28px 28px;">
                    <p class="small">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${confirmationUrl}" style="color:#dc2626; text-decoration:underline; word-break:break-all;" target="_blank" rel="noopener">${confirmationUrl}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 28px 0 36px 0;">
              <p class="small" style="color:#666;">Este e-mail foi enviado porque foi solicitada uma redefinição de senha para sua conta.<br />© 2025 SanarFlix. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </div>
    </center>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Email é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user exists in public.users
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('id, nome')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!userRecord) {
      // Don't reveal whether user exists — return success silently
      console.log('[request-password-reset] User not found, returning silent success');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: 'https://academy.sanar.com.br/reset-password',
      },
    });

    if (linkError || !linkData) {
      console.error('[request-password-reset] generateLink error:', linkError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gerar link de recuperação' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const confirmationUrl = buildCanonicalLink({
      properties: linkData.properties,
      redirectPath: '/reset-password',
    });

    console.log('[request-password-reset] Recovery link generated for:', normalizedEmail);

    // Split name
    const nome = userRecord.nome || '';
    const nameParts = nome.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const htmlContent = buildResetPasswordHtml(confirmationUrl);

    const result = await triggerNovuEvent({
      name: 'workflow-email',
      payload: { name: nome, email: normalizedEmail, confirmationUrl },
      to: [{ subscriberId: userRecord.id, firstName, lastName, email: normalizedEmail }],
      overrides: {
        email: {
          from: '<atendimento@sanar.com.br>',
          replyTo: 'atendimento@sanar.com.br',
          subject: 'Redefinição de Senha — SanarFlix Academy',
          html: htmlContent,
        },
      },
    });

    if (!result.ok) {
      console.error('[request-password-reset] Novu trigger failed:', result.error);
      // Still return success to not reveal info
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[request-password-reset] Exception:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
