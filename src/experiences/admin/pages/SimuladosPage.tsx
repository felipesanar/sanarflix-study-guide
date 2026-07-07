import * as React from 'react';

/**
 * Seção Simulados do Portal do Admin (`/admin/simulados`).
 *
 * Placeholder da reescrita do shell (contrato §C1/§C2 — Provas & Questões,
 * Liberações & Importar respostas): cabeçalho definitivo, conteúdo pendente
 * (sub-abas por estado: provas | liberações | importar, reapresentando
 * `SimuladosTab`/`LiberacoesTab`/`SimuladosImportRespostasTab`).
 */
const SimuladosPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Simulados</h1>
    <p className="text-sm text-muted-foreground">Provas, liberações e importação de respostas.</p>
    <div />
  </div>
);

export default SimuladosPage;
