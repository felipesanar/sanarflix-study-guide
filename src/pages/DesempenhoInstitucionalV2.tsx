import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useDesempenhoV2State } from '@/hooks/useDesempenhoV2State';
import { useInstitutionalPerformanceData } from '@/hooks/useInstitutionalPerformanceData';
import { InstitutionalHeader } from '@/components/analytics/v2/shell/InstitutionalHeader';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { PerformanceModuleTabs } from '@/components/analytics/v2/shell/PerformanceModuleTabs';
import { PerformanceContextBar } from '@/components/analytics/v2/shell/PerformanceContextBar';
import { ModuleContentRenderer } from '@/components/analytics/v2/shell/ModuleContentRenderer';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';
import { applyDesempenhoV2Filters } from '@/utils/desempenhoV2Filters';

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

function extractEspecialidadesFromData(data: InstitutionalViewModel) {
  const especialidades = new Set<string>();
  data.curricular.areas.forEach((area) => {
    area.specialties.forEach((specialty) => especialidades.add(specialty.name));
  });
  return Array.from(especialidades).sort().map((value) => ({ id: value, label: value }));
}

function extractTemasFromData(data: InstitutionalViewModel) {
  const temas = new Set<string>();
  data.curricular.areas.forEach((area) => {
    area.specialties.forEach((specialty) => {
      specialty.temas.forEach((tema) => temas.add(tema.name));
    });
  });
  return Array.from(temas).sort().map((value) => ({ id: value, label: value }));
}

const DesempenhoInstitucionalV2: React.FC = () => {
  const { activeTab, setActiveTab, filters, updateFilter, clearFilters, autoSelectSimulado } = useDesempenhoV2State();
  const { data, simulados, iesList, loading, error, usingMock, refetch } = useInstitutionalPerformanceData(filters);
  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const filteredData = useMemo(() => {
    const nextData = applyDesempenhoV2Filters(data, filters);
    console.log('[DesempenhoInstitucionalV2]', 'Recorte aplicado', {
      areas: filters.areas.length,
      especialidades: filters.especialidades.length,
      temas: filters.temas.length,
      semestres: filters.semestres.length,
      hasData: Boolean(nextData),
    });
    return nextData;
  }, [data, filters]);

  const simuladoNome = simulados.find(s => s.id === filters.simuladoId)?.nome;

  // Auto-select first simulado
  useEffect(() => {
    autoSelectSimulado(simulados);
  }, [simulados, autoSelectSimulado]);

  console.log('[DesempenhoInstitucionalV2]', 'Render da shell', { activeTab, usingMock, hasData: !!filteredData });

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
              availableEspecialidades={data ? extractEspecialidadesFromData(data) : []}
              availableSemestres={data ? extractSemestresFromData(data) : []}
              availableTemas={data ? extractTemasFromData(data) : []}
              usingMock={usingMock}
            />
          </div>
        </div>
        <InstitutionalAlertBanner
          sancao={data?.headerSummary?.sancao}
          percentProficientes={data?.headerSummary?.percentProficientes}
        />
      </div>

      {/* Tabs + action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PerformanceModuleTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setExportOpen(true)}>
            <FileDown className="h-3.5 w-3.5" /> Exportar
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setChatOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" /> Assistente IA
          </Button>
        </div>
      </div>

      <PerformanceContextBar activeTab={activeTab} filters={filters} usingMock={usingMock} />

      {/* Module Content */}
      <div>
        <ModuleContentRenderer
          activeTab={activeTab}
          data={filteredData}
          loading={loading}
          error={error}
          onRetry={refetch}
        />
      </div>

      {/* Drawers */}
      <ExportReportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        data={filteredData}
        filters={filters}
        simuladoNome={simuladoNome}
      />
      <AiChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        data={filteredData}
        activeTab={activeTab}
      />
    </motion.div>
  );
};

export default DesempenhoInstitucionalV2;
