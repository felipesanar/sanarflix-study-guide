import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

import { useDesempenhoV2State } from '@/hooks/useDesempenhoV2State';
import { useInstitutionalPerformanceData } from '@/hooks/useInstitutionalPerformanceData';
import { InstitutionalHeader } from '@/components/analytics/v2/shell/InstitutionalHeader';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { PerformanceModuleTabs } from '@/components/analytics/v2/shell/PerformanceModuleTabs';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import { VisaoInstitucionalModule } from '@/components/analytics/v2/modules/VisaoInstitucionalModule';
import { DiagnosticoCurricularModule } from '@/components/analytics/v2/modules/DiagnosticoCurricularModule';
import { VisaoAlunosModule } from '@/components/analytics/v2/modules/VisaoAlunosModule';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';

// Extract unique areas from student score data for filter options
function extractAreasFromData(data: InstitutionalViewModel) {
  const areas = new Set<string>();
  data.alunosAbaixo.forEach((s) => {
    Object.keys(s.scoresByArea).forEach((a) => areas.add(a));
  });
  return Array.from(areas).sort().map((a) => ({ id: a, label: a }));
}

// Extract unique semestres from student data
function extractSemestresFromData(data: InstitutionalViewModel) {
  const sems = new Set<string>();
  data.alunosAbaixo.forEach((s) => {
    if (s.semestre) sems.add(String(s.semestre));
  });
  return Array.from(sems).sort((a, b) => Number(a) - Number(b)).map((s) => ({ id: s, label: `${s}º Semestre` }));
}

const DesempenhoInstitucionalV2: React.FC = () => {
  const { activeTab, setActiveTab, filters, updateFilter, clearFilters, autoSelectSimulado } = useDesempenhoV2State();
  const { data, simulados, iesList, loading, error, usingMock, refetch } = useInstitutionalPerformanceData(filters);

  // Auto-select first simulado
  useEffect(() => {
    autoSelectSimulado(simulados);
  }, [simulados, autoSelectSimulado]);

  console.log('[DesempenhoV2:Shell]', 'Render', { activeTab, usingMock, hasData: !!data });

  return (
    <motion.div
      className="space-y-6 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header + Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <InstitutionalHeader summary={data?.headerSummary} />
          <div className="shrink-0">
            <GlobalFilterBar
              filters={filters}
              onFilterChange={updateFilter}
              onClearFilters={clearFilters}
              simulados={simulados}
              iesList={iesList}
              availableAreas={data ? extractAreasFromData(data) : []}
              availableSemestres={data ? extractSemestresFromData(data) : []}
              usingMock={usingMock}
            />
          </div>
        </div>
        <InstitutionalAlertBanner
          sancao={data?.headerSummary?.sancao}
          percentProficientes={data?.headerSummary?.percentProficientes}
        />
      </div>

      {/* Tabs */}
      <PerformanceModuleTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Module Content */}
      <div>
        {activeTab === 'visao-institucional' && (
          <VisaoInstitucionalModule
            data={data}
            loading={loading}
            error={error}
            onRetry={refetch}
          />
        )}
        {activeTab === 'diagnostico-curricular' && (
          <DiagnosticoCurricularModule
            data={data}
            loading={loading}
            error={error}
            onRetry={refetch}
          />
        )}
        {activeTab === 'visao-alunos' && (
          <ModuleEmptyState
            title="Visão de Alunos"
            description="Ranking e acompanhamento individual dos alunos com segmentação por risco e oportunidade."
          />
        )}
        {activeTab === 'insights-pedagogicos' && (
          <ModuleEmptyState
            title="Insights Pedagógicos"
            description="Recomendações baseadas em dados com priorização por prevalência e impacto institucional."
          />
        )}
        {activeTab === 'inteligencia-decisoria' && (
          <ModuleEmptyState
            title="Inteligência Decisória"
            description="Simulação de impacto institucional e priorização de intervenções pedagógicas."
          />
        )}
      </div>
    </motion.div>
  );
};

export default DesempenhoInstitucionalV2;
