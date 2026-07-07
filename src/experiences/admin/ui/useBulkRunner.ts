import { useCallback, useRef, useState } from 'react';
import type { BulkPhase, PreviewStats, RunResult, RunResultItem } from './bulk-types';

export interface BulkExecuteChunkResult {
  ok: number;
  falhas: Array<{ linha: number; mensagem: string }>;
}

export interface BulkRunnerConfig<TRow> {
  /** Converte um arquivo (upload) em linhas tipadas. Omitir se as linhas já vêm de outro lugar (ex.: seleção na tabela). */
  parse?: (file: File) => Promise<TRow[]>;
  /** Dry-run: valida/classifica as linhas antes de executar (nunca deve escrever no backend). */
  dryRun: (rows: TRow[]) => Promise<PreviewStats>;
  /** Executa um chunk. `signal` é abortado quando o usuário cancela — repasse para fetch/invoke quando possível. */
  execute: (chunk: TRow[], signal: AbortSignal) => Promise<BulkExecuteChunkResult>;
  /** Tamanho de cada chunk enviado para `execute`. */
  chunkSize: number;
  /** Pausa entre chunks (ms), para não sobrecarregar edge functions. */
  interChunkDelayMs?: number;
}

export interface BulkRunnerState<TRow> {
  phase: BulkPhase;
  /** Linhas carregadas (via `loadFile` ou `setRows`) — entrada do dry-run/execução. */
  rows: TRow[];
  fileName: string | null;
  previewStats: PreviewStats | null;
  progress: { done: number; total: number };
  result: RunResult | null;
  error: string | null;
}

export interface BulkRunnerActions<TRow> {
  loadFile: (file: File) => Promise<void>;
  /** Define as linhas diretamente, sem passar por `parse` (ex.: linhas já vêm de uma seleção na UI). */
  setRows: (rows: TRow[]) => void;
  runDryRun: () => Promise<void>;
  start: () => Promise<void>;
  /** Sinaliza cancelamento: nenhum novo chunk é iniciado; o chunk em voo é abortado via AbortSignal. */
  cancel: () => void;
  reset: () => void;
}

export type UseBulkRunnerReturn<TRow> = BulkRunnerState<TRow> & { actions: BulkRunnerActions<TRow> };

const INITIAL_PROGRESS = { done: 0, total: 0 };

/**
 * Hook genérico para operações em lote com dry-run, chunking, cancelamento e relatório final.
 * Modelado a partir de SimuladosImportRespostasTab (dry-run/cancel/histórico) e
 * StudyGuideImportWizard (steps upload→configure→validate→import→result).
 */
export function useBulkRunner<TRow>(config: BulkRunnerConfig<TRow>): UseBulkRunnerReturn<TRow> {
  const { parse, dryRun, execute, chunkSize, interChunkDelayMs = 0 } = config;

  const [phase, setPhase] = useState<BulkPhase>('idle');
  const [rows, setRowsState] = useState<TRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    cancelRequestedRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPhase('idle');
    setRowsState([]);
    setFileName(null);
    setPreviewStats(null);
    setProgress(INITIAL_PROGRESS);
    setResult(null);
    setError(null);
  }, []);

  const setRows = useCallback((next: TRow[]) => {
    setRowsState(next);
    setPreviewStats(null);
    setResult(null);
    setError(null);
    setProgress(INITIAL_PROGRESS);
    setPhase('idle');
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      if (!parse) {
        setError('Este fluxo não aceita upload de arquivo.');
        return;
      }
      setError(null);
      try {
        const parsed = await parse(file);
        setFileName(file.name);
        setRows(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao ler o arquivo.');
      }
    },
    [parse, setRows],
  );

  const runDryRun = useCallback(async () => {
    if (rows.length === 0) return;
    setPhase('preview');
    setError(null);
    try {
      const stats = await dryRun(rows);
      setPreviewStats(stats);
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Falha na pré-visualização.');
    }
  }, [rows, dryRun]);

  const cancel = useCallback(() => {
    cancelRequestedRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    if (rows.length === 0) return;
    cancelRequestedRef.current = false;
    setPhase('running');
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: rows.length });

    let ok = 0;
    let falhas = 0;
    const itens: RunResultItem[] = [];
    let cancelled = false;

    try {
      for (let i = 0; i < rows.length; i += chunkSize) {
        if (cancelRequestedRef.current) {
          cancelled = true;
          break;
        }

        const chunk = rows.slice(i, i + chunkSize);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const chunkResult = await execute(chunk, controller.signal);
        ok += chunkResult.ok;
        falhas += chunkResult.falhas.length;
        for (const f of chunkResult.falhas) {
          itens.push({ linha: f.linha, status: 'erro', mensagem: f.mensagem });
        }

        const done = Math.min(i + chunk.length, rows.length);
        setProgress({ done, total: rows.length });

        if (cancelRequestedRef.current) {
          cancelled = true;
          break;
        }
        if (interChunkDelayMs > 0 && i + chunkSize < rows.length) {
          await new Promise((resolve) => setTimeout(resolve, interChunkDelayMs));
        }
      }

      const canceladas = cancelled ? Math.max(rows.length - ok - falhas, 0) : 0;
      setResult({ ok, falhas, canceladas, itens });
      setPhase(cancelled ? 'cancelled' : 'done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Falha ao executar o lote.');
    } finally {
      abortControllerRef.current = null;
    }
  }, [rows, chunkSize, interChunkDelayMs, execute]);

  return {
    phase,
    rows,
    fileName,
    previewStats,
    progress,
    result,
    error,
    actions: { loadFile, setRows, runDryRun, start, cancel, reset },
  };
}
