import * as React from 'react';
import { InsightsPedagogicosModule } from '@/components/analytics/v2/modules/InsightsPedagogicosModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

/** Módulo Insights Pedagógicos do gestor (`/gestor/insights-pedagogicos`). */
const InsightsPedagogicosPage: React.FC = () => {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <InsightsPedagogicosModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
};

export default InsightsPedagogicosPage;
