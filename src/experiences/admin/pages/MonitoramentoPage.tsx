import * as React from 'react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HonestyBanner } from '@/components/admin/monitoramento/HonestyBanner';
import { EmProvaAgoraBlock } from '@/components/admin/monitoramento/EmProvaAgoraBlock';
import { FinalizacoesHojeBlock } from '@/components/admin/monitoramento/FinalizacoesHojeBlock';
import { ErrorRatesBlock } from '@/components/admin/monitoramento/ErrorRatesBlock';
import { IntegridadeBlock } from '@/components/admin/monitoramento/IntegridadeBlock';

/**
 * Seção Monitoramento (`/admin/monitoramento`) — contrato §D.
 *
 * Substitui o antigo `MonitoramentoTab`/`RealtimeDashboard` (removidos: eram
 * dashboards com métricas fabricadas — tempo médio = duração×0,7, abandono
 * fixo em 15%). Aqui cada bloco declara explicitamente se usa dado real
 * (`admin_monitor_summary`/`admin_question_error_rates`) ou se requer
 * instrumentação ainda não construída (sessões de prova em tempo real).
 *
 * P2 (auditoria): o QueryClient global (`src/App.tsx`) desliga
 * refetchOnMount/Focus/Reconnect para a app inteira, e os hooks de
 * `services/admin/monitor.ts` só tinham `staleTime` (inócuo sem um gatilho
 * de fato) — a tela ficava "congelada" até o admin dar F5. Os hooks agora têm
 * `refetchInterval: 60s` + `refetchOnMount: 'always'`; o botão "Atualizar"
 * abaixo é o gatilho manual complementar (invalida as 3 queries do monitor).
 */
const MonitoramentoPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'monitor-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'monitor-simulados-selecao'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'monitor-question-error-rates'] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Monitoramento operacional"
        subtitle="Acompanhamento de simulados em andamento e integridade das provas."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <HonestyBanner />

      <div className="grid gap-4 sm:grid-cols-2">
        <EmProvaAgoraBlock />
        <FinalizacoesHojeBlock />
        <ErrorRatesBlock />
        <IntegridadeBlock />
      </div>
    </div>
  );
};

export default MonitoramentoPage;
