import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      console.error('Error checking admin role:', roleErr);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
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
    const { nome, email, id_ies, semestre } = body ?? {};

    if (!nome || !email || !id_ies || typeof semestre === "undefined") {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: nome, email, id_ies, semestre" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const password = generatePassword();

    // Try to create user
    let userId: string | undefined;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome, id_ies, semestre },
    });

    if (createErr) {
      // If user exists, update password and metadata
      // Try to find by email
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = list?.users?.find(u => u.email === email);
      if (listErr || !existingUser) {
        return new Response(
          JSON.stringify({ error: createErr.message || "Falha ao criar usuário" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = list.users[0].id;

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: nome, id_ies, semestre },
      });
      if (updateErr) {
        return new Response(
          JSON.stringify({ error: updateErr.message || "Falha ao atualizar usuário existente" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      userId = created.user?.id;
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
      JSON.stringify({ success: true, email, password }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Erro inesperado";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});