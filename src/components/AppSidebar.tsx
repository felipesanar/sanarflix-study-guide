import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePasswordDialog } from '@/contexts/PasswordDialogContext';
import { getAccessRules, isB2BUser } from "@/utils/accessRules";
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
  GraduationCap,
  Crown,
  Settings,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  {
    title: "Início",
    url: "/home",
    icon: HomeIcon,
    accessKey: "home" as const,
    description: "Sua página inicial personalizada",
  },
  {
    title: "SanarClass",
    url: "/sanarclass",
    icon: GraduationCap,
    accessKey: "sanarclass" as const,
    description: "Aulas da sua IES com o SanarFlix Academy",
  },
  {
    title: "Simulados",
    url: "/simulados",
    icon: ClipboardCheck,
    accessKey: "simulados" as const,
    description: "Simulados completos e desempenho",
  },
  {
    title: "Intensivão ENAMED",
    url: "/intensivao-enamed",
    icon: Zap,
    accessKey: "enamed" as const,
    description: "Preparação intensiva para o ENAMED",
  },
  {
    title: "Intensivo ENAMED - USCS",
    url: "/intensivo-uscs",
    icon: BookOpen,
    accessKey: "intensivoUSCS" as const,
    description: "Conteúdo exclusivo USCS",
  },
  {
    title: "Cronograma ENAMED",
    url: "/cronograma-enamed",
    icon: FileText,
    accessKey: "cronogramaEnamed" as const,
    description: "Seu cronograma personalizado",
  },
  {
    title: "Portal do Admin",
    url: "/gestao-usuarios",
    icon: UserCog,
    accessKey: "userManagement" as const,
    description: "Administração de elementos da plataforma",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: TrendingUp,
    accessKey: "analytics" as const,
    description: "Métricas e insights avançados",
  },
];

