import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { IesFeaturesBoard } from '@/components/admin/ies/IesFeaturesBoard';

/**
 * Seção IES do Portal do Admin (`/admin/ies`) — contrato §E.
 *
 * Cards por IES com as 9 features configuráveis (switches), diff local de
 * "alterações pendentes" e "Salvar" por IES via RPC `admin_set_ies_features`
 * (ver {@link IesFeaturesBoard}).
 */
const IesPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader
      title="IES & contratos"
      subtitle="O que cada faculdade tem contratado e quais features estão ligadas. Alterações salvam por IES."
    />
    <IesFeaturesBoard />
  </div>
);

export default IesPage;
