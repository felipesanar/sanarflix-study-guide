import * as React from 'react';

/**
 * Command Center (`/admin` index) — home do Portal do Admin.
 *
 * Placeholder da reescrita do shell (contrato §A — Command Center): cabeçalho
 * definitivo, conteúdo pendente (saudação dinâmica, fila "Precisa da sua
 * atenção", KPIs de "Saúde da plataforma" e "Auditoria recente" via
 * `useAdminAttention`/`admin_command_center`).
 */
const CommandCenterPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
    <p className="text-sm text-muted-foreground">Visão geral e pendências da plataforma.</p>
    <div />
  </div>
);

export default CommandCenterPage;
