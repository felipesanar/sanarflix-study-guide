import * as React from 'react';

/**
 * Seção Avisos do Portal do Admin (`/admin/avisos`).
 *
 * Placeholder da reescrita do shell (contrato §E — Avisos): cabeçalho
 * definitivo, conteúdo pendente (reapresenta `AnnouncementsTab`/Editor como
 * cards com badge de prioridade, toggle ativo real e auditoria via
 * `admin_log_action`).
 */
const AvisosPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Avisos</h1>
    <p className="text-sm text-muted-foreground">Avisos e comunicados exibidos aos alunos.</p>
    <div />
  </div>
);

export default AvisosPage;
