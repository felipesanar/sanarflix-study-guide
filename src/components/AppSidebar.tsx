
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { getAccessRules, isB2BUser } from '@/utils/accessRules';
import { BookOpen, BarChart3, LogOut, User, Zap, ClipboardCheck, UserCog, ChevronDown, ChevronRight, FileText, TrendingUp, Home as HomeIcon } from 'lucide-react';

const menuItems = [
  {
    title: 'Início',
    url: '/home',
    icon: HomeIcon,
    accessKey: 'home' as const,
  },
  {
    title: 'Intensivão ENAMED',
    url: '/intensivao-enamed',
    icon: Zap,
    accessKey: 'enamed' as const,
  },
  {
    title: 'Intensivo ENAMED - USCS',
    url: '/intensivo-uscs',
    icon: BookOpen,
    accessKey: 'intensivoUSCS' as const,
  },
  {
    title: 'Cronograma ENAMED',
    url: '/cronograma-enamed',
    icon: FileText,
    accessKey: 'cronogramaEnamed' as const,
  },
  {
    title: 'Desempenho Simulado',
    url: '/desempenho-simulado',
    icon: ClipboardCheck,
    accessKey: 'SimuladoDesempenho' as const,
  },
  {
    title: 'Gestão de Usuários',
    url: '/gestao-usuarios',
    icon: UserCog,
    accessKey: 'userManagement' as const,
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: TrendingUp,
    accessKey: 'analytics' as const,
  },
];

const studyGuideItems = [
  {
    title: 'Seu guia',
    url: '/guia-estudos',
    icon: BookOpen,
    accessKey: 'studyGuide' as const,
  },
  {
    title: 'Seu progresso',
    url: '/dashboard',
    icon: BarChart3,
    accessKey: 'dashboard' as const,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, logout } = useAuth();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const accessRules = getAccessRules(user);
  const [studyGuideOpen, setStudyGuideOpen] = useState(false);

  const isActive = (path: string) => currentPath === path;
  const isStudyGuideAreaActive = () => 
    studyGuideItems.some(item => isActive(item.url) && accessRules[item.accessKey]);

  React.useEffect(() => {
    if (isStudyGuideAreaActive()) {
      setStudyGuideOpen(true);
    }
  }, [currentPath]);

  // Unified selected style for ALL buttons
  const selectedButtonStyle = 'bg-blue-800 text-white font-medium shadow-lg border border-blue-700/20 rounded-lg transition-all duration-200';
  const hoverButtonStyle = 'text-[hsl(var(--sidebar-foreground))]/80 hover:bg-blue-600/20 hover:text-[hsl(var(--sidebar-foreground))] hover:shadow-md transition-all duration-200 rounded-lg shadow-sm hover:shadow-blue-500/10 hover:scale-[1.02]';

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? selectedButtonStyle : hoverButtonStyle;

  const getParentNavCls = (isOpen: boolean) =>
    isOpen ? selectedButtonStyle : hoverButtonStyle;

  const getChildNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? `${selectedButtonStyle} ml-6 pl-4`
      : 'text-[hsl(var(--sidebar-foreground))]/70 hover:bg-blue-600/15 hover:text-[hsl(var(--sidebar-foreground))] hover:shadow-sm transition-all duration-200 rounded-lg ml-6 pl-4 shadow-sm hover:shadow-blue-500/5 hover:scale-[1.01]';

  return (
    <Sidebar
      className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 border-r border-[hsl(var(--sidebar-border))] shadow-lg bg-[hsl(var(--sidebar-background))] gradient-sidebar text-[hsl(var(--sidebar-foreground))]`}
      collapsible="icon"
    >
      <SidebarHeader className={`p-4 border-b border-[hsl(var(--sidebar-border))] ${collapsed ? 'px-2' : ''}`}>
        <div className="flex items-center gap-3">
          <img
            src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
            alt="Sanarflix - logo do site"
            className="w-10 h-10 rounded-xl shadow-lg object-contain"
          />
          {!collapsed && (
            <div className="animate-fade-in">
              <h2 className="font-bold text-lg text-[hsl(var(--sidebar-foreground))]">Sanarflix</h2>
              <p className="text-xs text-[hsl(var(--sidebar-accent-foreground))]">Guia de Estudos</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {/* User Info */}
        {user && (
          <div className={`mb-4 p-3 bg-[hsl(var(--sidebar-background))] rounded-lg shadow-sm ${collapsed ? 'px-1' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-full border border-primary/30">
                <User className="h-4 w-4 text-primary-light" />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1 animate-fade-in">
                  <p className="text-sm font-medium text-[hsl(var(--sidebar-foreground))] truncate">
                    {user.nome}
                  </p>
                  <p className="text-xs text-[hsl(var(--sidebar-accent-foreground))] truncate">
                    {user.ies_nome} - {user.semestre}º período
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className={`${collapsed ? 'sr-only' : ''} text-[hsl(var(--sidebar-accent-foreground))] text-xs uppercase tracking-wider font-semibold`}>
            Menu Principal
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Home - Always visible for authenticated users */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/home" 
                    end 
                    className={getNavCls}
                  >
                    <HomeIcon className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'} transition-all duration-200`} />
                    {!collapsed && <span className="animate-fade-in transition-all duration-200">Início</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Guia de Estudos - Parent Item with Collapsible Children */}
              {(accessRules.studyGuide || accessRules.dashboard) && (
                <SidebarMenuItem>
                  <Collapsible open={studyGuideOpen} onOpenChange={setStudyGuideOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        className={getParentNavCls(studyGuideOpen)}
                      >
                        <BookOpen className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'} transition-all duration-200`} />
                        {!collapsed && (
                          <>
                            <span className="animate-fade-in transition-all duration-200 flex-1">Guia de Estudos</span>
                            {studyGuideOpen ? (
                              <ChevronDown className="h-4 w-4 transition-transform duration-300 rotate-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 transition-transform duration-300 rotate-0" />
                            )}
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent className="transition-all duration-300 ease-in-out overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <div className="mt-2 space-y-1 border-l-2 border-blue-200/30 ml-5">
                          {studyGuideItems.filter(item => accessRules[item.accessKey]).map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <NavLink 
                                  to={item.url} 
                                  end 
                                  className={getChildNavCls}
                                >
                                  <item.icon className="h-4 w-4 mr-3 transition-all duration-200" />
                                  <span className="animate-fade-in transition-all duration-200 text-sm">{item.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </div>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* Other Menu Items */}
              {menuItems.filter(item => {
                // Special case for analytics - only show to B2B users
                if (item.accessKey === 'analytics') {
                  return isB2BUser(user);
                }
                return accessRules[item.accessKey];
              }).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={getNavCls}
                    >
                      <item.icon className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'} transition-all duration-200`} />
                      {!collapsed && (
                        <span className="animate-fade-in transition-all duration-200">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        <Button
          onClick={logout}
          variant="ghost"
          className={`w-full justify-start text-primary-light hover:text-white hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all duration-200 ${
            collapsed ? 'px-2' : ''
          }`}
        >
          <LogOut className={`h-4 w-4 ${collapsed ? 'mx-auto' : 'mr-2'} transition-colors-smooth`} />
          {!collapsed && <span className="font-medium">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
