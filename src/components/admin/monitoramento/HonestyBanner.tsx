import { AlertTriangle } from 'lucide-react';

/**
 * Banner de honestidade sobre os dados de monitoramento (contrato §D).
 * O código antigo (`MonitoramentoTab`) fabricava métricas (tempo médio =
 * duração×0,7; abandono fixo em 15%) — este banner declara isso abertamente
 * e cada bloco abaixo diz se usa dado real ou requer backend/instrumentação.
 */
export function HonestyBanner() {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-amber-900 dark:text-amber-200">Honestidade sobre os dados.</p>
        <p className="text-amber-800/90 dark:text-amber-200/80">
          Monitoramento em tempo real ainda não é instrumentado — o código antigo (MonitoramentoTab) usava valores
          fabricados (tempo médio = duração×0,7; abandono fixo em 15%). Abaixo, cada bloco declara se usa dado real
          ou se requer backend novo.
        </p>
      </div>
    </div>
  );
}
