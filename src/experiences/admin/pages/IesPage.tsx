import * as React from 'react';

/**
 * Seção IES do Portal do Admin (`/admin/ies`).
 *
 * Placeholder da reescrita do shell (contrato §E — IES): cabeçalho
 * definitivo, conteúdo pendente (cards por IES com switches das 9 features,
 * "alterações pendentes" + Salvar via RPC `admin_set_ies_features`).
 */
const IesPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">IES</h1>
    <p className="text-sm text-muted-foreground">Instituições parceiras e features habilitadas por IES.</p>
    <div />
  </div>
);

export default IesPage;
