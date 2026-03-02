/**
 * Admin Study Guide Upload Edge Function
 * Handles bulk import of study guide content with MERGE/APPEND/REPLACE modes
 * 
 * Supports two action types to prevent data loss from batching:
 * - action: 'delete_scope' — Deletes existing records for the given scope (IES + semestres)
 * - action: 'insert_only' — Inserts rows without any deletion
 * - (legacy) No action field — behaves as before for APPEND mode
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const LOG_PREFIX = "[Edge:admin-upload-study-guide]";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportConfig {
  mode: "MERGE" | "REPLACE" | "APPEND";
  scope: "ies_semestre" | "ies_full";
  emptyBehavior: "ignore" | "null";
  strictMode: boolean;
  dryRun: boolean;
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

interface DeleteScopeEntry {
  iesId: string;
  semestres: string[];
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function authenticateAdmin(req: Request, requestId: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
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
    return { error: "Invalid token", status: 401 };
  }

  const userId = userData.user.id;

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (rolesError) {
    return { error: "Error checking permissions", status: 500 };
  }

  const isAdmin = roles?.some((r) => r.role === "admin");
  if (!isAdmin) {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { supabaseAdmin, userId };
}

// ─── Action: delete_scope ────────────────────────────────────────────────────

async function handleDeleteScope(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: { config: ImportConfig; scopes: DeleteScopeEntry[] },
  requestId: string
) {
  const { config, scopes } = body;

  if (!scopes || scopes.length === 0) {
    return jsonResponse({ error: "No scopes provided", requestId }, 400);
  }

  let totalDeleted = 0;

  for (const scope of scopes) {
    // MERGE forces ies_semestre scope (only delete semesters present in file)
    // REPLACE respects the configured scope
    const effectiveScope = config.mode === "MERGE" ? "ies_semestre" : config.scope;

    let deleteQuery = supabaseAdmin
      .from("conteudos")
      .delete({ count: "exact" })
      .eq("id_ies", scope.iesId);

    if (effectiveScope === "ies_semestre" && scope.semestres.length > 0) {
      deleteQuery = deleteQuery.in("semestre", scope.semestres);
    }
    // ies_full: no semestre filter, deletes ALL content for this IES

    const { error: deleteError, count } = await deleteQuery;
    if (deleteError) {
      console.error(LOG_PREFIX, `Request ${requestId}: Delete error for IES ${scope.iesId}`, deleteError);
      return jsonResponse(
        { error: `Failed to delete existing records for IES ${scope.iesId}`, requestId },
        500
      );
    }

    const deletedCount = count || 0;
    totalDeleted += deletedCount;
    console.log(
      LOG_PREFIX,
      `Request ${requestId}: Deleted ${deletedCount} records for IES ${scope.iesId} (scope=${effectiveScope}, semestres=${scope.semestres.join(",")})`
    );
  }

  console.log(LOG_PREFIX, `Request ${requestId}: Total deleted = ${totalDeleted}`);

  return jsonResponse({
    success: true,
    requestId,
    counts: { inserted: 0, updated: 0, deleted: totalDeleted, ignored: 0, errors: 0 },
    errors: [],
  });
}

// ─── Action: insert_only ─────────────────────────────────────────────────────

async function handleInsertOnly(
  supabaseAdmin: ReturnType<typeof createClient>,
  rows: NormalizedRow[],
  requestId: string
) {
  if (!rows || rows.length === 0) {
    return jsonResponse({ error: "No rows to insert", requestId }, 400);
  }

  if (rows.length > 10000) {
    return jsonResponse({ error: "Too many rows. Maximum 10000 per request.", requestId }, 400);
  }

  // Log sample for debugging
  const sample = rows.slice(0, 3).map((r) => ({
    row: r.rowNumber,
    ies: r.id_ies,
    sem: r.semestre,
    mat: r.materia,
  }));
  console.log(LOG_PREFIX, `Request ${requestId}: insert_only ${rows.length} rows. Sample:`, JSON.stringify(sample));

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

  let inserted = 0;
  let errors = 0;
  const errorRows: ImportResultRow[] = [];

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

  console.log(LOG_PREFIX, `Request ${requestId}: insert_only done — inserted=${inserted}, errors=${errors}`);

  return jsonResponse({
    success: errors === 0,
    requestId,
    counts: { inserted, updated: 0, deleted: 0, ignored: 0, errors },
    errors: errorRows.filter((r) => r.status === "error"),
  });
}

// ─── Legacy: APPEND (no delete needed) ───────────────────────────────────────

async function handleLegacyAppend(
  supabaseAdmin: ReturnType<typeof createClient>,
  rows: NormalizedRow[],
  requestId: string
) {
  if (!rows || rows.length === 0) {
    return jsonResponse({ error: "No rows to import", requestId }, 400);
  }

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

  let inserted = 0;
  let errors = 0;
  const errorRows: ImportResultRow[] = [];

  const SUB_BATCH = 200;
  for (let i = 0; i < records.length; i += SUB_BATCH) {
    const chunk = records.slice(i, i + SUB_BATCH);
    const { error: insertError } = await supabaseAdmin.from("conteudos").insert(chunk);
    if (insertError) {
      if (insertError.code === "23505") {
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

  console.log(LOG_PREFIX, `Request ${requestId}: APPEND done — inserted=${inserted}, errors=${errors}`);

  return jsonResponse({
    success: errors === 0,
    requestId,
    counts: { inserted, updated: 0, deleted: 0, ignored: 0, errors },
    errors: errorRows.filter((r) => r.status === "error"),
  });
}

// ─── Response helper ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(LOG_PREFIX, `Request ${requestId} started`);

  try {
    const authResult = await authenticateAdmin(req, requestId);
    if ("error" in authResult) {
      return jsonResponse({ error: authResult.error, requestId }, authResult.status);
    }
    const { supabaseAdmin } = authResult;

    const body = await req.json();
    const action: string = body.action || "";

    console.log(LOG_PREFIX, `Request ${requestId}: action="${action}", mode="${body.config?.mode}"`);

    // ── Route by action ──
    if (action === "delete_scope") {
      return await handleDeleteScope(supabaseAdmin, body, requestId);
    }

    if (action === "insert_only") {
      return await handleInsertOnly(supabaseAdmin, body.rows, requestId);
    }

    // ── Legacy / APPEND path ──
    const config = body.config as ImportConfig;
    const rows = body.rows as NormalizedRow[];

    if (!rows || rows.length === 0) {
      return jsonResponse({ error: "No rows to import", requestId }, 400);
    }

    if (rows.length > 10000) {
      return jsonResponse({ error: "Too many rows. Maximum 10000 per import.", requestId }, 400);
    }

    if (config.mode === "APPEND") {
      return await handleLegacyAppend(supabaseAdmin, rows, requestId);
    }

    // Legacy MERGE/REPLACE — kept for backward compatibility but frontend should use delete_scope + insert_only
    console.warn(LOG_PREFIX, `Request ${requestId}: Legacy MERGE/REPLACE path used. Frontend should be updated.`);

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

    let inserted = 0;
    let deleted = 0;
    let errors = 0;
    const errorRows: ImportResultRow[] = [];

    // Group by IES+semestre
    const iesSemestres = new Map<string, Set<string>>();
    rows.forEach((row) => {
      if (!iesSemestres.has(row.id_ies)) {
        iesSemestres.set(row.id_ies, new Set());
      }
      iesSemestres.get(row.id_ies)!.add(row.semestre);
    });

    for (const [iesId, semestres] of iesSemestres.entries()) {
      const effectiveScope = config.mode === "MERGE" ? "ies_semestre" : config.scope;
      let deleteQuery = supabaseAdmin.from("conteudos").delete({ count: "exact" }).eq("id_ies", iesId);
      if (effectiveScope === "ies_semestre") {
        deleteQuery = deleteQuery.in("semestre", Array.from(semestres));
      }

      const { error: deleteError, count } = await deleteQuery;
      if (deleteError) {
        console.error(LOG_PREFIX, `Request ${requestId}: Delete error for IES ${iesId}`, deleteError);
        return jsonResponse(
          { error: `Failed to delete existing records for IES ${iesId}`, requestId },
          500
        );
      }
      deleted += count || 0;
    }

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

    console.log(LOG_PREFIX, `Request ${requestId}: Done — inserted=${inserted}, deleted=${deleted}, errors=${errors}`);

    return jsonResponse({
      success: errors === 0,
      requestId,
      counts: { inserted, updated: 0, deleted, ignored: 0, errors },
      errors: errorRows.filter((r) => r.status === "error"),
    });
  } catch (error) {
    console.error(LOG_PREFIX, `Request ${requestId}: Unexpected error`, error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        requestId,
      },
      500
    );
  }
});
