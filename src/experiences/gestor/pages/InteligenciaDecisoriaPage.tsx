import * as React from 'react';
import { InteligenciaDecisoriModule } from '@/components/analytics/v2/modules/InteligenciaDecisoriModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

/** Módulo Inteligência Decisória do gestor (`/gestor/inteligencia-decisoria`). */
const InteligenciaDecisoriaPage: React.FC = () => {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <InteligenciaDecisoriModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
};

export default InteligenciaDecisoriaPage;
