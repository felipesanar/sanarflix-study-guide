import * as React from 'react';
import { SectionHeader } from '@/experiences/gestor/ui';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import { IntervencaoImpactoContent } from '@/components/gestor/intervencao/IntervencaoImpactoContent';

/** Intervenção & impacto do gestor (`/gestor/intervencao-impacto`). */
const IntervencaoPage: React.FC = () => {
  const { filteredData, loading, error, usingMock, refetch } = useGestorFilters();

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Intervenção & impacto" title="Onde intervir primeiro e o retorno esperado" />
      <IntervencaoImpactoContent
        data={filteredData}
        loading={loading}
        error={error}
        usingMock={usingMock}
        onRetry={refetch}
      />
    </div>
  );
};

export default IntervencaoPage;
