// TEMPORARY: applies raw SQL migrations. Delete after use.
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

Deno.serve(async (req) => {
  const token = req.headers.get("x-run-token");
  if (token !== Deno.env.get("TMP_RUN_SQL_TOKEN")) {
    return new Response("forbidden", { status: 403 });
  }
  const sql = await req.text();
  const client = new Client(Deno.env.get("SUPABASE_DB_URL")!);
  try {
    await client.connect();
    const res = await client.queryObject(sql);
    return new Response(JSON.stringify({ ok: true, rows: res.rows }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    try { await client.end(); } catch { /* noop */ }
  }
});
