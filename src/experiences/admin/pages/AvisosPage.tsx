import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';

/**
 * Seção Avisos do Portal do Admin (`/admin/avisos`) — contrato §E.
 *
 * Reapresenta o CRUD real de `AnnouncementsTab`/`AnnouncementEditor` no
 * vocabulário do console (cards com barra de cor, badge de prioridade,
 * toggle ativo real e exclusão com `DangerZone` + auditoria).
 */
const AvisosPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader title="Avisos" subtitle="Avisos e comunicados exibidos aos alunos." />
    <AnnouncementsTab />
  </div>
);

export default AvisosPage;
