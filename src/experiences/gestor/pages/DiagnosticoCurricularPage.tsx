import { DiagnosticoCurricularModule } from '@/components/analytics/v2/modules/DiagnosticoCurricularModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

export default function DiagnosticoCurricularPage() {
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
}
