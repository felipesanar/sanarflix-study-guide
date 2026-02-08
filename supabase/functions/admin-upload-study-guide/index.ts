/**
 * Admin Study Guide Upload Edge Function
 * Handles bulk import of study guide content with MERGE/APPEND/REPLACE modes
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(LOG_PREFIX, `Request ${requestId} started`);

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log(LOG_PREFIX, `Request ${requestId}: No auth token`);
      return new Response(
        JSON.stringify({ error: "Unauthorized", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user and check admin role
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      console.log(LOG_PREFIX, `Request ${requestId}: Invalid token`, userError);
      return new Response(
        JSON.stringify({ error: "Invalid token", requestId }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log(LOG_PREFIX, `Request ${requestId}: User ${userId}`);

    // Check admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) {
      console.error(LOG_PREFIX, `Request ${requestId}: Error checking roles`, rolesError);
      return new Response(
        JSON.stringify({ error: "Error checking permissions", requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      console.log(LOG_PREFIX, `Request ${requestId}: User is not admin`);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required", requestId }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { config, institutionMappings, rows } = body as {
      config: ImportConfig;
      institutionMappings: SheetMapping[];
      rows: NormalizedRow[];
    };

    console.log(LOG_PREFIX, `Request ${requestId}: Processing ${rows.length} rows with mode ${config.mode}`);

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No rows to import", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate rows limit (safety)
    if (rows.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Too many rows. Maximum 10000 per import.", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ImportResultRow[] = [];
    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let ignored = 0;
    let errors = 0;

    // Handle REPLACE mode - delete existing records first
    if (config.mode === "REPLACE") {
      const iesSemestres = new Map<string, Set<string>>();
      
      rows.forEach((row) => {
        if (!iesSemestres.has(row.id_ies)) {
          iesSemestres.set(row.id_ies, new Set());
        }
        iesSemestres.get(row.id_ies)!.add(row.semestre);
      });

      for (const [iesId, semestres] of iesSemestres.entries()) {
        let deleteQuery = supabaseAdmin.from("conteudos").delete().eq("id_ies", iesId);
        
        if (config.scope === "ies_semestre") {
          // Delete only specific semesters
          deleteQuery = deleteQuery.in("semestre", Array.from(semestres));
        }
        
        const { error: deleteError, count } = await deleteQuery;
        
        if (deleteError) {
          console.error(LOG_PREFIX, `Request ${requestId}: Delete error for IES ${iesId}`, deleteError);
          return new Response(
            JSON.stringify({ 
              error: `Failed to delete existing records for IES ${iesId}`, 
              requestId 
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        deleted += count || 0;
        console.log(LOG_PREFIX, `Request ${requestId}: Deleted ${count} records for IES ${iesId}`);
      }
    }

    // Process rows in batches
    const BATCH_SIZE = 200;
    const batches: NormalizedRow[][] = [];
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE));
    }

    console.log(LOG_PREFIX, `Request ${requestId}: Processing ${batches.length} batches`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Prepare records for upsert
      const records = batch.map((row) => ({
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

      if (config.mode === "APPEND") {
        // Insert only, ignore conflicts
        const { data, error: insertError } = await supabaseAdmin
          .from("conteudos")
          .insert(records)
          .select();

        if (insertError) {
          // Check if it's a duplicate error
          if (insertError.code === "23505") {
            // Postgres unique violation
            batch.forEach((row) => {
              results.push({ rowNumber: row.rowNumber, sheetName: row.sheetName, status: "ignored" });
              ignored++;
            });
          } else {
            console.error(LOG_PREFIX, `Request ${requestId}: Insert error`, insertError);
            batch.forEach((row) => {
              results.push({ 
                rowNumber: row.rowNumber, 
                sheetName: row.sheetName, 
                status: "error",
                error: insertError.message 
              });
              errors++;
            });
          }
        } else {
          const insertedCount = data?.length || 0;
          inserted += insertedCount;
          
          batch.forEach((row, i) => {
            if (i < insertedCount) {
              results.push({ rowNumber: row.rowNumber, sheetName: row.sheetName, status: "inserted" });
            } else {
              results.push({ rowNumber: row.rowNumber, sheetName: row.sheetName, status: "ignored" });
              ignored++;
            }
          });
        }
      } else {
        // MERGE or REPLACE - use upsert
        // For upsert, we need a unique constraint. Using a combination approach.
        const { data, error: upsertError } = await supabaseAdmin
          .from("conteudos")
          .upsert(records, {
            onConflict: "id_ies,semestre,materia,tema,subtema,aula",
            ignoreDuplicates: false,
          })
          .select();

        if (upsertError) {
          console.error(LOG_PREFIX, `Request ${requestId}: Upsert error`, upsertError);
          
          // Try individual inserts as fallback
          for (const record of records) {
            const rowInfo = batch.find(r => 
              r.materia === record.materia && 
              r.semestre === record.semestre
            );
            
            const { error: singleError } = await supabaseAdmin
              .from("conteudos")
              .insert(record);

            if (singleError) {
              if (singleError.code === "23505") {
                // Duplicate - try update
                const { error: updateError } = await supabaseAdmin
                  .from("conteudos")
                  .update({
                    link_aula: record.link_aula,
                    link_pdf: record.link_pdf,
                    link_quiz: record.link_quiz,
                  })
                  .eq("id_ies", record.id_ies)
                  .eq("semestre", record.semestre)
                  .eq("materia", record.materia)
                  .eq("tema", record.tema || "")
                  .eq("subtema", record.subtema || "")
                  .eq("aula", record.aula || "");

                if (updateError) {
                  results.push({ 
                    rowNumber: rowInfo?.rowNumber || 0, 
                    sheetName: rowInfo?.sheetName, 
                    status: "error",
                    error: updateError.message 
                  });
                  errors++;
                } else {
                  results.push({ rowNumber: rowInfo?.rowNumber || 0, sheetName: rowInfo?.sheetName, status: "updated" });
                  updated++;
                }
              } else {
                results.push({ 
                  rowNumber: rowInfo?.rowNumber || 0, 
                  sheetName: rowInfo?.sheetName, 
                  status: "error",
                  error: singleError.message 
                });
                errors++;
              }
            } else {
              results.push({ rowNumber: rowInfo?.rowNumber || 0, sheetName: rowInfo?.sheetName, status: "inserted" });
              inserted++;
            }
          }
        } else {
          // Upsert successful
          inserted += data?.length || batch.length;
          batch.forEach((row) => {
            results.push({ rowNumber: row.rowNumber, sheetName: row.sheetName, status: "inserted" });
          });
        }
      }

      console.log(LOG_PREFIX, `Request ${requestId}: Batch ${batchIndex + 1}/${batches.length} complete`);
    }

    // Log import to audit table (optional - can be added later via migration)
    console.log(LOG_PREFIX, `Request ${requestId}: Import complete - inserted=${inserted}, updated=${updated}, deleted=${deleted}, ignored=${ignored}, errors=${errors}`);

    const response = {
      success: errors === 0,
      requestId,
      counts: {
        inserted,
        updated,
        deleted,
        ignored,
        errors,
      },
      errors: results.filter((r) => r.status === "error"),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(LOG_PREFIX, `Request ${requestId}: Unexpected error`, error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error", 
        requestId 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
