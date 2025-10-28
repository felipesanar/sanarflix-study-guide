
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
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getAccessRules, isB2BUser } from '@/utils/accessRules';
import { 
  BookOpen, 
  BarChart3, 
  LogOut, 
  User, 
  Zap, 
  ClipboardCheck, 
  UserCog, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  TrendingUp, 
  Home as HomeIcon,
  Sparkles,
  Crown,
  Settings,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = [
  {
    title: 'Início',
    url: '/home',
    icon: HomeIcon,
    accessKey: 'home' as const,
    description: 'Página inicial do seu hub de estudos'
  },
  {
    title: 'Intensivão ENAMED',
    url: '/intensivao-enamed',
    icon: Zap,
    accessKey: 'enamed' as const,
    description: 'Preparação intensiva para o ENAMED'
  },
  {
    title: 'Intensivo ENAMED - USCS',
    url: '/intensivo-uscs',
    icon: BookOpen,
    accessKey: 'intensivoUSCS' as const,
    description: 'Conteúdo exclusivo USCS'
  },
  {
    title: 'Cronograma ENAMED',
    url: '/cronograma-enamed',
    icon: FileText,
    accessKey: 'cronogramaEnamed' as const,
    description: 'Seu cronograma personalizado'
  },
  {
    title: 'Desempenho Simulado',
    url: '/desempenho-simulado',
    icon: ClipboardCheck,
    accessKey: 'SimuladoDesempenho' as const,
    description: 'Análise do seu desempenho'
  },
  {
    title: 'Gestão de Usuários',
    url: '/gestao-usuarios',
    icon: UserCog,
    accessKey: 'userManagement' as const,
    description: 'Administração de usuários'
  },
  {
    title: 'Analytics',
    url: '/analytics',
    icon: TrendingUp,
    accessKey: 'analytics' as const,
    description: 'Métricas e insights avançados'
  },
];

const studyGuideItems = [
  {
    title: 'Seu guia',
    url: '/guia-estudos',
    icon: BookOpen,
    accessKey: 'studyGuide' as const,
    description: 'Materiais organizados por disciplina'
  },
  {
    title: 'Seu progresso',
    url: '/dashboard',
    icon: BarChart3,
    accessKey: 'dashboard' as const,
    description: 'Visualize sua evolução'
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const isActive = (path: string) => currentPath === path;
  const isStudyGuideAreaActive = () => 
    studyGuideItems.some(item => isActive(item.url) && accessRules[item.accessKey]);

  React.useEffect(() => {
    if (isStudyGuideAreaActive()) {
      setStudyGuideOpen(true);
    }
  }, [currentPath]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `initial-animation group relative overflow-hidden rounded-xl transition-all duration-300 ease-in-out ${
      isActive 
        ? 'bg-primary text-primary-foreground font-semibold shadow-lg scale-[1.02]' 
        : 'bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:shadow-sm'
    }`;

  const getParentNavCls = (isOpen: boolean) =>
    `initial-animation group relative overflow-hidden rounded-xl transition-all duration-300 ease-in-out ${
      isOpen 
        ? 'bg-primary text-primary-foreground font-semibold shadow-lg scale-[1.02]' 
        : 'bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:shadow-sm'
    }`;

  const getChildNavCls = ({ isActive }: { isActive: boolean }) =>
    `initial-animation group relative overflow-hidden rounded-lg ml-6 pl-4 transition-all duration-300 ease-in-out ${
      isActive 
        ? 'bg-primary/90 text-primary-foreground font-semibold shadow-md border-l-4 border-primary-foreground/30' 
        : 'bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent/70'
    }`;

  const MenuItem = ({ item, className, children }: { item: any, className?: string, children?: React.ReactNode }) => {
    const content = (
      <div className={`flex items-center gap-3 p-3 ${className || ''} ${collapsed ? 'justify-center' : ''}`}>
        <div className="relative">
          <item.icon className={`h-5 w-5 transition-all duration-300 ${collapsed ? '' : ''}`} />
          {!collapsed && (
            <motion.div
              className="absolute -inset-1 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              layoutId={`icon-glow-${item.title}`}
            />
          )}
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            <span className="block font-medium text-sm truncate">{item.title}</span>
            {children}
          </motion.div>
        )}
      </div>
    );

    if (collapsed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  return (
    <div>
      <Sidebar
        data-testid="app-sidebar"
        className={`hidden md:flex bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ${
          collapsed ? 'w-0 min-w-0 !-translate-x-full opacity-0 invisible pointer-events-none' : ''
        }`}
        collapsible="icon"
      >
        {/* Premium Header with Brand Identity */}
        <SidebarHeader className={`p-4 md:p-5 lg:p-6 ${collapsed ? 'px-3' : ''} border-b border-border`}> 
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.img
                src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                alt="Sanarflix"
                loading="lazy"
                className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-2xl shadow-lg object-contain ring-2 ring-primary/20"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              <motion.div
                className="absolute -inset-1 rounded-2xl bg-primary/10 opacity-0"
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1"
                >
                  <h2 className="font-bold text-lg lg:text-xl">Sanarflix</h2>
                  <p className="text-xs md:text-sm text-muted-foreground font-medium">
                    Guia de Estudos
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-3 md:p-4 space-y-5 md:space-y-6 overflow-y-auto">
          {/* Premium User Profile */}
          {user && (
            <div
              className={`bg-card border border-border rounded-2xl p-4 ${collapsed ? 'px-2' : ''} shadow-sm`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 bg-primary rounded-xl shadow-lg">
                    <User className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-green-500 rounded-full border-2 border-background"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.3 }}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs md:text-sm font-semibold truncate">
                          {user.nome}
                        </p>
                        {isB2BUser(user) && (
                          <Badge variant="secondary" className="text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            PRO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.ies_nome} • {user.semestre}º período
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Main Navigation */}
          <SidebarGroup>
            <AnimatePresence>
              {!collapsed && (
                <div>
                  <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                    Menu Principal
                  </SidebarGroupLabel>
                </div>
              )}
            </AnimatePresence>

            <SidebarGroupContent>
              <SidebarMenu>
                {/* Home - primeiro item com prioridade */}
                {menuItems.filter(item => item.accessKey === 'home' && accessRules[item.accessKey]).map((item, idx) => (
                  <div 
                    key={item.title}
                    className={isInitialLoad ? 'animate-fade-in' : ''}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls} aria-label="Ir para Início">
                          <MenuItem item={item} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </div>
                ))}

                {/* Study Guide Area */}
                <div
                  className={isInitialLoad ? 'animate-fade-in' : ''}
                  style={{ animationDelay: '50ms' }}
                >
                  <SidebarMenuItem>
                    <Collapsible open={studyGuideOpen} onOpenChange={setStudyGuideOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          className={getParentNavCls(studyGuideOpen)} 
                          aria-expanded={studyGuideOpen} 
                          aria-controls="submenu-guia-estudos"
                          onClick={(e) => {
                            e.preventDefault();
                            setStudyGuideOpen(!studyGuideOpen);
                          }}
                        >
                          {collapsed ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center p-3 w-full">
                                    <BookOpen className="h-5 w-5 transition-all duration-300" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="ml-2">
                                  <div className="text-sm font-medium">Guia de Estudos</div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <div className="flex items-center gap-3 p-3 w-full">
                              <div className="relative">
                                <BookOpen className="h-5 w-5 transition-all duration-300" />
                                <motion.div
                                  className="absolute -inset-1 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  layoutId="icon-glow-guia-estudos"
                                />
                              </div>
                              <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 min-w-0"
                              >
                                <span className="block font-medium text-sm truncate">Guia de Estudos</span>
                              </motion.div>
                              <div className="ml-auto" aria-hidden="true">
                                {studyGuideOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </div>
                            </div>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <AnimatePresence>
                        {studyGuideOpen && (
                          <CollapsibleContent id="submenu-guia-estudos">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-2 space-y-1 border-l-2 border-border ml-6"
                            >
                              {studyGuideItems.filter(item => accessRules[item.accessKey]).map((item, index) => (
                                <motion.div
                                  key={item.title}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1, duration: 0.3 }}
                                >
                                  <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                      <NavLink to={item.url} end className={getChildNavCls}>
                                        <MenuItem item={item} className="py-2" />
                                      </NavLink>
                                    </SidebarMenuButton>
                                  </SidebarMenuItem>
                                </motion.div>
                              ))}
                            </motion.div>
                          </CollapsibleContent>
                        )}
                      </AnimatePresence>
                    </Collapsible>
                  </SidebarMenuItem>
                </div>

                {/* Outros itens (exceto Início) */}
                {menuItems.filter(item => {
                  if (item.accessKey === 'home') return false;
                  if (item.accessKey === 'analytics') {
                    return isB2BUser(user);
                  }
                  return accessRules[item.accessKey];
                }).map((item, index) => (
                  <div 
                    key={item.title}
                    className={isInitialLoad ? 'animate-fade-in' : ''}
                    style={{ animationDelay: `${(index + 2) * 50}ms` }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
                          <MenuItem item={item} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </div>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="p-4 border-t border-border space-y-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="flex gap-2"
              >
                <Button variant="outline" className="flex-1" size={collapsed ? "icon" : "default"}>
                  {collapsed ? <Settings className="h-4 w-4" /> : 'Configurações'}
                </Button>
                <Button variant="destructive" onClick={logout} className="flex-1" size={collapsed ? "icon" : "default"}>
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span className="ml-2">Sair</span>}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}
