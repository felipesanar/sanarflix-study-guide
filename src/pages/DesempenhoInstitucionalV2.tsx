import React from 'react';
import { motion } from 'framer-motion';

import { useDesempenhoV2State } from '@/hooks/useDesempenhoV2State';
import { InstitutionalHeader } from '@/components/analytics/v2/shell/InstitutionalHeader';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { PerformanceModuleTabs } from '@/components/analytics/v2/shell/PerformanceModuleTabs';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import { VisaoInstitucionalModule } from '@/components/analytics/v2/modules/VisaoInstitucionalModule';

const DesempenhoInstitucionalV2: React.FC = () => {
  const { activeTab, setActiveTab, filters, updateFilter } = useDesempenhoV2State();

  console.log('[DesempenhoV2:Shell]', 'Page render, activeTab:', activeTab);

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
          <InstitutionalHeader />
          <div className="shrink-0">
            <GlobalFilterBar filters={filters} onFilterChange={updateFilter} />
          </div>
        </div>
        <InstitutionalAlertBanner />
      </div>

      {/* Tabs */}
      <PerformanceModuleTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Module Content */}
      <div>
        {activeTab === 'visao-institucional' && (
          <VisaoInstitucionalModule filters={filters} />
        )}
        {activeTab === 'diagnostico-curricular' && (
          <ModuleEmptyState
            title="Diagnóstico Curricular"
            description="Análise por área, especialidade e tema com drill-down progressivo e navegação em árvore."
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
