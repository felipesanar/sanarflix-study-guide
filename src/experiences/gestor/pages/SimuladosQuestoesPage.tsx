import * as React from 'react';
import { SectionHeader } from '@/experiences/gestor/ui';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import { SimuladosQuestoesContent } from '@/components/gestor/simulados-questoes/SimuladosQuestoesContent';

/** Simulados & questões do gestor (`/gestor/simulados-questoes`) — caderno de erros da turma. */
const SimuladosQuestoesPage: React.FC = () => {
  const { filters, simuladoNome } = useGestorFilters();

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Simulados & questões" title="Caderno de erros da turma" />
      <SimuladosQuestoesContent
        simuladoId={filters.simuladoId || undefined}
        iesId={filters.iesId || undefined}
        simuladoNome={simuladoNome}
      />
    </div>
  );
};

export default SimuladosQuestoesPage;
