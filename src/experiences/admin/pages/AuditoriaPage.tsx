import * as React from 'react';

/**
 * Seção Auditoria do Portal do Admin (`/admin/auditoria`) — NOVA, capability
 * `admin.tools`.
 *
 * Placeholder da reescrita do shell (contrato §F — Auditoria): cabeçalho
 * definitivo, conteúdo pendente (filtros + AdminTable paginada via
 * `admin_get_audit_log`, mapa action→frase compartilhado com o Command
 * Center).
 */
const AuditoriaPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
    <p className="text-sm text-muted-foreground">Trilha de auditoria de ações administrativas.</p>
    <div />
  </div>
);

export default AuditoriaPage;
