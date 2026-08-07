import * as React from 'react';
import { VisaoInstitucionalModule } from '@/components/analytics/v2/modules/VisaoInstitucionalModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

/** Módulo Visão Institucional do gestor (`/gestor/visao-institucional`). */
const VisaoInstitucionalPage: React.FC = () => {
  const { filteredData, loading, error, refetch, filters } = useGestorFilters();
  return (
    <VisaoInstitucionalModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
      baseMode={filters.baseMode}
    />
  );
};

export default VisaoInstitucionalPage;
