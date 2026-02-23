import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { triggerNovuEvent } from "../_shared/novu.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const createUserSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
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
});

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
  // Ensure at least 1 upper, 1 lower, 1 digit
  let pw = upper[Math.floor(Math.random() * upper.length)]
         + lower[Math.floor(Math.random() * lower.length)]
         + digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < 10; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

async function sendWelcomeEmail(nome: string, email: string): Promise<boolean> {
  const firstName = nome.split(' ')[0];
  const result = await triggerNovuEvent({
    name: 'welcome-academy-email',
    payload: { name: nome, email },
    to: [{ firstName, email }],
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
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user) {
      console.error('[Auth] Failed to get user:', getUserErr);
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerUserId = userData.user.id;

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
      return errorResponse('VALIDATION_ERROR', 'Dados inválidos', errorMessages);
    }

    const { nome, email, id_ies, semestre } = validationResult.data;

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

    console.log(`[CreateUser] Processing: ${email} for IES: ${iesData.nome}`);

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
      semestre, 
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
        .update({ nome, id_ies, semestre })
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
        else console.log(`[RBAC] Admin role ensured for B2B user: ${email}`);
      }

      const message = fieldsUpdated.length > 0 
        ? `Usuário atualizado: ${fieldsUpdated.join(', ')}`
        : 'Usuário já estava atualizado';

      console.log(`[CreateUser] User ${email} updated. Fields: ${fieldsUpdated.join(', ') || 'none'}`);
      return successResponse('updated', existingUser.id, email, message, { fieldsUpdated });

    } else {
      // ========== CREATE FLOW (using createUser + Novu instead of inviteUserByEmail) ==========
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
        .upsert({ id: userId, email, nome, id_ies, semestre }, { onConflict: 'id' });

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
        else console.log(`[RBAC] Admin role granted for B2B user: ${email}`);
      }

      // Send welcome email via Novu (fail-soft)
      const emailSent = await sendWelcomeEmail(nome, email);

      console.log(`[CreateUser] User ${email} created. Welcome email: ${emailSent ? 'sent' : 'FAILED'}`);

      return successResponse(
        'created', 
        userId, 
        email, 
        emailSent 
          ? 'Usuário criado e email de boas-vindas enviado'
          : 'Usuário criado, mas falha ao enviar email de boas-vindas',
        { emailSent }
      );
    }

  } catch (error) {
    console.error('[Internal Error]:', error);
    const msg = error instanceof Error ? error.message : "Erro interno do servidor";
    return errorResponse('INTERNAL_ERROR', msg);
  }
});
