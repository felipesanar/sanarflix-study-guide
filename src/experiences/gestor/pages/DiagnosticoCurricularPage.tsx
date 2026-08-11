import * as React from 'react';
import { DiagnosticoCurricularModule } from '@/components/analytics/v2/modules/DiagnosticoCurricularModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

/** Módulo Diagnóstico Curricular do gestor (`/gestor/diagnostico-curricular`). */
const DiagnosticoCurricularPage: React.FC = () => {
  const { filteredData, loading, error, refetch, filters } = useGestorFilters();
  return (
    <DiagnosticoCurricularModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
      iesId={filters.iesId}
    />
  );
};

export default DiagnosticoCurricularPage;
