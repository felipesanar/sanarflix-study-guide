import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { triggerNovuEvent } from "../_shared/novu.ts";
import { buildCanonicalLink } from "../_shared/auth-links.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'IES_NOT_FOUND'
  | 'AUTH_CREATE_FAILED'
  | 'PROFILE_SYNC_FAILED'
  | 'UPDATE_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const B2B_IES_ID = '9f21b138-0027-44c8-9660-dc6706d57bc0';
const CANONICAL_ORIGIN = 'https://academy.sanar.com.br';

const createUserSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s\-'.]+$/, 'Nome deve conter apenas letras, espaços, hífens, apóstrofos e pontos'),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .transform(val => val.toLowerCase()),
  id_ies: z.string()
    .uuid('ID da IES deve ser um UUID válido'),
  semestre: z.number()
    .int('Semestre deve ser um número inteiro')
    .min(1, 'Semestre mínimo: 1')
    .max(12, 'Semestre máximo: 12')
    .nullable()
    .optional(),
  role: z.enum(['admin', 'moderator', 'user', 'b2b_partner', 'professor', 'gestor', 'atendimento', 'gestor_formal']).optional(),
  resend_email: z.boolean().optional(),
});

/** Grant a role in user_roles (idempotent). 'aluno' = no row. */
async function grantRoleIfNeeded(
  supabaseAdmin: any,
  userId: string,
  role: string | undefined,
  grantedBy: string | null,
  email: string,
) {
  if (!role || role === 'aluno') return;
  const { error } = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: userId, role, granted_by: grantedBy }, { onConflict: 'user_id,role' });
  if (error) console.error(`[RBAC] Failed to grant role '${role}' to ${email}:`, error);
  else console.log(`[RBAC] Role '${role}' granted to ${email}`);
}

