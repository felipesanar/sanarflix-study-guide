import * as React from "react";
const { useState } = React;
import { NavLink, useLocation } from "react-router-dom";
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
  Sparkles,
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
    description: "Página inicial do seu hub de estudos",
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
    title: "Desempenho Simulado",
    url: "/desempenho-simulado",
    icon: ClipboardCheck,
    accessKey: "SimuladoDesempenho" as const,
    description: "Análise do seu desempenho",
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
  const [initialAnim, setInitialAnim] = useState(false);

  const isActive = (path: string) => currentPath === path;
  const isStudyGuideAreaActive = () =>
    studyGuideItems.some((item) => isActive(item.url) && accessRules[item.accessKey]);

  React.useEffect(() => {
    if (isStudyGuideAreaActive()) {
      setStudyGuideOpen(true);
    }
  }, [currentPath]);

  // Executa animação inicial apenas no primeiro carregamento da sessão
  React.useEffect(() => {
    const hasRun = sessionStorage.getItem("sidebarAnimated") === "true";
    if (!hasRun) {
      setInitialAnim(true);
      const t = setTimeout(() => {
        sessionStorage.setItem("sidebarAnimated", "true");
        setInitialAnim(false);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `group relative overflow-hidden rounded transition-[background-color,box-shadow,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
      isActive
        ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm"
        : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:shadow-sm hover:translate-x-[4px]"
    }`;

  const getParentNavCls = (isActive: boolean) =>
    `group relative overflow-hidden rounded transition-[background-color,box-shadow,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
      isActive
        ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm"
        : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 hover:shadow-sm hover:translate-x-[4px]"
    }`;

  const getChildNavCls = ({ isActive }: { isActive: boolean }) =>
    `group relative overflow-hidden rounded ml-6 pl-4 transition-[background-color,box-shadow,transform] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
      isActive
        ? "bg-sidebar-accent/60 text-sidebar-foreground font-semibold shadow-sm"
        : "bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent/70 hover:shadow-sm hover:translate-x-[2px]"
    }`;

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
        className={`flex items-center gap-3 p-3 will-change-transform will-change-opacity ${className || ""} ${collapsed ? "justify-center" : ""}`}
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {initialAnim ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay }}
                >
                  {row}
                </motion.div>
              ) : (
                row
              )}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return initialAnim ? (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
        {row}
      </motion.div>
    ) : (
      row
    );
  };

  return (
    <div>
      <Sidebar
        data-testid="app-sidebar"
        className={`hidden md:flex bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ${
          collapsed ? "w-0 min-w-0 !-translate-x-full opacity-0 invisible pointer-events-none" : ""
        }`}
        collapsible="icon"
      >
        {/* Premium Header with Brand Identity */}
        <SidebarHeader className={`p-4 md:p-5 lg:p-6 ${collapsed ? "px-3" : ""} border-b border-border`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                alt="Sanarflix"
                loading="lazy"
                className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-2xl shadow-lg object-contain ring-2 ring-primary/20 transition-transform duration-300 hover:scale-105"
              />
            </div>
            {!collapsed && (
              <div className="flex-1 transition-opacity duration-300">
                <h2 className="font-bold text-lg lg:text-xl">Sanarflix</h2>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">Guia de Estudos</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="p-3 md:p-4 space-y-5 md:space-y-6 overflow-y-auto">
          {/* Premium User Profile */}
          {user && (
            <div className={`bg-card border border-border rounded-2xl p-4 ${collapsed ? "px-2" : ""} shadow-sm`}>
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
                  </div>
                )}
              </div>
            </div>
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
                {/* Home - primeiro item com prioridade */}
                {menuItems
                  .filter((item) => item.accessKey === "home" && accessRules[item.accessKey])
                  .map((item, idx) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls} aria-label="Ir para Início">
                          <MenuItem item={item} isActive={currentPath === item.url} delay={idx * 0.1} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                {/* Study Guide Area */}
                <SidebarMenuItem>
                  <Collapsible open={studyGuideOpen} onOpenChange={setStudyGuideOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={getParentNavCls(isStudyGuideAreaActive())}
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
                            <BookOpen className="h-5 w-5 transition-all duration-300" />
                            <span className="block font-medium text-sm truncate flex-1">Guia de Estudos</span>
                            <div
                              className="ml-auto transition-transform duration-300"
                              aria-hidden="true"
                              style={{ transform: studyGuideOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {studyGuideOpen && (
                      <CollapsibleContent id="submenu-guia-estudos">
                        <SidebarMenu className="mt-2 space-y-1 border-l-2 border-border ml-6 transition-all duration-300">
                          {studyGuideItems
                            .filter((item) => accessRules[item.accessKey])
                            .map((item, idx) => (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild>
                                  <NavLink to={item.url} end className={getChildNavCls}>
                                    <MenuItem
                                      item={item}
                                      className="py-2"
                                      isActive={currentPath === item.url}
                                      delay={idx * 0.1}
                                    />
                                  </NavLink>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>

                {/* Outros itens (exceto Início) */}
                {menuItems
                  .filter((item) => {
                    if (item.accessKey === "home") return false;
                    if (item.accessKey === "analytics") {
                      return isB2BUser(user);
                    }
                    return accessRules[item.accessKey];
                  })
                  .map((item, idx) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
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
        <SidebarFooter className="p-4 border-t border-border space-y-3">
          {!collapsed && (
            <div className="flex gap-2 transition-opacity duration-300">
              <Button variant="outline" className="flex-1" size={collapsed ? "icon" : "default"}>
                {collapsed ? <Settings className="h-4 w-4" /> : "Configurações"}
              </Button>
              <Button variant="destructive" onClick={logout} className="flex-1" size={collapsed ? "icon" : "default"}>
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
