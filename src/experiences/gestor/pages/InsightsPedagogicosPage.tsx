import { InsightsPedagogicosModule } from '@/components/analytics/v2/modules/InsightsPedagogicosModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

export default function InsightsPedagogicosPage() {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <InsightsPedagogicosModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
}
