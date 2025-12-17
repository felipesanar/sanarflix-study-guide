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

function generatePassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return `SenhaSegura@${result}`;
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
      return new Response(
        JSON.stringify({ error: "Missing Supabase env vars" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    // Client with JWT to identify caller
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client with service role to manage users and bypass RLS when needed
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Identify caller
    const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();
    if (getUserErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role using has_role function (secure against privilege escalation)
    const { data: hasAdminRole, error: roleErr } = await supabaseAdmin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin'
    });

    if (roleErr) {
      // SECURITY: Log detailed error server-side only
      console.error('[Internal] Error checking admin role:', roleErr);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Validate input with zod schema
    let validatedData;
    try {
      validatedData = createUserSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: errorMessages }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    const { nome, email, id_ies, semestre } = validatedData;

    const password = generatePassword();

    // Try to create user
    let userId: string | undefined;
    // Send invitation email so the user can set their password
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteErr) {
      // If invite fails, try to find existing user by email
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = list?.users?.find(u => u.email === email);
      if (listErr || !existingUser) {
        return new Response(
          JSON.stringify({ error: inviteErr.message || "Falha ao convidar usuário" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = existingUser.id;
    } else {
      userId = invited.user?.id;
    }

    // Attach metadata after invite
    if (userId) {
      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: nome, id_ies, semestre },
      });
      if (metaErr) {
        return new Response(
          JSON.stringify({ error: metaErr.message || "Falha ao atualizar metadados do usuário" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID do usuário não definido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert in public.users - specify id as conflict resolution
    const { error: upsertErr } = await supabaseAdmin
      .from("users")
      .upsert({ id: userId, email, nome, id_ies, semestre: Number(semestre) }, { onConflict: 'id' });

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: upsertErr.message || "Falha ao salvar perfil" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, email, invite_sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    // SECURITY: Log detailed error server-side only
    console.error('[Internal] User creation error:', e);
    return new Response(
      JSON.stringify({ error: "Erro ao processar requisição" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});