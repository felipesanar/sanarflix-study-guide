import { DataBadge, MonoValue } from '@/experiences/admin/ui';
import { AdminLoading, AdminError } from '@/experiences/admin/ui';
import { useAdminMonitorSummary } from '@/services/admin/monitor';

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

  // P3 (auditoria): "hoje" é sempre um dia PARCIAL (ainda em andamento) sendo
  // comparado com "ontem", um dia COMPLETO — de manhã, hoje < ontem quase
  // sempre, então o accent vermelho/verde pintava um falso "piorou" que é só
  // efeito do horário do dia, não uma tendência real. Fix: cor neutra sempre
  // + rótulo deixando explícito que "ontem" é dia completo.
  return (
    <p className="text-sm font-medium text-muted-foreground">
      {arrow} {Math.abs(diff)} vs ontem <span className="font-normal">(ontem: {ontem} — dia completo)</span>
    </p>
  );
}
