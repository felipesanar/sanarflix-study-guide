import { InteligenciaDecisoriModule } from '@/components/analytics/v2/modules/InteligenciaDecisoriModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

export default function InteligenciaDecisoriaPage() {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <InteligenciaDecisoriModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
}
