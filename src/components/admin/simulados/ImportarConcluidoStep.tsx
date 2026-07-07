import { AlertCircle, Download, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MonoValue, StatCard } from '@/experiences/admin/ui';
import type { FinalReport } from './importar-respostas-types';

export interface ImportarConcluidoStepProps {
  finalReport: FinalReport;
  cancelled: boolean;
  onDownloadReport: () => void;
  onReset: () => void;
}

/** Passo 4 do wizard: resultado final + batch_id + relatório de falhas + nova importação. */
export function ImportarConcluidoStep({ finalReport, cancelled, onDownloadReport, onReset }: ImportarConcluidoStepProps) {
  const { summary } = finalReport;
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <p className="text-sm">
        <MonoValue className="font-semibold text-emerald-600 dark:text-emerald-400">{summary.imported + summary.replaced}</MonoValue>{' '}
        aluno(s) lançados · <MonoValue className="font-semibold text-amber-600 dark:text-amber-400">{summary.skipped}</MonoValue> pulados ·{' '}
        <MonoValue className="font-semibold text-red-600 dark:text-red-400">{summary.failed}</MonoValue> com erro. Chunks de 50 processados.
      </p>

      {cancelled && <p className="text-sm text-muted-foreground">Processamento interrompido pelo usuário — resultado parcial.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={summary.total} />
        <StatCard label="Importados" value={summary.imported} accent="emerald" />
        <StatCard label="Substituídos" value={summary.replaced} accent="blue" />
        <StatCard label="Pulados" value={summary.skipped} accent="amber" />
        <StatCard label="Falhas" value={summary.failed} accent="red" />
      </div>

      {summary.failed > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{summary.failed} aluno(s) falharam</AlertTitle>
          <AlertDescription>Baixe o relatório para ver os motivos detalhados.</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        <MonoValue muted>batch_id: {finalReport.batch_id}</MonoValue> · registrado em admin_audit_log
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onDownloadReport} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Baixar relatório de falhas
        </Button>
        <Button onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" /> Nova importação
        </Button>
      </div>
    </div>
  );
}
