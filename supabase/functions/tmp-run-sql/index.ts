// deno-lint-ignore-file no-explicit-any
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

Deno.serve(async (req) => {
  try {
    const secret = req.headers.get("x-tmp-secret");
    if (!secret || secret !== Deno.env.get("TMP_RUN_SQL_SECRET")) {
      return new Response("unauthorized", { status: 401 });
    }
    const body = await req.json();
    const sql = body?.sql as string;
    if (!sql || typeof sql !== "string") {
      return new Response(JSON.stringify({ error: "missing sql" }), { status: 400 });
    }
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const sqlClient = postgres(dbUrl, { max: 1, prepare: false });
    try {
      const result = await sqlClient.unsafe(sql);
      return new Response(JSON.stringify({ ok: true, result }), {
        headers: { "content-type": "application/json" },
      });
    } finally {
      await sqlClient.end({ timeout: 5 });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
