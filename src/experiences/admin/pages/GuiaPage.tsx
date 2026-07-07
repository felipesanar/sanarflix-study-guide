import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { StudyGuideImportTab } from '@/components/admin/StudyGuideImportTab';

/**
 * Seção Guia de Estudos do Portal do Admin (`/admin/guia`) — contrato §E.
 *
 * MANTIDA por decisão do contrato (feature real em uso, fora do protótipo).
 * Página fina: só o cabeçalho novo em volta do wizard existente
 * (`StudyGuideImportTab`/`StudyGuideImportWizard`) — o wizard em si não foi alterado.
 */
const GuiaPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader title="Guia de Estudos" subtitle="Conteúdo do Guia de Estudos por IES e semestre." />
    <StudyGuideImportTab />
  </div>
);

export default GuiaPage;
