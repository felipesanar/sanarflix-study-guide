import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import { DiagnosticoCurricularView } from '@/components/gestor/diagnostico/DiagnosticoCurricularView';

/** Diagnóstico curricular do gestor (`/gestor/diagnostico-curricular`). */
const DiagnosticoPage: React.FC = () => {
  const { user } = useAuth();
  const { filteredData, loading, error, usingMock, refetch, filters, simuladoNome } = useGestorFilters();

  const iesId = filters.iesId || user?.id_ies || undefined;

  return (
    <DiagnosticoCurricularView
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
      usingMock={usingMock}
      iesId={iesId}
      simuladoNome={simuladoNome}
    />
  );
};

export default DiagnosticoPage;
