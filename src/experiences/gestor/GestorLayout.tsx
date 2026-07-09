import * as React from 'react';
import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FileDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { InstitutionalHeader } from '@/components/analytics/v2/shell/InstitutionalHeader';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';
import { GESTOR_NAV, filterGestorNav, tabForPath } from '@/experiences/gestor/GestorNav';
import {
  GestorFiltersProvider,
  useGestorFilters,
} from '@/experiences/gestor/GestorFiltersProvider';
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';
import { getPortalEntries } from '@/experiences/shared/globalNav';
import { FeedbackHeaderButton } from '@/components/feedback/FeedbackHeaderButton';

/**
 * Conteúdo do layout do gestor: consome os filtros globais do contexto e
 * renderiza o cabeçalho, a barra de filtros, a sub-navegação por rota (NavLink)
 * e o módulo ativo (Outlet). O módulo ativo é derivado da rota.
 */
const GestorLayoutContent: React.FC = () => {
  const { access } = useAuth();
  const {
    filters,
    updateFilter,
    clearFilters,
    data,
    filteredData,
    simulados,
    iesList,
    usingMock,
    availableSemestres,
    simuladoNome,
  } = useGestorFilters();

  const location = useLocation();
  const activeTab = tabForPath(location.pathname);

  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const { hasFeature } = useEffectiveFeatures();
  const navItems = filterGestorNav(GESTOR_NAV, access, hasFeature);
  const canExport = hasFeature('gestao.exportar');
  const canChat = hasFeature('gestao.ia');
  // Outros portais do usuário, exceto a Gestão (já estamos nela).
  const otherPortals = getPortalEntries(access).filter((entry) => entry.url !== '/gestor');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="space-y-4 pb-8 max-w-7xl mx-auto">
        {/* Cabeçalho + ações */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <InstitutionalHeader summary={data?.headerSummary} />
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {otherPortals.map(({ title, url, icon: Icon }) => (
                <NavLink
                  key={url}
                  to={url}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors h-8"
                >
                  {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {title}
                </NavLink>
              ))}
              <GoToStudentButton className="h-8" />
              {canExport && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => setExportOpen(true)}
                >
                  <FileDown className="h-3.5 w-3.5" /> Exportar
                </Button>
              )}
              {canChat && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => setChatOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" /> IA
                </Button>
              )}
              <FeedbackHeaderButton />
            </div>
          </div>

          {/* Filtros globais (preservados entre os módulos via GestorFiltersProvider) */}
          <GlobalFilterBar
            filters={filters}
            onFilterChange={updateFilter}
            onClearFilters={clearFilters}
            simulados={simulados}
            iesList={iesList}
            availableSemestres={availableSemestres}
            usingMock={usingMock}
          />

          <InstitutionalAlertBanner
            sancao={data?.headerSummary?.sancao}
            percentProficientes={
              data?.headerSummary?.basePctProficientes ??
              data?.headerSummary?.percentProficientes
            }
            conceitoScoped={data?.headerSummary?.conceitoScoped}
          />
        </div>

        {/* Sub-navegação por rota (módulos) */}
        <div className="rounded-xl bg-muted/30 px-2 py-1.5">
          <nav
            role="tablist"
            aria-label="Módulos do Desempenho Institucional"
            className="flex items-center gap-1 overflow-x-auto scrollbar-none"
          >
            {navItems.map(({ title, url }) => (
              <NavLink
                key={url}
                to={url}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-lg transition-colors shrink-0',
                    isActive
                      ? 'bg-background border border-border/80 shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground/80 hover:bg-accent/40',
                  )
                }
              >
                {title}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Módulo ativo */}
        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>

        {/* Drawers */}
        {canExport && (
          <ExportReportDrawer
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            data={filteredData}
            filters={filters}
            simuladoNome={simuladoNome}
          />
        )}
        {canChat && (
          <AiChatDrawer
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            data={filteredData}
            activeTab={activeTab}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Layout da experiência Gestão (`/gestor/*`) — shell full-page independente.
 *
 * Envolve o conteúdo no {@link GestorFiltersProvider} para que os filtros
 * globais e os dados institucionais sejam compartilhados e preservados ao
 * alternar entre os módulos (rotas-filhas).
 */
export const GestorLayout: React.FC = () => (
  <GestorFiltersProvider>
    <GestorLayoutContent />
  </GestorFiltersProvider>
);
