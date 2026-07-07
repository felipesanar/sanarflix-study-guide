import { DataBadge, MonoValue } from '@/experiences/admin/ui';
import { AdminLoading, AdminError } from '@/experiences/admin/ui';
import { useAdminMonitorSummary } from '@/services/admin/monitor';
import { cn } from '@/lib/utils';

/** Bloco "Finalizações hoje" — dado real de `admin_monitor_summary`, com delta vs ontem e fonte citada. */
export function FinalizacoesHojeBlock() {
  const { data, isLoading, isError, refetch } = useAdminMonitorSummary();

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Finalizações hoje</span>
        <DataBadge kind="real" />
      </div>

      {isLoading && <AdminLoading rows={2} rowHeight="h-6" />}
      {isError && !isLoading && <AdminError message="Não foi possível carregar admin_monitor_summary." onRetry={() => refetch()} />}
      {!isLoading && !isError && data && (
        <>
          <MonoValue className="text-3xl font-semibold">{data.finalizacoes_hoje}</MonoValue>
          <DeltaVsOntem hoje={data.finalizacoes_hoje} ontem={data.finalizacoes_ontem} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Fonte: <MonoValue muted>simulados_finalizados</MonoValue>
      </p>
    </div>
  );
}

function DeltaVsOntem({ hoje, ontem }: { hoje: number; ontem: number }) {
  const diff = hoje - ontem;
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
  const accent =
    diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';

  return (
    <p className={cn('text-sm font-medium', accent)}>
      {arrow} {Math.abs(diff)} vs ontem <span className="text-muted-foreground font-normal">({ontem} ontem)</span>
    </p>
  );
}
