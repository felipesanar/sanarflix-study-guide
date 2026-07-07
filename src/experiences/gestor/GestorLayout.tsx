import * as React from 'react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileDown, Sparkles, GraduationCap, ArrowRight, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { GlobalFilterBar } from '@/components/analytics/v2/shell/GlobalFilterBar';
import { InstitutionalAlertBanner } from '@/components/analytics/v2/shell/InstitutionalAlertBanner';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import {
  GestorFiltersProvider,
  useGestorFilters,
} from '@/experiences/gestor/GestorFiltersProvider';
import { SidebarIesContext } from '@/experiences/gestor/shell/SidebarIesContext';
import { GestorLoading } from '@/experiences/gestor/ui';
import { CopilotoStrip, deriveInsights } from '@/experiences/gestor/copiloto';

const userInitials = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/**
 * Cartão do usuário no topo da sidebar — mesmo padrão visual do
 * {@link SidebarUserCard} do aluno (avatar gradiente + dot emerald
 * pulsante + hover lift), simplificado: sem Popover de configurações.
 */
const GestorUserCard: React.FC<{ nome: string | undefined }> = ({ nome }) => {
  const initials = userInitials(nome);

  return (
    <motion.div
      whileHover={{ y: -1, scale: 1.01 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="group relative rounded-xl p-3 bg-gradient-to-br from-card via-card to-secondary/20 border border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md group-hover:shadow-lg transition-all duration-200">
            {initials ? (
              <span className="text-sm font-semibold text-primary-foreground">{initials}</span>
            ) : (
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            )}
          </div>
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-sidebar shadow-sm"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-sidebar-foreground">{nome}</p>
          <p className="text-xs text-muted-foreground truncate">Gestão acadêmica</p>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Conteúdo do console de Gestão: sidebar de navegação (com o contexto global
 * de IES no topo — {@link SidebarIesContext}), topbar de ações e barra de
 * recorte (filtros globais), todos ligados ao {@link GestorFiltersProvider}.
 * O módulo ativo é a rota-filha (Outlet).
 */
const GestorLayoutContent: React.FC = () => {
  const { user, access, logout } = useAuth();
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
    bootstrapping,
    isRefreshing,
  } = useGestorFilters();

  const [exportOpen, setExportOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const accessibleIes = user?.accessible_ies ?? [];
  const canSeeAllIes = can(access, 'ies.manage');
  // Lista de IES selecionáveis no contexto global: o iesList do provider já é
  // escopado (todas as IES p/ admin com ies.manage, IES do grupo p/
  // gestor_grupo, a própria p/ gestor) — accessible_ies do user é só fallback.
  const selectableIes = iesList.length > 0 ? iesList : accessibleIes;
  const isMultiIes = selectableIes.length > 1;
  const navItems = filterGestorNav(GESTOR_NAV, access, selectableIes.length);
  const [askQuestion, setAskQuestion] = useState<string | undefined>(undefined);
  const insights = useMemo(
    () => deriveInsights(location.pathname, filteredData, filters, simuladoNome),
    [location.pathname, filteredData, filters, simuladoNome],
  );
  const handleAskQuestion = (q: string) => {
    setAskQuestion(q);
    setChatOpen(true);
  };

  const activeIesNome = isMultiIes || canSeeAllIes
    ? (selectableIes.find((ies) => ies.id === filters.iesId)?.nome ?? (filters.iesId ? undefined : (canSeeAllIes ? 'Todas as IES' : selectableIes[0]?.nome)) ?? user?.ies_nome)
    : user?.ies_nome;

  const handleSelectIes = (iesId: string, _iesNome: string) => {
    updateFilter('iesId', iesId);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5 px-1">
            <img
              src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
              alt="SanarFlix Academy"
              loading="lazy"
              className="w-10 h-10 shrink-0 rounded-xl shadow-md object-contain ring-2 ring-primary/10 hover:ring-primary/20 transition-all duration-200"
            />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-bold text-lg text-sidebar-foreground leading-tight tracking-tight truncate">
                Academy
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium truncate">
                Gestão
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 space-y-4">
          <div className="px-2 pt-1">
            <SidebarIesContext
              activeIesNome={activeIesNome}
              accessibleIes={selectableIes}
              canSeeAllIes={canSeeAllIes}
              activeIesId={filters.iesId}
              onSelectIes={handleSelectIes}
            />
          </div>

          <div className="px-2 group-data-[collapsible=icon]:hidden">
            <GestorUserCard nome={user?.nome} />
          </div>

          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium px-3 mb-2 group-data-[collapsible=icon]:hidden">
              Menu principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild tooltip={item.label} className="p-0">
                        <NavLink
                          to={item.path}
                          className={`group relative flex items-center gap-3 py-2.5 rounded-xl px-3 ml-1 transition-all duration-200 ease-out ${
                            isActive
                              ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="gestor-active-indicator"
                              className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-full"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <Icon
                            className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                              isActive ? 'scale-105 text-primary' : 'group-hover:scale-105'
                            }`}
                          />
                          <span className="text-sm truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                          {item.badge && (
                            <Badge className="ml-auto shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-semibold px-1.5 py-0.5 leading-none group-data-[collapsible=icon]:hidden">
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

        <SidebarFooter className="p-3 group-data-[collapsible=icon]:items-center">
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full h-11 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:px-0"
          >
            <LogOut className="h-4 w-4 mr-2 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:hidden">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
          </Button>
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-x-clip bg-background relative">
        {/* Fundo premium — padrão da Home do aluno */}
        <div className="fixed inset-0 gradient-mesh pointer-events-none" />
        <div className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]">
          <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>

        {/* Topbar */}
        <header
          className={`sticky top-0 z-30 transition-all duration-300 ${
            scrolled ? 'bg-background/60 backdrop-blur-md border-b border-border/20' : 'bg-transparent border-b border-transparent'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
            <SidebarTrigger className="md:hidden shrink-0" />

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
                className="group h-8 text-xs gap-1.5 rounded-xl bg-gradient-to-r from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 shadow-md hover:shadow-lg transition-all duration-300 text-primary-foreground"
                onClick={() => setChatOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" /> Assistente
              </Button>
              <ThemeToggle />
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
                isRefreshing={isRefreshing}
              />
              {filteredData?.headerSummary && (
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  Base: {filteredData.headerSummary.baseLabel ?? 'IES inteira'} ·{' '}
                  <span className="font-mono tabular-nums">{filteredData.headerSummary.totalAlunos}</span> alunos
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Banner de sanção — InstitutionalAlertBanner já tem chrome próprio
            (ícone + borda); não duplicamos com um wrapper premium por cima
            (ver nota de decisão no relatório de entrega). Some durante o
            bootstrap para não piscar antes do recorte estar resolvido. */}
        {!bootstrapping && data?.headerSummary?.sancao && (
          <div className="relative px-4 pt-4 md:px-6">
            <InstitutionalAlertBanner
              sancao={data.headerSummary.sancao}
              percentProficientes={data.headerSummary.basePctProficientes ?? data.headerSummary.percentProficientes}
              conceitoScoped={data.headerSummary.conceitoScoped}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs group"
                  onClick={() => navigate('/gestor/intervencao-impacto')}
                >
                  Ver plano de ação
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              }
            />
          </div>
        )}

        {/* Copiloto — insights contextuais da tela atual, com próximos passos */}
        {!bootstrapping && insights.length > 0 && (
          <div className="px-4 pt-4 md:px-6">
            <div className="max-w-[1280px] mx-auto">
              <CopilotoStrip insights={insights} onAskQuestion={handleAskQuestion} />
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative flex-1 px-4 py-6 md:px-6"
        >
          <div className="max-w-[1280px] mx-auto">
            {bootstrapping ? (
              // Contexto (IES/simulado) ainda não resolvido — skeleton do
              // console inteiro. Nenhuma página chega a renderizar com
              // filtros vazios/transitórios (zero flash de GestorEmpty).
              <GestorLoading />
            ) : (
              <div
                className={`relative transition-opacity duration-200 ${
                  isRefreshing ? 'opacity-60 pointer-events-none' : 'opacity-100'
                }`}
                aria-busy={isRefreshing}
              >
                <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
                  <Outlet />
                </Suspense>

                {isRefreshing && (
                  <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3.5 py-2 shadow-lg backdrop-blur-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Atualizando…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.main>
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
        onClose={() => {
          setChatOpen(false);
          setAskQuestion(undefined);
        }}
        data={filteredData}
        route={location.pathname}
        filters={filters}
        simuladoNome={simuladoNome}
        initialQuestion={askQuestion}
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
