import React from 'react';
import type { DesempenhoV2Tab, InstitutionalViewModel } from '@/types/desempenhoV2';
import { VisaoInstitucionalModule } from '@/components/analytics/v2/modules/VisaoInstitucionalModule';
import { DiagnosticoCurricularModule } from '@/components/analytics/v2/modules/DiagnosticoCurricularModule';
import { VisaoAlunosModule } from '@/components/analytics/v2/modules/VisaoAlunosModule';
import { InsightsPedagogicosModule } from '@/components/analytics/v2/modules/InsightsPedagogicosModule';
import { InteligenciaDecisoriModule } from '@/components/analytics/v2/modules/InteligenciaDecisoriModule';

interface ModuleContentRendererProps {
  activeTab: DesempenhoV2Tab;
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  iesId?: string;
  baseMode?: 'sixth-year' | 'general' | 'semestres';
}

export const ModuleContentRenderer: React.FC<ModuleContentRendererProps> = ({
  activeTab,
  data,
  loading,
  error,
  onRetry,
  iesId,
  baseMode,
}) => {
  if (activeTab === 'visao-institucional') {
    return <VisaoInstitucionalModule data={data} loading={loading} error={error} onRetry={onRetry} baseMode={baseMode} />;
  }

  if (activeTab === 'diagnostico-curricular') {
    return <DiagnosticoCurricularModule data={data} loading={loading} error={error} onRetry={onRetry} iesId={iesId} />;
  }

  if (activeTab === 'visao-alunos') {
    return <VisaoAlunosModule data={data} loading={loading} error={error} onRetry={onRetry} />;
  }

  if (activeTab === 'insights-pedagogicos') {
    return <InsightsPedagogicosModule data={data} loading={loading} error={error} onRetry={onRetry} />;
  }

  return <InteligenciaDecisoriModule data={data} loading={loading} error={error} onRetry={onRetry} />;
};
