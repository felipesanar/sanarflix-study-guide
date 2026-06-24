import { VisaoAlunosModule } from '@/components/analytics/v2/modules/VisaoAlunosModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

export default function AlunosPage() {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <VisaoAlunosModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
}
