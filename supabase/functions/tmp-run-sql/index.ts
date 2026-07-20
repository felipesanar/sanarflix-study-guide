import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

Deno.serve(async (req) => {
  const secret = req.headers.get("x-tmp-secret");
  if (!secret || secret !== Deno.env.get("TMP_RUN_SQL_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const sql = await req.text();
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const client = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    const result = await client.unsafe(sql);
    return new Response(JSON.stringify({ ok: true, count: Array.isArray(result) ? result.length : 0 }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    await client.end();
  }
});
