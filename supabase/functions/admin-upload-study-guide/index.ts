/**
 * Admin Study Guide Upload Edge Function
 * Handles bulk import of study guide content with MERGE/APPEND/REPLACE modes
 * 
 * Supports action types:
 * - action: 'smart_import' — Server-side field-by-field comparison with paginated fetch, selective delete/insert, and post-verification
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

interface ExistingRecord {
  id: string;
  semestre: string;
  materia: string;
  tema: string | null;
  subtema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────

function rowFingerprint(r: { semestre: string; materia: string; tema: string | null; subtema: string | null; aula: string | null; link_aula: string | null; link_pdf: string | null; link_quiz: string | null }): string {
  const values = [r.semestre, r.materia, r.tema, r.subtema, r.aula, r.link_aula, r.link_pdf, r.link_quiz];
  return values.map(v => (v || '').trim().toLowerCase()).join('|');
}

// ─── Paginated fetch ─────────────────────────────────────────────────────────

async function fetchAllExisting(
  supabaseAdmin: ReturnType<typeof createClient>,
  iesId: string,
  semestres?: string[]
): Promise<ExistingRecord[]> {
  const allRows: ExistingRecord[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    let query = supabaseAdmin
      .from('conteudos')
      .select('id, semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
      .eq('id_ies', iesId);

    if (semestres && semestres.length > 0) {
      query = query.in('semestre', semestres);
    }

    query = query.range(from, from + PAGE - 1);

    const { data, error } = await query;

    if (error) {
      console.error(LOG_PREFIX, `fetchAllExisting error at offset ${from}:`, error);
      throw new Error(`Failed to fetch existing records: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allRows.push(...(data as ExistingRecord[]));
    from += PAGE;

    if (data.length < PAGE) break;
  }

  return allRows;
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

// ─── Action: smart_import ────────────────────────────────────────────────────

async function handleSmartImport(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: { config: ImportConfig; rows: NormalizedRow[] },
  requestId: string
) {
  const { config, rows } = body;

  if (!rows || rows.length === 0) {
    return jsonResponse({ error: "No rows to import", requestId }, 400);
  }

  if (rows.length > 10000) {
    return jsonResponse({ error: "Too many rows. Maximum 10000 per request.", requestId }, 400);
  }

  // Log sample
  const sample = rows.slice(0, 3).map(r => ({
    row: r.rowNumber, ies: r.id_ies, sem: r.semestre, mat: r.materia,
  }));
  console.log(LOG_PREFIX, `Request ${requestId}: smart_import ${rows.length} rows, mode=${config.mode}. Sample:`, JSON.stringify(sample));

  // Group rows by IES
  const rowsByIes = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    if (!rowsByIes.has(row.id_ies)) {
      rowsByIes.set(row.id_ies, []);
    }
    rowsByIes.get(row.id_ies)!.push(row);
  }

  let totalInserted = 0;
  let totalDeleted = 0;
  let totalUnchanged = 0;
  let totalErrors = 0;
  const errorRows: ImportResultRow[] = [];
  let verifiedTotal = 0;
  let expectedTotal = 0;

  for (const [iesId, iesRows] of rowsByIes.entries()) {
    // Determine semestres in this batch
    const semestresInFile = [...new Set(iesRows.map(r => r.semestre))];

    // For MERGE, scope is always ies_semestre (only touch semestres in file)
    // For REPLACE with ies_full scope, fetch ALL semestres
    const effectiveScope = config.mode === "MERGE" ? "ies_semestre" : config.scope;
    const fetchSemestres = effectiveScope === "ies_semestre" ? semestresInFile : undefined;

    console.log(LOG_PREFIX, `Request ${requestId}: IES ${iesId} — ${iesRows.length} file rows, semestres=[${semestresInFile.join(',')}], effectiveScope=${effectiveScope}`);

    // 1. Fetch ALL existing records with pagination
    let existingRecords: ExistingRecord[];
    try {
      existingRecords = await fetchAllExisting(supabaseAdmin, iesId, fetchSemestres);
    } catch (err) {
      console.error(LOG_PREFIX, `Request ${requestId}: Failed to fetch existing for IES ${iesId}:`, err);
      totalErrors += iesRows.length;
      iesRows.forEach(r => errorRows.push({
        rowNumber: r.rowNumber, sheetName: r.sheetName, status: "error",
        error: `Failed to fetch existing records: ${err instanceof Error ? err.message : String(err)}`,
      }));
      continue;
    }

    console.log(LOG_PREFIX, `Request ${requestId}: IES ${iesId} — ${existingRecords.length} existing records fetched`);

    // 2. Build fingerprint sets
    const existingFpMap = new Map<string, string[]>(); // fingerprint -> [id, id, ...]
    for (const rec of existingRecords) {
      const fp = rowFingerprint(rec);
      if (!existingFpMap.has(fp)) {
        existingFpMap.set(fp, []);
      }
      existingFpMap.get(fp)!.push(rec.id);
    }

    const fileFpSet = new Set<string>();
    const rowsToInsert: NormalizedRow[] = [];
    let unchanged = 0;

    for (const row of iesRows) {
      const fp = rowFingerprint(row);
      fileFpSet.add(fp);

      if (existingFpMap.has(fp)) {
        // Identical row exists — skip
        unchanged++;
      } else {
        // New or altered — needs insertion
        rowsToInsert.push(row);
      }
    }

    // 3. Find records to delete (in DB but NOT in file)
    const idsToDelete: string[] = [];
    for (const [fp, ids] of existingFpMap.entries()) {
      if (!fileFpSet.has(fp)) {
        idsToDelete.push(...ids);
      }
    }

    console.log(LOG_PREFIX, `Request ${requestId}: IES ${iesId} — unchanged=${unchanged}, toInsert=${rowsToInsert.length}, toDelete=${idsToDelete.length}`);

    // 4. Delete records not in file
    if (idsToDelete.length > 0) {
      const DELETE_BATCH = 200;
      for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH) {
        const chunk = idsToDelete.slice(i, i + DELETE_BATCH);
        const { error: delErr } = await supabaseAdmin
          .from('conteudos')
          .delete()
          .in('id', chunk);

        if (delErr) {
          console.error(LOG_PREFIX, `Request ${requestId}: Delete error for IES ${iesId} chunk ${i}:`, delErr);
          // Non-fatal: continue but log
        }
      }
      totalDeleted += idsToDelete.length;
    }

    // 5. Insert new/altered rows
    if (rowsToInsert.length > 0) {
      const records = rowsToInsert.map(row => ({
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

      const SUB_BATCH = 200;
      for (let i = 0; i < records.length; i += SUB_BATCH) {
        const chunk = records.slice(i, i + SUB_BATCH);
        const { error: insertError } = await supabaseAdmin.from("conteudos").insert(chunk);
        if (insertError) {
          console.error(LOG_PREFIX, `Request ${requestId}: Insert error at chunk ${i} for IES ${iesId}:`, insertError);
          totalErrors += chunk.length;
          chunk.forEach((_, idx) => {
            const row = rowsToInsert[i + idx];
            errorRows.push({
              rowNumber: row?.rowNumber || 0,
              sheetName: row?.sheetName,
              status: "error",
              error: insertError.message,
            });
          });
        } else {
          totalInserted += chunk.length;
        }
      }
    }

    totalUnchanged += unchanged;

    // 6. Post-insertion verification
    const expectedForIes = iesRows.length; // file rows = what should exist for these semestres
    // Count records now in DB for this scope
    let verifyQuery = supabaseAdmin
      .from('conteudos')
      .select('*', { count: 'exact', head: true })
      .eq('id_ies', iesId);

    if (effectiveScope === "ies_semestre" && semestresInFile.length > 0) {
      verifyQuery = verifyQuery.in('semestre', semestresInFile);
    }

    const { count: finalCount, error: countErr } = await verifyQuery;
    const actualCount = finalCount || 0;

    if (countErr) {
      console.warn(LOG_PREFIX, `Request ${requestId}: Verification count error for IES ${iesId}:`, countErr);
    } else {
      verifiedTotal += actualCount;
      expectedTotal += expectedForIes;

      if (actualCount !== expectedForIes) {
        console.warn(LOG_PREFIX, `Request ${requestId}: VERIFICATION MISMATCH for IES ${iesId}: expected=${expectedForIes}, actual=${actualCount}`);
      } else {
        console.log(LOG_PREFIX, `Request ${requestId}: IES ${iesId} verified OK: ${actualCount} records`);
      }
    }
  }

  console.log(LOG_PREFIX, `Request ${requestId}: smart_import done — inserted=${totalInserted}, deleted=${totalDeleted}, unchanged=${totalUnchanged}, errors=${totalErrors}, verified=${verifiedTotal}/${expectedTotal}`);

  return jsonResponse({
    success: totalErrors === 0,
    requestId,
    counts: {
      inserted: totalInserted,
      updated: 0,
      deleted: totalDeleted,
      unchanged: totalUnchanged,
      ignored: 0,
      errors: totalErrors,
    },
    verification: {
      expected: expectedTotal,
      actual: verifiedTotal,
      match: verifiedTotal === expectedTotal,
    },
    errors: errorRows.filter(r => r.status === "error"),
  });
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
    const effectiveScope = config.mode === "MERGE" ? "ies_semestre" : config.scope;

    let deleteQuery = supabaseAdmin
      .from("conteudos")
      .delete({ count: "exact" })
      .eq("id_ies", scope.iesId);

    if (effectiveScope === "ies_semestre" && scope.semestres.length > 0) {
      deleteQuery = deleteQuery.in("semestre", scope.semestres);
    }

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

  const sample = rows.slice(0, 3).map((r) => ({
    row: r.rowNumber, ies: r.id_ies, sem: r.semestre, mat: r.materia,
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

// ─── Legacy: APPEND ──────────────────────────────────────────────────────────

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
    if (action === "smart_import") {
      return await handleSmartImport(supabaseAdmin, body, requestId);
    }

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

    // Legacy MERGE/REPLACE — redirect to smart_import
    console.warn(LOG_PREFIX, `Request ${requestId}: Legacy MERGE/REPLACE redirected to smart_import`);
    return await handleSmartImport(supabaseAdmin, body, requestId);

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
