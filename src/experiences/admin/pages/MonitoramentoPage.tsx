import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
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
 */
const MonitoramentoPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader
      title="Monitoramento operacional"
      subtitle="Acompanhamento de simulados em andamento e integridade das provas."
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

export default MonitoramentoPage;
