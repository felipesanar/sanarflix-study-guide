import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rows } from "./data.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (_req) => {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const simId = rows[0]?.simulado_id;

    // Safety: only run if no questions for this simulado yet
    const { count, error: cErr } = await admin
      .from("questoes_simulado")
      .select("id", { count: "exact", head: true })
      .eq("simulado_id", simId);
    if (cErr) throw cErr;
    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ skipped: true, existing: count }), { status: 200 });
    }

    const { error } = await admin.from("questoes_simulado").insert(rows);
    if (error) throw error;
    return new Response(JSON.stringify({ inserted: rows.length }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
