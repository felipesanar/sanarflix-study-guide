import { VisaoInstitucionalModule } from '@/components/analytics/v2/modules/VisaoInstitucionalModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

export default function VisaoInstitucionalPage() {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <VisaoInstitucionalModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
}