const studyGuideItems = [
  {
    title: "Seu guia",
    url: "/guia-estudos",
    icon: BookOpen,
    accessKey: "studyGuide" as const,
    description: "Materiais organizados por disciplina",
  },
  {
    title: "Seu progresso",
    url: "/dashboard",
    icon: BarChart3,
    accessKey: "dashboard" as const,
    description: "Visualize sua evolução",
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, logout } = useAuth();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const accessRules = getAccessRules(user);
  const [studyGuideOpen, setStudyGuideOpen] = useState(false);
  const [hasStudyGuideContent, setHasStudyGuideContent] = useState(true);
  const passwordDialog = usePasswordDialog();

  const isActive = (path: string) => currentPath === path;
  const isStudyGuideAreaActive = () =>
    studyGuideItems.some((item) => isActive(item.url) && accessRules[item.accessKey]);

  React.useEffect(() => {
    if (isStudyGuideAreaActive()) {
      setStudyGuideOpen(true);
    }
  }, [currentPath]);

  React.useEffect(() => {
    const checkStudyGuideContent = async () => {
      if (!user?.id_ies) {
        setHasStudyGuideContent(false);
        return;
      }

      const { data, error } = await supabase
        .from('conteudos')
        .select('id')
        .eq('id_ies', user.id_ies)
        .limit(1);

      setHasStudyGuideContent(!error && data && data.length > 0);
    };

    checkStudyGuideContent();
  }, [user?.id_ies]);

  // Removida animação inicial para evitar reflows e melhorar continuidade

  const getNavCls = React.useCallback(({ isActive }: { isActive: boolean }) =>
    `group relative overflow-hidden rounded transition-[background-color,box-shadow,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${isActive
      ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm"
      : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:shadow-sm hover:translate-x-[4px]"
    }`, []);

  const getParentNavCls = React.useCallback((isActive: boolean) =>
    `group relative overflow-hidden rounded px-2 py-1 transition-[background-color,box-shadow,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${isActive
      ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm"
      : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:shadow-sm hover:translate-x-[4px]"
    }`, []);

  const getChildNavCls = React.useCallback(({ isActive }: { isActive: boolean }) =>
    `group relative overflow-hidden rounded !ml-4 !pl-3 !h-7 !text-xs [&_span]:text-xs transition-[background-color,box-shadow,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${isActive
      ? "bg-sidebar-accent/60 text-sidebar-foreground font-semibold shadow-sm"
      : "bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent/70 hover:shadow-sm hover:translate-x-[2px]"
    }`, []);

  const MenuItem = ({
    item,
    className,
    children,
    isActive,
    delay = 0,
  }: {
    item: any;
    className?: string;
    children?: React.ReactNode;
    isActive?: boolean;
    delay?: number;
  }) => {
    const row = (
      <div
        className={`flex items-center gap-3 p-3 ${className || ""} ${collapsed ? "justify-center" : ""}`}
      >
        <div className="relative">
          <item.icon
            className={`h-5 w-5 transition-transform duration-300 ${isActive ? "scale-[1.05] text-primary" : ""}`}
          />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="block font-medium text-sm truncate">{item.title}</span>
            {children}
          </div>
        )}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {row}
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            <div className="text-sm font-medium">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.description}</div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return row;
  };

  return (
    <div>
      <Sidebar
        data-testid="app-sidebar"
        className={`hidden md:flex bg-white/10 dark:bg-transparent backdrop-blur-xl dark:backdrop-blur-none text-sidebar-foreground border border-white/20 dark:border-none shadow-lg dark:shadow-none transition-all duration-300 ${collapsed ? "w-0 min-w-0 !-translate-x-full opacity-0 invisible pointer-events-none" : ""
          }`}
        collapsible="icon"
      >
        {/* Premium Header with Brand Identity */}
        <SidebarHeader className={`p-4 md:p-5 lg:p-6 ${collapsed ? "px-3" : ""} border-none`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                alt="SanarFlix Academy"
                loading="lazy"
                className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-2xl shadow-lg object-contain ring-2 ring-primary/20 transition-transform duration-300 hover:scale-105"
              />
            </div>
            {!collapsed && (
              <div className="flex-1 transition-opacity duration-300">
                <h2 className="font-bold text-base lg:text-lg leading-tight">Academy</h2>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="p-3 md:p-4 space-y-5 md:space-y-6 overflow-y-auto">
          {/* Premium User Profile */}
          {user && (
            <Popover>
              <PopoverTrigger asChild>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`bg-card border border-border rounded-2xl p-4 ${collapsed ? "px-2" : ""} shadow-sm w-full text-left hover:bg-sidebar-accent/80 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors cursor-pointer`}
                  aria-label="Abrir opções de conta"
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
                    {!collapsed && (
                      <div className="min-w-0 flex-1 transition-opacity duration-300">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs md:text-sm font-semibold truncate">{user.nome}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.ies_nome} • {user.semestre}º período
                        </p>
                      </div>
                    )}
                  </div>
                </motion.button>
              </PopoverTrigger>
              <PopoverContent
                side={collapsed ? 'bottom' : 'right'}
                align="end"
                sideOffset={8}
                className="w-64 p-2 rounded-lg shadow-xl backdrop-blur-md bg-popover animate-in fade-in-0 slide-in-from-right-2"
              >
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => passwordDialog.setOpen(true)}
                  >
                    Trocar a senha
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      const msg = encodeURIComponent('Olá, o meu semestre na plataforma Sanarflix Academy está errado.');
                      const url = `https://wa.me/5571993120049?text=${msg}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Semestre errado
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Main Navigation */}
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                Menu Principal
              </SidebarGroupLabel>
            )}

            <SidebarGroupContent>
              <SidebarMenu>
                {/* Home - only for B2B users and FAME semester 0 */}
                {accessRules.home && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/home" end className={getNavCls} aria-label="Ir para Início">
                        <MenuItem 
                          item={{ title: "Início", icon: HomeIcon, description: "Sua página inicial personalizada" }} 
                          isActive={currentPath === "/home"} 
                        />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* Guia de Estudos - Collapsible group right after Home */}
                {accessRules.studyGuide && hasStudyGuideContent && (
                  <Collapsible open={studyGuideOpen} onOpenChange={setStudyGuideOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuItem>
                        <SidebarMenuButton className={getParentNavCls(isStudyGuideAreaActive())}>
                          <div className={`flex items-center justify-between w-full p-3 ${collapsed ? "justify-center" : ""}`}>
                            <div className="flex items-center gap-3">
                              <BookOpen className={`h-5 w-5 transition-transform duration-300 ${isStudyGuideAreaActive() ? "scale-[1.05] text-primary" : ""}`} />
                              {!collapsed && <span className="font-medium text-sm">Guia de Estudos</span>}
                            </div>
                            {!collapsed && (
                              <motion.div
                                animate={{ rotate: studyGuideOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </motion.div>
                            )}
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <AnimatePresence>
                        {studyGuideItems
                          .filter((item) => {
                            // "Seu Progresso" (dashboard) only visible for B2B users
                            if (item.accessKey === "dashboard") {
                              return isB2BUser(user);
                            }
                            return accessRules[item.accessKey];
                          })
                          .map((item, idx) => (
                            <motion.div
                              key={item.title}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.05 }}
                            >
                              <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                  <NavLink to={item.url} end className={getChildNavCls} aria-label={`Ir para ${item.title}`}>
                                    <MenuItem item={item} isActive={currentPath === item.url} />
                                  </NavLink>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Remaining menu items (excluding Home which is rendered above) */}
                {menuItems
                  .filter((item) => {
                    // Home already rendered above
                    if (item.accessKey === "home") return false;
                    // SanarClass: controlled by access rules
                    if (item.accessKey === "sanarclass") return accessRules.sanarclass;
                    // ENAMED: hidden for now
                    if (item.accessKey === "enamed") return false;
                    // Simulados: always available for authenticated users
                    if (item.accessKey === "simulados") return true;
                    // Analytics: only for B2B users
                    if (item.accessKey === "analytics") {
                      return isB2BUser(user);
                    }
                    return accessRules[item.accessKey];
                  })
                  .map((item, idx) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls} aria-label={`Ir para ${item.title}`}>
                          <MenuItem item={item} isActive={currentPath === item.url} delay={idx * 0.1} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="p-4 border-none">
          {!collapsed && (
            <div className="transition-opacity duration-300">
              <Button variant="destructive" onClick={logout} className="w-full" size={collapsed ? "icon" : "default"}>
                <LogOut className="h-4 w-4" />
                {!collapsed && <span className="ml-2">Sair</span>}
              </Button>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </div>
  );
}
