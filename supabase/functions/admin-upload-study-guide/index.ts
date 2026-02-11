/**
 * Admin Study Guide Upload Edge Function
 * Handles bulk import of study guide content with MERGE/APPEND/REPLACE modes
 * 
 * Strategy: DELETE scoped + bulk INSERT (no upsert dependency)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const LOG_PREFIX = "[Edge:admin-upload-study-guide]";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ImportConfig {
  mode: "MERGE" | "REPLACE" | "APPEND";
  scope: "ies_semestre" | "ies_full";
  emptyBehavior: "ignore" | "null";
  strictMode: boolean;
  dryRun: boolean;
}

interface SheetMapping {
  sheetName: string;
  iesId: string;
  iesNome: string;
}

interface NormalizedRow {
  rowNumber: number;
  sheetName?: string;
  id_ies: string;
  semestre: string;
  materia: string;
  tema: string | null;
  subtema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
}

interface ImportResultRow {
  rowNumber: number;
  sheetName?: string;
  status: "inserted" | "updated" | "ignored" | "error";
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(LOG_PREFIX, `Request ${requestId} started`);

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Check admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: "Error checking permissions", requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required", requestId }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { config, rows } = body as {
      config: ImportConfig;
      institutionMappings: SheetMapping[];
      rows: NormalizedRow[];
    };

    console.log(LOG_PREFIX, `Request ${requestId}: ${rows.length} rows, mode=${config.mode}`);

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No rows to import", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rows.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Too many rows. Maximum 10000 per import.", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inserted = 0;
    let deleted = 0;
    let errors = 0;
    const errorRows: ImportResultRow[] = [];

    // Prepare records (strip rowNumber/sheetName)
    const records = rows.map((row) => ({
      id_ies: row.id_ies,
      semestre: row.semestre,
      materia: row.materia,
      tema: row.tema,
      subtema: row.subtema,
      aula: row.aula,
      link_aula: row.link_aula,
      link_pdf: row.link_pdf,
      link_quiz: row.link_quiz,
    }));

    // --- MERGE & REPLACE: delete scoped + bulk insert ---
    if (config.mode === "MERGE" || config.mode === "REPLACE") {
      // Group by IES+semestre to delete only the relevant scope
      const iesSemestres = new Map<string, Set<string>>();
      rows.forEach((row) => {
        if (!iesSemestres.has(row.id_ies)) {
          iesSemestres.set(row.id_ies, new Set());
        }
        iesSemestres.get(row.id_ies)!.add(row.semestre);
      });

      // Scoped delete
      for (const [iesId, semestres] of iesSemestres.entries()) {
        let deleteQuery = supabaseAdmin.from("conteudos").delete().eq("id_ies", iesId);

        if (config.scope === "ies_semestre") {
          deleteQuery = deleteQuery.in("semestre", Array.from(semestres));
        }

        const { error: deleteError, count } = await deleteQuery;
        if (deleteError) {
          console.error(LOG_PREFIX, `Request ${requestId}: Delete error for IES ${iesId}`, deleteError);
          return new Response(
            JSON.stringify({ error: `Failed to delete existing records for IES ${iesId}`, requestId }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        deleted += count || 0;
        console.log(LOG_PREFIX, `Request ${requestId}: Deleted ${count} records for IES ${iesId}`);
      }

      // Bulk insert in sub-batches of 200
      const SUB_BATCH = 200;
      for (let i = 0; i < records.length; i += SUB_BATCH) {
        const chunk = records.slice(i, i + SUB_BATCH);
        const { error: insertError } = await supabaseAdmin.from("conteudos").insert(chunk);
        if (insertError) {
          console.error(LOG_PREFIX, `Request ${requestId}: Insert error at chunk ${i}`, insertError);
          errors += chunk.length;
          chunk.forEach((_, idx) => {
            const row = rows[i + idx];
            errorRows.push({
              rowNumber: row?.rowNumber || 0,
              sheetName: row?.sheetName,
              status: "error",
              error: insertError.message,
            });
          });
        } else {
          inserted += chunk.length;
        }
      }
    }

    // --- APPEND: insert only, no delete ---
    if (config.mode === "APPEND") {
      const SUB_BATCH = 200;
      for (let i = 0; i < records.length; i += SUB_BATCH) {
        const chunk = records.slice(i, i + SUB_BATCH);
        const { error: insertError } = await supabaseAdmin.from("conteudos").insert(chunk);
        if (insertError) {
          if (insertError.code === "23505") {
            // Duplicate — count as ignored (not an error)
            // Can't distinguish per-row, so count whole chunk
            chunk.forEach((_, idx) => {
              const row = rows[i + idx];
              errorRows.push({ rowNumber: row?.rowNumber || 0, sheetName: row?.sheetName, status: "ignored" });
            });
          } else {
            console.error(LOG_PREFIX, `Request ${requestId}: Insert error at chunk ${i}`, insertError);
            errors += chunk.length;
            chunk.forEach((_, idx) => {
              const row = rows[i + idx];
              errorRows.push({
                rowNumber: row?.rowNumber || 0,
                sheetName: row?.sheetName,
                status: "error",
                error: insertError.message,
              });
            });
          }
        } else {
          inserted += chunk.length;
        }
      }
    }

    console.log(LOG_PREFIX, `Request ${requestId}: Done — inserted=${inserted}, deleted=${deleted}, errors=${errors}`);

    return new Response(
      JSON.stringify({
        success: errors === 0,
        requestId,
        counts: { inserted, updated: 0, deleted, ignored: 0, errors },
        errors: errorRows.filter((r) => r.status === "error"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(LOG_PREFIX, `Request ${requestId}: Unexpected error`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
