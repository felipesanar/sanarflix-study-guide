/**
 * Chamadas à edge `admin-import-simulado-responses` (dry-run e importação em chunks), extraídas de
 * `ImportarRespostasTab` sem mudar o comportamento, para serem usadas também pela Leitura de cartões.
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import {
  CHUNK_SIZE,
  DRY_RUN_CHUNK_SIZE,
  type FinalReport,
  type PreviewResult,
  type PreviewSummary,
} from './importar-respostas-types';

/** Uma linha da importação: 1ª coluna (Matrícula/RA ou e-mail) e respostas por questão ("1".."N"). */
export interface LinhaImportacao {
  matricula_ra: string;
  answers: Record<string, string | null>;
}

export interface OpcoesImportacao {
  simuladoId: string;
  conflictMode: 'skip' | 'replace';
  /** Já resolvido pelo chamador (com o fallback de data), igual em todos os chunks. */
  sourceLabel: string;
  rows: LinhaImportacao[];
}

const EDGE = 'admin-import-simulado-responses';

/** Rótulo padrão do lote, calculado uma vez por execução (achado P3). */
export function rotuloDoLote(sourceLabel: string): string {
  return sourceLabel || `Importação ${new Date().toISOString()}`;
}

async function detalheDoErro(error: { message?: string; context?: Response }): Promise<string> {
  let detail = error.message ?? 'Falha desconhecida';
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.text === 'function') {
      const body = await ctx.text();
      if (body) detail = body.length > 500 ? `${body.slice(0, 500)}…` : body;
    }
  } catch {
    /* ignore */
  }
  return detail;
}

/**
 * Dry-run. A edge limita 200 linhas por chamada (inclusive no dry-run), então chunka aqui também
 * (achado P1) e agrega os resumos.
 */
export async function previewImportacao(
  opts: OpcoesImportacao & { textAsBlank?: number },
): Promise<{ results: PreviewResult[]; summary: PreviewSummary }> {
  const results: PreviewResult[] = [];
  const summary: PreviewSummary = {
    total: 0, ok: 0, warning: 0, error: 0, already_finalized: 0,
    multi_marked_cells: 0, multi_marked_rows: 0, text_as_blank_cells: opts.textAsBlank ?? 0,
  };
  for (let i = 0; i < opts.rows.length; i += DRY_RUN_CHUNK_SIZE) {
    const chunk = opts.rows.slice(i, i + DRY_RUN_CHUNK_SIZE);
    const { data, error } = await supabase.functions.invoke(EDGE, {
      body: {
        simulado_id: opts.simuladoId,
        conflict_mode: opts.conflictMode,
        source_label: opts.sourceLabel,
        dry_run: true,
        rows: chunk.map((r) => ({ matricula_ra: r.matricula_ra, answers: r.answers })),
      },
    });
    if (error) {
      const detail = await detalheDoErro(error as { message?: string; context?: Response });
      Logger.error('[import-preview] edge function error', error, detail);
      throw new Error(detail);
    }
    const d = data as { results: PreviewResult[]; summary: PreviewSummary };
    results.push(...d.results);
    summary.total += d.summary.total;
    summary.ok += d.summary.ok;
    summary.warning += d.summary.warning;
    summary.error += d.summary.error;
    summary.multi_marked_cells = (summary.multi_marked_cells ?? 0) + (d.summary.multi_marked_cells ?? 0);
    summary.multi_marked_rows = (summary.multi_marked_rows ?? 0) + (d.summary.multi_marked_rows ?? 0);
    summary.already_finalized += d.summary.already_finalized;
  }
  return { results, summary };
}

export interface ChunkInfo {
  current: number;
  total: number;
  processed: number;
  totalRows: number;
}

/**
 * Importação real em chunks de 50, com o mesmo batch_id. Com `chunk_meta`, a edge acumula os contadores do
 * lote e só grava o audit log no último chunk. `deveCancelar` é consultado antes de cada chunk.
 */
export async function executarImportacao(
  opts: OpcoesImportacao & {
    defaultDate?: string;
    onChunk?: (info: ChunkInfo) => void;
    onProgress?: (pct: number) => void;
    deveCancelar?: () => boolean;
  },
): Promise<{ report: FinalReport; cancelled: boolean }> {
  const { rows } = opts;
  const batchId = crypto.randomUUID();
  const allResults: PreviewResult[] = [];
  let imported = 0, skipped = 0, replaced = 0, failed = 0;
  const totalChunks = Math.ceil(rows.length / CHUNK_SIZE) || 1;
  opts.onChunk?.({ current: 0, total: totalChunks, processed: 0, totalRows: rows.length });

  let cancelled = false;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    if (opts.deveCancelar?.()) {
      cancelled = true;
      break;
    }
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    opts.onChunk?.({ current: chunkIndex, total: totalChunks, processed: i, totalRows: rows.length });
    const { data, error } = await supabase.functions.invoke(EDGE, {
      body: {
        simulado_id: opts.simuladoId,
        conflict_mode: opts.conflictMode,
        source_label: opts.sourceLabel,
        batch_id: batchId,
        default_finalizado_em: opts.defaultDate || undefined,
        chunk_meta: { total_rows: rows.length, is_last: chunkIndex === totalChunks },
        rows: chunk.map((r) => ({ matricula_ra: r.matricula_ra, answers: r.answers })),
      },
    });
    if (error) throw error;
    const d = data as { results: PreviewResult[]; summary: { imported: number; skipped: number; replaced: number; failed: number } };
    allResults.push(...d.results);
    imported += d.summary.imported;
    skipped += d.summary.skipped;
    replaced += d.summary.replaced;
    failed += d.summary.failed;
    opts.onProgress?.(Math.round(((i + chunk.length) / rows.length) * 100));
  }
  return {
    report: { batch_id: batchId, summary: { total: rows.length, imported, skipped, replaced, failed }, results: allResults },
    cancelled,
  };
}
