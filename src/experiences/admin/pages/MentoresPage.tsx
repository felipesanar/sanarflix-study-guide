import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { MentoresBoard } from '@/components/admin/mentores/MentoresBoard';

/** Seção "Mentores" do Portal do Admin (`/admin/mentores`) — tela A1 do handoff. */
const MentoresPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader
      title="Mentores"
      subtitle="Cadastre mentores B2C e B2B e importe os alunos de cada turma. Um aluno tem um mentor por vez."
    />
    <MentoresBoard />
  </div>
);

export default MentoresPage;
