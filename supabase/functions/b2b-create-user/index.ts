import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const createUserSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  id_ies: z.string()
    .uuid('ID da IES deve ser um UUID válido'),
  semestre: z.number()
    .int('Semestre deve ser um número inteiro')
    .min(1, 'Semestre mínimo: 1')
    .max(12, 'Semestre máximo: 12')
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Setup & Environment Check
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // 2. Auth Clients
    const authHeader = req.headers.get("Authorization") ?? "";

    // Client for the caller (to verify identity)
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client (Service Role) for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 3. Verify Caller Identity
    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify Admin Role (Secure RPC check)
    const { data: hasAdminRole, error: roleErr } = await supabaseAdmin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin' // Certifique-se que o nome da role no DB é exatamente 'admin'
    });

    if (roleErr || !hasAdminRole) {
      console.error('[Security] Admin check failed:', roleErr);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin privileges required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse & Validate Body
    const body = await req.json();
    const validationResult = createUserSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: errorMessages }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { nome, email, id_ies, semestre } = validationResult.data;
    const userMetadata = { full_name: nome, id_ies, semestre, must_change_password: true };

    // 6. User Management Logic (The Fix)
    let userId: string;
    let actionType = "invited";

    const meuRedirect = Deno.env.get("INVITE_REDIRECT_URL") ?? "http://localhost:8080/auth/update-password";


    // Tenta convidar o usuário. Se ele não existir, cria e manda email. 
    // Se existir, o inviteUserByEmail geralmente retorna o usuário mas não envia novo convite de senha (dependendo da config).
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: userMetadata,
      redirectTo: meuRedirect // <--- Agora ele vai para a página certa
    });

    if (inviteErr) {
      // Se falhar, verificamos se o usuário já existe para atualizar os dados
      // A API admin do Supabase não tem um "getByEmail" direto simples, então listamos ou buscamos na tabela pública
      // Uma estratégia segura é tentar buscar na tabela pública para pegar o ID
      const { data: publicUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (publicUser) {
        userId = publicUser.id;
        actionType = "updated";

        // Atualiza metadados no Auth
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: userMetadata
        });
      } else {
        // Erro real (ex: rate limit, email inválido no provider, etc)
        throw inviteErr;
      }
    } else {
      userId = inviteData.user.id;
    }

    // 7. Upsert Public Profile (Sync Auth -> Public Table)
    // Usamos upsert para garantir que os dados estejam sincronizados
    const { error: upsertErr } = await supabaseAdmin
      .from("users")
      .upsert({
        id: userId,
        email,
        nome,
        id_ies,
        semestre: Number(semestre)
      }, { onConflict: 'id' });

    if (upsertErr) {
      console.error('[Database] Upsert failed:', upsertErr);
      return new Response(
        JSON.stringify({ error: "User created in Auth but failed to sync profile", details: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      if (id_ies === '9f21b138-0027-44c8-9660-dc6706d57bc0') {
        const { error: roleErr } = await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: userId,
            role: 'admin',
            granted_by: userData.user.id
          }, { onConflict: 'user_id,role' });
        if (roleErr) {
          console.error('[RBAC] Failed to ensure admin role:', roleErr);
        }
      }
    } catch (e) {
      console.error('[RBAC] Unexpected error ensuring admin role:', e);
    }

    // 8. Success Response
    return new Response(
      JSON.stringify({
        success: true,
        message: actionType === "invited" ? "Convite enviado com sucesso" : "Usuário atualizado com sucesso",
        userId,
        email,
        action: actionType
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[Internal Error]:', error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});