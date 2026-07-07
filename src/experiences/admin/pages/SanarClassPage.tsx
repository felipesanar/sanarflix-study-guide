import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import SanarClassTab from '@/components/admin/SanarClassTab';

/**
 * Seção SanarClass do Portal do Admin (`/admin/sanarclass`) — contrato §E.
 *
 * Reapresenta o CRUD real de materiais (bucket `sanarclass-files`) via
 * `AdminTable` — badge de tipo, IES, semestre, disciplina, professor, tamanho
 * real do arquivo e exclusão com `DangerZone` + auditoria.
 */
const SanarClassPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader title="SanarClass" subtitle="Materiais e aulas do SanarClass por IES." />
    <SanarClassTab />
  </div>
);

export default SanarClassPage;
