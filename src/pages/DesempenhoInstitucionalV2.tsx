import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { FileDown, Sparkles, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useDesempenhoV2State } from '@/hooks/useDesempenhoV2State';
import { useInstitutionalPerformanceData } from '@/hooks/useInstitutionalPerformanceData';
import { InstitutionalHeader } from '@/components/analytics/v2/shell/InstitutionalHeader';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { PerformanceModuleTabs } from '@/components/analytics/v2/shell/PerformanceModuleTabs';
import { ModuleContentRenderer } from '@/components/analytics/v2/shell/ModuleContentRenderer';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';
import { applyDesempenhoV2Filters } from '@/utils/desempenhoV2Filters';

function extractAreasFromData(data: InstitutionalViewModel) {
  const areas = new Set<string>();
  data.allStudents.forEach((s) => {
    Object.keys(s.scoresByArea).forEach((a) => areas.add(a));
  });
  return Array.from(areas).sort().map((a) => ({ id: a, label: a }));
}

function extractSemestresFromData(data: InstitutionalViewModel) {
  const sems = new Set<string>();
  data.allStudents.forEach((s) => {
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

const DebugPanel: React.FC<{ data: InstitutionalViewModel | null; filteredData: InstitutionalViewModel | null }> = ({ data, filteredData }) => {
  const [open, setOpen] = useState(false);

  if (!data) return null;

  const summary = {
    raw: {
      allStudents: data.allStudents.length,
      alunosAbaixo: data.alunosAbaixo.length,
      areas: data.curricular.areas.length,
      temas: data.curricular.areas.reduce((s, a) => s + a.specialties.reduce((ss, sp) => ss + sp.temas.length, 0), 0),
      percentProficientes: data.headerSummary.percentProficientes,
    },
    filtered: filteredData ? {
      allStudents: filteredData.allStudents.length,
      alunosAbaixo: filteredData.alunosAbaixo.length,
      areas: filteredData.curricular.areas.length,
      temas: filteredData.curricular.areas.reduce((s, a) => s + a.specialties.reduce((ss, sp) => ss + sp.temas.length, 0), 0),
      percentProficientes: filteredData.headerSummary.percentProficientes,
    } : null,
  };

  return (
    <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 p-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-mono text-amber-700 dark:text-amber-400 w-full"
      >
        <Bug className="h-3.5 w-3.5" />
        <span>Debug Mode</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>
      {open && (
        <pre className="mt-3 text-[10px] font-mono text-amber-800 dark:text-amber-300 overflow-auto max-h-64 whitespace-pre-wrap">
          {JSON.stringify(summary, null, 2)}
        </pre>
      )}
    </div>
  );
};

const DesempenhoInstitucionalV2: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get('debug') === 'true';
  const { activeTab, setActiveTab, filters, updateFilter, clearFilters, autoSelectSimulado } = useDesempenhoV2State();
  const { data, simulados, iesList, loading, error, usingMock, refetch } = useInstitutionalPerformanceData(filters);
  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const filteredData = useMemo(() => {
    return applyDesempenhoV2Filters(data, filters);
  }, [data, filters]);

  const simuladoNome = simulados.find(s => s.id === filters.simuladoId)?.nome;

  useEffect(() => {
    autoSelectSimulado(simulados);
  }, [simulados, autoSelectSimulado]);

  return (
    <motion.div
      className="space-y-4 pb-8 max-w-7xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Debug panel */}
      {isDebug && <DebugPanel data={data} filteredData={filteredData} />}

      {/* Header area */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <InstitutionalHeader summary={data?.headerSummary} />
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => setExportOpen(true)}>
              <FileDown className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={() => setChatOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" /> IA
            </Button>
          </div>
        </div>

        {/* Filters */}
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

        <InstitutionalAlertBanner
          sancao={data?.headerSummary?.sancao}
          percentProficientes={data?.headerSummary?.percentProficientes}
          conceitoScoped={data?.headerSummary?.conceitoScoped}
        />
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-muted/30 px-2 py-1.5">
        <PerformanceModuleTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Module Content */}
      <ModuleContentRenderer
        activeTab={activeTab}
        data={filteredData}
        loading={loading}
        error={error}
        onRetry={refetch}
        iesId={filters.iesId}
      />

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
