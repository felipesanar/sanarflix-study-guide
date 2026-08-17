import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const IES_B2B = "9f21b138-0027-44c8-9660-dc6706d57bc0";

Deno.serve(async (req) => {
  try {
    const { email, nome, password } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome, nome },
    });
    if (authErr || !created?.user) {
      return new Response(JSON.stringify({ step: "auth", error: authErr?.message }), { status: 400 });
    }
    const uid = created.user.id;

    const { error: upErr } = await admin.from("users").upsert({
      id: uid,
      email,
      nome,
      id_ies: IES_B2B,
    });
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({ ok: true, uid, upErr: upErr?.message, roleErr: roleErr?.message }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
