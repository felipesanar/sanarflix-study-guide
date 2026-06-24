import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InstitutionalHeader } from '@/components/analytics/v2/shell/InstitutionalHeader';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';
import type { DesempenhoV2Tab } from '@/types/desempenhoV2';
import {
  GestorFiltersProvider,
  useGestorFilters,
} from './GestorFiltersProvider';
import { gestorNav } from './GestorNav';

/** Slug da rota → módulo (tab) usado pelos drawers de export/IA. */
const SLUG_TO_TAB: Record<string, DesempenhoV2Tab> = {
  'visao-institucional': 'visao-institucional',
  'diagnostico-curricular': 'diagnostico-curricular',
  alunos: 'visao-alunos',
  'insights-pedagogicos': 'insights-pedagogicos',
  'inteligencia-decisoria': 'inteligencia-decisoria',
};

function GestorShell() {
  const {
    data,
    filteredData,
    filters,
    updateFilter,
    clearFilters,
    simulados,
    iesList,
    usingMock,
    availableAreas,
    availableEspecialidades,
    availableSemestres,
    availableTemas,
  } = useGestorFilters();
  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const location = useLocation();
  const slug = location.pathname.split('/')[2] ?? '';
  const activeTab = SLUG_TO_TAB[slug] ?? 'visao-institucional';
  const simuladoNome = simulados.find((s) => s.id === filters.simuladoId)?.nome;

  return (
    <motion.div
      className="space-y-4 pb-8 max-w-7xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <InstitutionalHeader summary={data?.headerSummary} />
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setExportOpen(true)}
            >
              <FileDown className="h-3.5 w-3.5" /> Exportar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setChatOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5" /> IA
            </Button>
          </div>
        </div>

        {/* Filtros globais — preservados entre as rotas via GestorFiltersProvider */}
        <GlobalFilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          simulados={simulados}
          iesList={iesList}
          availableAreas={availableAreas}
          availableEspecialidades={availableEspecialidades}
          availableSemestres={availableSemestres}
          availableTemas={availableTemas}
          usingMock={usingMock}
        />

        <InstitutionalAlertBanner
          sancao={data?.headerSummary?.sancao}
          percentProficientes={data?.headerSummary?.percentProficientes}
        />
      </div>

      {/* Módulos como rotas */}
      <div className="rounded-xl bg-muted/30 px-2 py-1.5">
        <nav
          className="flex items-center gap-1 overflow-x-auto scrollbar-none"
          role="tablist"
        >
          {gestorNav.map(({ title, url, icon: Icon }) => (
            <NavLink
              key={url}
              to={url}
              role="tab"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-lg transition-colors shrink-0',
                  isActive
                    ? 'bg-background border border-border/80 shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80 hover:bg-accent/40',
                )
              }
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {title}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />

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
}

/** Casca da experiência do Gestor: filtros globais + módulos-como-rota. */
export default function GestorLayout() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <GestorFiltersProvider>
        <GestorShell />
      </GestorFiltersProvider>
    </div>
  );
}
