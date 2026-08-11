import * as React from 'react';
import { VisaoAlunosModule } from '@/components/analytics/v2/modules/VisaoAlunosModule';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';

/** Módulo Visão de Alunos do gestor (`/gestor/alunos`). */
const AlunosPage: React.FC = () => {
  const { filteredData, loading, error, refetch } = useGestorFilters();
  return (
    <VisaoAlunosModule
      data={filteredData}
      loading={loading}
      error={error}
      onRetry={refetch}
    />
  );
};

export default AlunosPage;
