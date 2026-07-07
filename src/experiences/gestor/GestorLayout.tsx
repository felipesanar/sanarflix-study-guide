import * as React from 'react';
import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FileDown, Sparkles, ChevronDown, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import {
  GestorFiltersProvider,
  useGestorFilters,
} from '@/experiences/gestor/GestorFiltersProvider';
import type { DesempenhoV2Tab } from '@/types/desempenhoV2';

/**
 * Mapeia a rota ativa do console novo para o `DesempenhoV2Tab` mais próximo
 * — usado apenas para dar contexto ao `AiChatDrawer` (que ainda referencia o
 * vocabulário de módulos legado). Fallback: 'visao-institucional'.
 */
const TAB_BY_PATH_PREFIX: [prefix: string, tab: DesempenhoV2Tab][] = [
  ['/gestor/panorama', 'visao-institucional'],
  ['/gestor/diagnostico-curricular', 'diagnostico-curricular'],
  ['/gestor/alunos-risco', 'visao-alunos'],
  ['/gestor/intervencao-impacto', 'inteligencia-decisoria'],
  ['/gestor/simulados-questoes', 'insights-pedagogicos'],
  ['/gestor/comparar-ies', 'visao-institucional'],
  ['/gestor/relatorios', 'visao-institucional'],
];

const tabForPath = (pathname: string): DesempenhoV2Tab =>
  TAB_BY_PATH_PREFIX.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'visao-institucional';

const iesInitials = (nome: string): string =>
  nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const userInitials = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/**
 * Conteúdo do console de Gestão: sidebar de navegação, topbar (seletor de
 * IES + ações) e barra de recorte (filtros globais), todos ligados ao
 * {@link GestorFiltersProvider}. O módulo ativo é a rota-filha (Outlet).
 */
const GestorLayoutContent: React.FC = () => {
  const { user, access } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const accessibleIes = user?.accessible_ies ?? [];
  const isMultiIes = accessibleIes.length > 1;
  const navItems = filterGestorNav(GESTOR_NAV, access, accessibleIes.length);
  const activeTab = tabForPath(location.pathname);

  const activeIesNome = isMultiIes
    ? (accessibleIes.find((ies) => ies.id === filters.iesId)?.nome ?? accessibleIes[0]?.nome ?? user?.ies_nome)
    : user?.ies_nome;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              S
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-bold text-sidebar-foreground leading-tight truncate">SanarFlix</p>
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase truncate">
                Academy · Gestão
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <NavLink to={item.path}>
                          <Icon />
                          <span>{item.label}</span>
                          {item.badge && (
                            <Badge className="ml-auto h-4 px-1.5 text-[9px] font-semibold uppercase leading-none group-data-[collapsible=icon]:hidden">
                              {item.badge}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
              {userInitials(user?.nome) || <GraduationCap className="h-4 w-4" />}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.nome}</p>
              <p className="text-[11px] text-muted-foreground truncate">Gestão acadêmica</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-clip bg-background">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
            <SidebarTrigger className="md:hidden shrink-0" />

            {/* Seletor de IES */}
            {isMultiIes ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-1.5 text-left hover:bg-accent/50 transition-colors">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[11px] font-semibold">
                      {iesInitials(activeIesNome ?? '')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase leading-none">
                        Grupo educacional
                      </p>
                      <p className="text-sm font-semibold text-foreground truncate max-w-[160px] leading-tight mt-0.5">
                        {activeIesNome}
                      </p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {accessibleIes.map((ies) => (
                    <DropdownMenuItem
                      key={ies.id}
                      onClick={() => updateFilter('iesId', ies.id)}
                      className="gap-2.5"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                        {iesInitials(ies.nome)}
                      </div>
                      <span className="truncate">{ies.nome}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase leading-none">
                  Instituição
                </p>
                <p className="text-sm font-semibold text-foreground truncate leading-tight mt-0.5">
                  {activeIesNome}
                </p>
              </div>
            )}

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate('/')}>
                Ver como aluno
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setExportOpen(true)}
              >
                <FileDown className="h-3.5 w-3.5" /> Exportar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setChatOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" /> Assistente
              </Button>
            </div>
          </div>

          {/* Barra de recorte */}
          <div className="border-t border-border/60 px-4 py-2.5 md:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <GlobalFilterBar
                filters={filters}
                onFilterChange={updateFilter}
                onClearFilters={clearFilters}
                simulados={simulados}
                iesList={iesList}
                availableSemestres={availableSemestres}
                usingMock={usingMock}
              />
              {data?.headerSummary && (
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  Base: {data.headerSummary.baseLabel ?? 'IES inteira'} ·{' '}
                  <span className="font-mono tabular-nums">{data.headerSummary.totalAlunos}</span> alunos
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Banner de sanção */}
        {data?.headerSummary?.sancao && (
          <div className="px-4 pt-4 md:px-6">
            <InstitutionalAlertBanner
              sancao={data.headerSummary.sancao}
              percentProficientes={data.headerSummary.basePctProficientes ?? data.headerSummary.percentProficientes}
              conceitoScoped={data.headerSummary.conceitoScoped}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigate('/gestor/intervencao-impacto')}
                >
                  Ver plano de ação →
                </Button>
              }
            />
          </div>
        )}

        {/* Conteúdo */}
        <main className="flex-1 px-4 py-6 md:px-6">
          <div className="max-w-[1280px] mx-auto">
            <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
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
    </SidebarProvider>
  );
};

/**
 * Layout da experiência Gestão (`/gestor/*`) — console com sidebar fixa,
 * shell full-page independente.
 *
 * Envolve o conteúdo no {@link GestorFiltersProvider} para que os filtros
 * globais e os dados institucionais sejam compartilhados e preservados ao
 * alternar entre as telas (rotas-filhas).
 */
export const GestorLayout: React.FC = () => (
  <GestorFiltersProvider>
    <GestorLayoutContent />
  </GestorFiltersProvider>
);