function errorResponse(code: ErrorCode, message: string, details?: string) {
  return new Response(
    JSON.stringify({ success: false, error: message, code, details }),
    { 
      status: code === 'VALIDATION_ERROR' ? 400 : 
              code === 'IES_NOT_FOUND' ? 404 :
              code === 'RATE_LIMITED' ? 429 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

function successResponse(
  action: 'created' | 'updated',
  userId: string,
  email: string,
  message: string,
  details?: { emailSent?: boolean; fieldsUpdated?: string[] }
) {
  return new Response(
    JSON.stringify({ success: true, action, userId, email, message, details }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/** Generate a random temporary password */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  let pw = upper[Math.floor(Math.random() * upper.length)]
         + lower[Math.floor(Math.random() * lower.length)]
         + digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < 10; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

/** Generate a dynamic recovery link with embedded tokens */
async function generateRecoveryLink(supabaseAdmin: any, email: string): Promise<string | null> {
  try {
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://academy.sanar.com.br/auth/update-password'
      }
    });

    if (error) {
      console.error('[CreateUser] Failed to generate recovery link:', error);
      return null;
    }

    const confirmationUrl = buildCanonicalLink({
      properties: linkData?.properties ?? {},
      redirectPath: '/auth/update-password',
    });
    console.log('[CreateUser] Recovery link generated successfully for:', email);
    return confirmationUrl;
  } catch (err) {
    console.error('[CreateUser] Exception generating recovery link:', err);
    return null;
  }
}

function buildWelcomeEmailHtml(confirmationUrl: string, email: string): string {
  const resendUrl = `https://academy.sanar.com.br/auth/resend?email=${encodeURIComponent(email)}`;
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light only" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Defina sua Senha</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      table { border-collapse: collapse !important; }
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #ffffff; }
      .wrapper { width: 100%; table-layout: fixed; background-color: #ffffff; background-image: linear-gradient(180deg, #ffffff 0%, #fde8e8 65%, #fbd1d1 100%); }
      .webkit { max-width: 600px; margin: 0 auto; }
      .outer { margin: 0 auto; width: 100%; max-width: 600px; }
      .card { background-color: #ffffff; border-radius: 14px; border: 1px solid #f1f1f1; box-shadow: 0 10px 32px rgba(0,0,0,0.08); }
      .heading { font-family: Helvetica, Arial, sans-serif; font-size: 22px; line-height: 1.3; color: #111111; margin: 0; }
      .body { font-family: Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #444444; margin: 0; }
      .small { font-family: Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #888888; margin: 0; }
      .cta { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; font-weight: 700; font-family: Helvetica, Arial, sans-serif; font-size: 15px; border-radius: 10px; padding: 14px 24px; border: 1px solid #dc2626; box-shadow: 0 8px 16px rgba(220, 38, 38, 0.25); }
      .cta:hover, .cta:focus { background-color: #b91c1c; border-color: #b91c1c; }
      .cta-secondary { display: inline-block; background-color: #ffffff; color: #dc2626 !important; text-decoration: none; font-weight: 600; font-family: Helvetica, Arial, sans-serif; font-size: 13px; border-radius: 10px; padding: 10px 20px; border: 2px solid #dc2626; }
      .cta-secondary:hover, .cta-secondary:focus { background-color: #fef2f2; }
      .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; max-height: 0; overflow: hidden; mso-hide: all; }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff;">
    <div class="preheader">Defina sua senha para concluir seu acesso ao SanarFlix Academy.</div>
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
                    <h1 class="heading">Boas\u2011vindas ao SanarFlix Academy</h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 28px 0 28px;">
                    <p class="body">
                      Voc\u00ea foi convidado para acessar a plataforma. Para garantir sua seguran\u00e7a e liberar seu acesso,
                      clique no bot\u00e3o abaixo e <strong>defina sua senha pessoal</strong>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 18px 28px 12px 28px;">
                    <a href="${confirmationUrl}" class="cta" target="_blank" rel="noopener">Definir minha senha</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 28px 12px 28px;">
                    <p class="small">
                      Se o bot\u00e3o n\u00e3o funcionar, copie e cole este link no navegador:<br />
                      <a href="${confirmationUrl}" style="color:#dc2626; text-decoration:underline; word-break:break-all;" target="_blank" rel="noopener">${confirmationUrl}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 8px 28px 28px 28px; border-top: 1px solid #f1f1f1;">
                    <p class="small" style="margin-bottom: 10px;">Link expirado ou n\u00e3o funciona?</p>
                    <a href="${resendUrl}" class="cta-secondary" target="_blank" rel="noopener">Solicitar um novo link</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 28px 0 36px 0;">
              <p class="small" style="color:#666;">
                Voc\u00ea recebeu este e\u2011mail porque foi cadastrado na plataforma.<br/>
                \u00a9 2025 SanarFlix. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </div>
    </center>
  </body>
</html>`;
}

async function sendWelcomeEmail(supabaseAdmin: any, userId: string, nome: string, email: string): Promise<boolean> {
  const nameParts = nome.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  
  // Generate dynamic recovery link with tokens
  const confirmationUrl = await generateRecoveryLink(supabaseAdmin, email);

  if (!confirmationUrl) {
    console.error('[CreateUser] Skipping welcome email for', email, '- recovery link generation failed');
    return false;
  }

  const htmlContent = buildWelcomeEmailHtml(confirmationUrl, email);

  const result = await triggerNovuEvent({
    name: 'workflow-email',
    payload: { name: nome, email, confirmationUrl },
    to: [{ subscriberId: userId, firstName, lastName, email }],
    disableTracking: true,
    overrides: {
      email: {
        from: '<atendimento@sanar.com.br>',
        replyTo: 'atendimento@sanar.com.br',
        subject: 'Bem-vindo ao SanarFlix Academy',
        html: htmlContent,
      },
    },
  });
  if (!result.ok) {
    console.log('[CreateUser] Novu welcome email failed for', email, ':', result.error);
  }
  return result.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error('[Config] Missing Supabase environment variables');
      return errorResponse('INTERNAL_ERROR', 'Configuração do servidor incompleta');
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!authHeader || !authHeader.startsWith("Bearer ") || !token) {
      console.error('[Auth] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado: token ausente", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify caller using admin client (service role can validate any JWT without session)
    const { data: { user: callerUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !callerUser) {
      console.error('[Auth] Failed to verify token:', authErr);
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerUserId = callerUser.id;

    // Verify admin role
    const { data: hasAdminRole, error: roleErr } = await supabaseAdmin.rpc('has_role', {
      _user_id: callerUserId,
      _role: 'admin'
    });

    if (roleErr || !hasAdminRole) {
      console.error('[Security] Admin check failed:', roleErr);
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado: privilégios de admin necessários", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse & validate body
    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse('VALIDATION_ERROR', 'Corpo da requisição inválido');
    }

    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      console.error(`[Validation] Failed for email ${body?.email}: nome="${body?.nome?.substring(0, 30)}..." -> ${errorMessages}`);
      return errorResponse('VALIDATION_ERROR', 'Dados inválidos', errorMessages);
    }

    const { nome, email, id_ies, semestre, role, resend_email } = validationResult.data;

    // Validate IES exists
    const { data: iesData, error: iesError } = await supabaseAdmin
      .from('ies')
      .select('id, nome')
      .eq('id', id_ies)
      .single();

    if (iesError || !iesData) {
      console.error('[Validation] IES not found:', id_ies);
      return errorResponse('IES_NOT_FOUND', `IES não encontrada: ${id_ies}`);
    }

    console.log(`[CreateUser] Processing: ${email} for IES: ${iesData.nome} (resend_email: ${!!resend_email})`);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, nome, semestre, id_ies')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('[Database] Error checking existing user:', checkError);
      return errorResponse('INTERNAL_ERROR', 'Erro ao verificar usuário existente');
    }

    const userMetadata = { 
      full_name: nome, 
      id_ies, 
      semestre: semestre ?? null, 
      must_change_password: true 
    };

    if (existingUser) {
      // ========== UPDATE FLOW ==========
      console.log(`[CreateUser] User ${email} exists (ID: ${existingUser.id}), updating...`);
      
      const fieldsUpdated: string[] = [];
      if (existingUser.semestre !== semestre) fieldsUpdated.push('semestre');
      if (existingUser.nome !== nome) fieldsUpdated.push('nome');
      if (existingUser.id_ies !== id_ies) fieldsUpdated.push('id_ies');

      // Update auth metadata
      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { user_metadata: userMetadata }
      );
      if (authUpdateErr) {
        console.error('[Auth] Failed to update auth metadata:', authUpdateErr);
      }

      // Update public.users
      const { error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ nome, id_ies, semestre: semestre ?? null })
        .eq('id', existingUser.id);

      if (updateErr) {
        console.error('[Database] Failed to update user:', updateErr);
        return errorResponse('UPDATE_FAILED', 'Falha ao atualizar usuário', updateErr.message);
      }

      // B2B admin role
      if (id_ies === B2B_IES_ID) {
        const { error: rErr } = await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id: existingUser.id, role: 'admin', granted_by: callerUserId }, { onConflict: 'user_id,role' });
        if (rErr) console.error('[RBAC] Failed to ensure admin role:', rErr);
      }

      await grantRoleIfNeeded(supabaseAdmin, existingUser.id, role, callerUserId, email);

      // Resend welcome email if requested
      let emailSent = false;
      if (resend_email) {
        console.log(`[CreateUser] Resending welcome email for existing user: ${email}`);
        emailSent = await sendWelcomeEmail(supabaseAdmin, existingUser.id, nome, email);
      }

      const message = resend_email 
        ? (emailSent ? 'Email de acesso reenviado com sucesso' : 'Usuário atualizado, mas falha ao enviar email')
        : fieldsUpdated.length > 0 
          ? `Usuário atualizado: ${fieldsUpdated.join(', ')}`
          : 'Usuário já estava atualizado';

      console.log(`[CreateUser] User ${email} updated. Fields: ${fieldsUpdated.join(', ') || 'none'}. Email resent: ${emailSent}`);
      return successResponse('updated', existingUser.id, email, message, { fieldsUpdated, emailSent });

    } else {
      // ========== CREATE FLOW ==========
      console.log(`[CreateUser] User ${email} does not exist, creating...`);

      const tempPassword = generateTempPassword();

      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: userMetadata,
      });

      if (createErr) {
        console.error('[Auth] Failed to create user:', createErr);
        if (createErr.message?.includes('rate limit')) {
          return errorResponse('RATE_LIMITED', 'Limite de requisições excedido, aguarde alguns minutos');
        }

        // Handle case where user exists in auth.users but not in public.users
        if ((createErr as any).code === 'email_exists') {
          console.log(`[CreateUser] User exists in auth but not in public.users, recovering...`);
          try {
            // Use listUsers with proper pagination to find the user
            const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 50,
            });
            
            if (listErr) {
              console.error('[Auth] listUsers failed:', listErr);
              return errorResponse('AUTH_CREATE_FAILED', 'Falha ao recuperar usuário existente', listErr.message);
            }

            const authUser = listData?.users?.find(u => u.email === email);
            
            if (!authUser) {
              // Fallback: try fetching all pages or broader search
              console.warn(`[CreateUser] User ${email} not found in first page, trying broader search...`);
              let found = null;
              for (let page = 2; page <= 10 && !found; page++) {
                const { data: pageData } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
                found = pageData?.users?.find(u => u.email === email) || null;
              }
              if (!found) {
                console.error(`[CreateUser] Cannot find ${email} in auth.users despite email_exists error`);
                return errorResponse('AUTH_CREATE_FAILED', 'Usuário existe no auth mas não foi possível localizá-lo');
              }
              // Use found user
              await supabaseAdmin.auth.admin.updateUserById(found.id, { user_metadata: userMetadata });
              const { error: upsertErr } = await supabaseAdmin
                .from('users')
                .upsert({ id: found.id, email, nome, id_ies, semestre: semestre ?? null }, { onConflict: 'id' });
              if (upsertErr) {
                return errorResponse('PROFILE_SYNC_FAILED', 'Falha ao sincronizar perfil', upsertErr.message);
              }
              if (id_ies === B2B_IES_ID) {
                await supabaseAdmin.from('user_roles')
              }
              await grantRoleIfNeeded(supabaseAdmin, found.id, role, callerUserId, email);
              const emailOk = await sendWelcomeEmail(supabaseAdmin, found.id, nome, email).catch(() => false);
              return successResponse('updated', found.id, email, 'Usuário recuperado e sincronizado com sucesso', { emailSent: emailOk });
            }

            // Update auth metadata
            await supabaseAdmin.auth.admin.updateUserById(authUser.id, { user_metadata: userMetadata });
            // Upsert into public.users
            const { error: upsertErr } = await supabaseAdmin
              .from('users')
              .upsert({ id: authUser.id, email, nome, id_ies, semestre: semestre ?? null }, { onConflict: 'id' });
            if (upsertErr) {
              return errorResponse('PROFILE_SYNC_FAILED', 'Falha ao sincronizar perfil', upsertErr.message);
            }
            // B2B admin role
            if (id_ies === B2B_IES_ID) {
              await supabaseAdmin.from('user_roles')
            }
            await grantRoleIfNeeded(supabaseAdmin, authUser.id, role, callerUserId, email);
            // Send welcome email (awaited for accurate status)
            const emailOk = await sendWelcomeEmail(supabaseAdmin, authUser.id, nome, email).catch(() => false);
            console.log(`[CreateUser] User ${email} recovered successfully. ID: ${authUser.id}`);
            return successResponse('updated', authUser.id, email, 'Usuário recuperado e sincronizado com sucesso', { emailSent: emailOk });
          } catch (recoveryErr) {
            console.error('[CreateUser] Recovery failed:', recoveryErr);
            return errorResponse('AUTH_CREATE_FAILED', 'Falha ao recuperar usuário existente', 
              recoveryErr instanceof Error ? recoveryErr.message : 'Erro desconhecido');
          }
        }

        return errorResponse('AUTH_CREATE_FAILED', 'Falha ao criar usuário', createErr.message);
      }

      if (!createData?.user) {
        console.error('[Auth] Create succeeded but no user returned');
        return errorResponse('AUTH_CREATE_FAILED', 'Falha ao criar usuário: resposta inesperada');
      }

      const userId = createData.user.id;
      console.log(`[CreateUser] User created in auth.users with ID: ${userId}`);

      // Sync to public.users
      const { error: upsertErr } = await supabaseAdmin
        .from('users')
        .upsert({ id: userId, email, nome, id_ies, semestre: semestre ?? null }, { onConflict: 'id' });

      if (upsertErr) {
        console.error('[Database] Failed to sync user profile:', upsertErr);
        return errorResponse('PROFILE_SYNC_FAILED', 'Usuário criado no auth mas falhou ao sincronizar perfil', upsertErr.message);
      }

      // B2B admin role
      if (id_ies === B2B_IES_ID) {
        const { error: rErr } = await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id: userId, role: 'admin', granted_by: callerUserId }, { onConflict: 'user_id,role' });
        if (rErr) console.error('[RBAC] Failed to grant admin role:', rErr);
      }

      await grantRoleIfNeeded(supabaseAdmin, userId, role, callerUserId, email);

      // Fix #4: Await welcome email for accurate status reporting
      let emailSent = false;
      try {
        emailSent = await sendWelcomeEmail(supabaseAdmin, userId, nome, email);
        console.log(`[CreateUser] Welcome email for ${email}: ${emailSent ? 'sent' : 'FAILED'}`);
      } catch (err) {
        console.error(`[CreateUser] Welcome email error for ${email}:`, err);
      }

      console.log(`[CreateUser] User ${email} created successfully.`);

      return successResponse(
        'created', 
        userId, 
        email, 
        emailSent ? 'Usuário criado e email de boas-vindas enviado' : 'Usuário criado, mas falha ao enviar email',
        { emailSent }
      );
    }

  } catch (error) {
    console.error('[Internal Error]:', error);
    const msg = error instanceof Error ? error.message : "Erro interno do servidor";
    return errorResponse('INTERNAL_ERROR', msg);
  }
});
