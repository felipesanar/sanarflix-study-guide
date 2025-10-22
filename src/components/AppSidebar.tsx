
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

  const isActive = (path: string) => currentPath === path;
  const isStudyGuideAreaActive = () => 
    studyGuideItems.some(item => isActive(item.url) && accessRules[item.accessKey]);

  React.useEffect(() => {
    if (isStudyGuideAreaActive()) {
      setStudyGuideOpen(true);
    }
  }, [currentPath]);

  // Premium glassmorphism styles
  const glassStyle = "backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10";
  const activeGlassStyle = "backdrop-blur-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 shadow-lg shadow-blue-500/10";
  const hoverGlassStyle = "hover:backdrop-blur-xl hover:bg-white/15 dark:hover:bg-white/5 hover:border-white/30 hover:shadow-md hover:shadow-blue-500/5 hover:scale-[1.02]";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `group relative overflow-hidden rounded-xl transition-all duration-300 ease-out ${
      isActive 
        ? `${activeGlassStyle} text-white font-medium` 
        : `${glassStyle} ${hoverGlassStyle} text-slate-700 dark:text-slate-300`
    }`;

  const getParentNavCls = (isOpen: boolean) =>
    `group relative overflow-hidden rounded-xl transition-all duration-300 ease-out ${
      isOpen 
        ? `${activeGlassStyle} text-white font-medium` 
        : `${glassStyle} ${hoverGlassStyle} text-slate-700 dark:text-slate-300`
    }`;

  const getChildNavCls = ({ isActive }: { isActive: boolean }) =>
    `group relative overflow-hidden rounded-lg ml-6 pl-4 transition-all duration-300 ease-out ${
      isActive 
        ? `${activeGlassStyle} text-white font-medium` 
        : `${glassStyle} ${hoverGlassStyle} text-slate-600 dark:text-slate-400`
    }`;

  const MenuItem = ({ item, className, children }: { item: any, className?: string, children?: React.ReactNode }) => {
    const content = (
      <div className={`flex items-center gap-3 p-3 ${className || ''}`}>
        <div className="relative">
          <item.icon className={`h-5 w-5 transition-all duration-300 ${collapsed ? 'mx-auto' : ''}`} />
          {!collapsed && (
            <motion.div
              className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
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
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Sidebar
        className={`${collapsed ? 'w-16' : 'w-72'} transition-all duration-500 ease-out border-r-0 shadow-2xl bg-gradient-to-b from-slate-50/95 via-white/90 to-slate-100/95 dark:from-slate-900/95 dark:via-slate-800/90 dark:to-slate-900/95 backdrop-blur-2xl`}
        collapsible="icon"
      >
        {/* Premium Header with Brand Identity */}
        <SidebarHeader className={`p-6 ${collapsed ? 'px-3' : ''} border-b border-white/20 dark:border-white/10`}>
          <motion.div 
            className="flex items-center gap-4"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="relative">
              <motion.img
                src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                alt="Sanarflix"
                className="w-12 h-12 rounded-2xl shadow-lg object-contain ring-2 ring-blue-500/20"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              <motion.div
                className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0"
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
                  <h2 className="font-bold text-xl bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Sanarflix
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Guia de Estudos
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </SidebarHeader>

        <SidebarContent className="p-4 space-y-6">
          {/* Premium User Profile */}
          {user && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className={`${glassStyle} rounded-2xl p-4 ${collapsed ? 'px-2' : ''} shadow-lg`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-800"
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
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {user.nome}
                        </p>
                        {isB2BUser(user) && (
                          <Badge variant="secondary" className="text-xs bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                            <Crown className="h-3 w-3 mr-1" />
                            PRO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {user.ies_nome} • {user.semestre}º período
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Main Navigation */}
          <SidebarGroup>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <SidebarGroupLabel className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    Menu Principal
                  </SidebarGroupLabel>
                </motion.div>
              )}
            </AnimatePresence>
            
            <SidebarGroupContent>
              <SidebarMenu className="space-y-2">
                {/* Home - Always visible */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/home" end className={getNavCls}>
                        <MenuItem item={{ title: 'Início', icon: HomeIcon, description: 'Página inicial do seu hub de estudos' }} />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </motion.div>

                {/* Study Guide - Collapsible */}
                {(accessRules.studyGuide || accessRules.dashboard) && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                  >
                    <SidebarMenuItem>
                      <Collapsible open={studyGuideOpen} onOpenChange={setStudyGuideOpen}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className={getParentNavCls(studyGuideOpen)}>
                            <MenuItem item={{ title: 'Guia de Estudos', icon: BookOpen, description: 'Seus materiais de estudo' }}>
                              <motion.div
                                animate={{ rotate: studyGuideOpen ? 90 : 0 }}
                                transition={{ duration: 0.3 }}
                                className="ml-auto"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </motion.div>
                            </MenuItem>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <AnimatePresence>
                          {!collapsed && studyGuideOpen && (
                            <CollapsibleContent>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mt-2 space-y-1 border-l-2 border-gradient-to-b from-blue-400/30 to-purple-400/30 ml-6"
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
                  </motion.div>
                )}

                {/* Other Menu Items */}
                {menuItems.filter(item => {
                  if (item.accessKey === 'analytics') {
                    return isB2BUser(user);
                  }
                  return accessRules[item.accessKey];
                }).map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
                          <MenuItem item={item} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Premium Footer */}
        <SidebarFooter className="p-4 border-t border-white/20 dark:border-white/10 space-y-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="flex gap-2"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-1 ${glassStyle} ${hoverGlassStyle} rounded-xl`}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-1 ${glassStyle} ${hoverGlassStyle} rounded-xl`}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={logout}
              variant="ghost"
              className={`w-full justify-start ${glassStyle} hover:bg-red-500/10 hover:border-red-400/30 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all duration-300 ${
                collapsed ? 'px-3' : ''
              }`}
            >
              <LogOut className={`h-4 w-4 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-medium"
                >
                  Sair
                </motion.span>
              )}
            </Button>
          </motion.div>
        </SidebarFooter>
      </Sidebar>
    </motion.div>
  );
}
