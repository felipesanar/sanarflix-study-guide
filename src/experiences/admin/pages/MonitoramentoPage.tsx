import * as React from 'react';

/**
 * Seção Monitoramento do Portal do Admin (`/admin/monitoramento`) — NOVA.
 *
 * Placeholder da reescrita do shell (contrato §D — Monitoramento): cabeçalho
 * definitivo, conteúdo pendente (banner de honestidade de dados + blocos "Em
 * prova agora" [requer instrumentação], "Finalizações hoje", "Questões com
 * maior taxa de erro" e "Integridade — saídas de aba/tela", via
 * `admin_monitor_summary`/`admin_question_error_rates`).
 */
const MonitoramentoPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Monitoramento</h1>
    <p className="text-sm text-muted-foreground">
      Métricas ao vivo da plataforma — separando dado real de instrumentação pendente.
    </p>
    <div />
  </div>
);

export default MonitoramentoPage;
