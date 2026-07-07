import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DataBadge, MonoValue, AdminLoading, AdminError } from '@/experiences/admin/ui';
import { useAdminMonitorSummary } from '@/services/admin/monitor';

/**
 * Bloco "Integridade — saídas de aba / tela cheia" — contagem real (24h) de
 * finalizações com 3+ saídas, com link para a fila de revisão em Liberações.
 */
export function IntegridadeBlock() {
  const { data, isLoading, isError, refetch } = useAdminMonitorSummary();
  const n = data?.integridade_24h.finalizacoes_com_3mais_saidas;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Integridade — saídas de aba / tela cheia
        </span>
        <DataBadge kind="real" />
      </div>

      {isLoading && <AdminLoading rows={2} rowHeight="h-6" />}
      {isError && !isLoading && (
        <AdminError message="Não foi possível carregar admin_monitor_summary." onRetry={() => refetch()} />
      )}
      {!isLoading && !isError && typeof n === 'number' && (
        <p className="text-sm">
          <MonoValue className="text-lg font-semibold">{n}</MonoValue> finalizações com 3+ saídas nas últimas 24h —
          potenciais candidatas a revisão de liberação.
        </p>
      )}

      <Link
        to="/admin/simulados?tab=liberacoes"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Ver em Liberações <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
