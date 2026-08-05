import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const token = req.headers.get("x-tmp-token");
  if (!token || token !== Deno.env.get("TMP_RUN_SQL_TOKEN_L2")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const { sql } = await req.json();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.rpc("tmp_exec_sql_l2", { p_sql: sql });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
});
