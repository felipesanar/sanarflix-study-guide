import { useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AdminError } from './AdminError';
import { AdminPartial } from './AdminPartial';
import { StatCard } from './StatCard';
import { DangerZone } from './DangerZone';
import type { BulkRunnerState } from './useBulkRunner';
import type { RunResult } from './bulk-types';

export interface BulkRunnerPanelMetricLabels {
  novos?: string;
  atualizados?: string;
  conflitos?: string;
  erros?: string;
}

export interface BulkRunnerPanelProps<TRow> {
  state: Pick<BulkRunnerState<TRow>, 'phase' | 'previewStats' | 'progress' | 'result' | 'error'>;
  onStart: () => void | Promise<void>;
  onCancel: () => void;
  onReset: () => void;
  chunkSize: number;
  /** Se definido, "Iniciar processamento" passa por DangerZone level="high" exigindo esta palavra. */
  confirmWord?: string;
  title?: string;
  startLabel?: string;
  /** Nome do arquivo gerado por "Baixar relatório de falhas". */
  reportFileName?: string;
  metricLabels?: BulkRunnerPanelMetricLabels;
  /** Slot extra na fase `done` (ex.: batch_id, "registrado em admin_audit_log"). */
  extraDone?: ReactNode;
  /** Unidade usada no contador de progresso (ex.: "linha(s)", "aluno(s)"). */
  unidadeLabel?: string;
}

function downloadFailuresXlsx(result: RunResult, fileName: string) {
  const rows = result.itens
    .filter((item) => item.status === 'erro')
    .map((item) => ({ linha: item.linha, mensagem: item.mensagem ?? '' }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Falhas');
  XLSX.writeFile(wb, fileName);
}

/**
 * Renderiza a UI de uma operação em lote por fase (preview → running → done/cancelled → error),
 * a partir do estado produzido por `useBulkRunner`. Fase `idle` não renderiza nada — a tela
 * (upload/seleção de linhas) fica a cargo do chamador, que então dispara `runDryRun()`.
 */
export function BulkRunnerPanel<TRow>({
  state,
  onStart,
  onCancel,
  onReset,
  chunkSize,
  confirmWord,
  title = 'Confirmar processamento em lote',
  startLabel = 'Iniciar processamento',
  reportFileName = 'relatorio-falhas.xlsx',
  metricLabels,
  extraDone,
  unidadeLabel = 'linha(s)',
}: BulkRunnerPanelProps<TRow>) {
  const [dangerOpen, setDangerOpen] = useState(false);
  const { phase, previewStats, progress, result, error } = state;

  if (phase === 'error') {
    return <AdminError message={error ?? 'Erro desconhecido.'} onRetry={onReset} />;
  }

  if (phase === 'preview' && previewStats) {
    const handleStartClick = () => {
      if (confirmWord) {
        setDangerOpen(true);
      } else {
        void onStart();
      }
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <StatCard label="Total" value={previewStats.total} />
          {previewStats.novos !== undefined && (
            <StatCard label={metricLabels?.novos ?? 'Novos'} value={previewStats.novos} accent="emerald" />
          )}
          {previewStats.atualizados !== undefined && (
            <StatCard label={metricLabels?.atualizados ?? 'Atualizados'} value={previewStats.atualizados} accent="blue" />
          )}
          {previewStats.conflitos !== undefined && (
            <StatCard label={metricLabels?.conflitos ?? 'Conflitos'} value={previewStats.conflitos} accent="amber" />
          )}
          <StatCard label={metricLabels?.erros ?? 'Erros'} value={previewStats.erros} accent="red" />
        </div>
        <Button onClick={handleStartClick} disabled={previewStats.total === 0}>
          {startLabel}
        </Button>

        {confirmWord && (
          <DangerZone
            open={dangerOpen}
            onOpenChange={setDangerOpen}
            level="high"
            confirmWord={confirmWord}
            title={title}
            impact={
              <>
                Serão processadas <strong className="font-mono">{previewStats.total}</strong> {unidadeLabel} em lotes de{' '}
                <strong className="font-mono">{chunkSize}</strong>.
              </>
            }
            actionLabel={startLabel}
            onConfirm={onStart}
          />
        )}
      </div>
    );
  }

  if (phase === 'running') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="space-y-3">
        <Progress value={pct} />
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          {progress.done} / {progress.total} {unidadeLabel} · chunks de {chunkSize}
        </p>
        <Button variant="outline" className="text-red-600 dark:text-red-400" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" /> Cancelar processamento
        </Button>
      </div>
    );
  }

  if ((phase === 'done' || phase === 'cancelled') && result) {
    return (
      <div className="space-y-4">
        {phase === 'cancelled' && (
          <p className="text-sm text-muted-foreground">
            Processamento interrompido — {result.canceladas} {unidadeLabel} não chegaram a ser processadas.
          </p>
        )}
        {result.falhas > 0 ? (
          <AdminPartial
            ok={result.ok}
            falhas={result.falhas}
            viewFailuresLabel="Baixar relatório de falhas"
            onViewFailures={() => downloadFailuresXlsx(result, reportFileName)}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-mono tabular-nums font-semibold">{result.ok}</span> {unidadeLabel} processadas com sucesso.
          </div>
        )}
        {extraDone}
        <Button variant="outline" onClick={onReset}>
          Novo processamento
        </Button>
      </div>
    );
  }

  return null;
}
