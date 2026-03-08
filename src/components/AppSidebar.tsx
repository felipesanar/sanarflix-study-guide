import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRules } from "@/hooks/useAccessRules";
import { isAdmin, isProfessor, isB2BPartner } from "@/utils/accessRules";
import {
  BookOpen,
  BarChart3,
  ClipboardCheck,
  UserCog,
  Home as HomeIcon,
  GraduationCap,
  TrendingUp,
  School,
  BookMarked,
} from "lucide-react";

import {
  SidebarUserCard,
  SidebarNavItem,
  SidebarNavGroup,
  SidebarSubItem,
  SidebarLogoutButton,
} from "@/components/sidebar";

// Menu items configuration
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
  {
    title: "Desempenho Institucional",
    url: "/desempenho-institucional",
    icon: School,
    accessKey: "desempenhoInstitucional" as const,
    description: "Visão geral do desempenho dos alunos",
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
  const { accessRules } = useAccessRules();
  const [studyGuideOpen, setStudyGuideOpen] = useState(false);
  const [hasStudyGuideContent, setHasStudyGuideContent] = useState(true);

  // Log breakpoint mode for debugging
  useEffect(() => {
    console.log("[Nav]", "breakpoint", { mode: "sidebar" });
  }, []);

  const isActive = useCallback((path: string) => currentPath === path, [currentPath]);
  
  const isStudyGuideAreaActive = useCallback(
    () => studyGuideItems.some((item) => isActive(item.url) && accessRules[item.accessKey]),
    [isActive, accessRules]
  );

  // Auto-expand study guide if active
  useEffect(() => {
    if (isStudyGuideAreaActive()) {
      setStudyGuideOpen(true);
    }
  }, [isStudyGuideAreaActive]);

  // Check if there's study guide content for this IES
  useEffect(() => {
    const checkStudyGuideContent = async () => {
      if (!user?.id_ies) {
        setHasStudyGuideContent(false);
        return;
      }

      const { data, error } = await supabase
        .from("conteudos")
        .select("id")
        .eq("id_ies", user.id_ies)
        .limit(1);

      setHasStudyGuideContent(!error && data && data.length > 0);
    };

    checkStudyGuideContent();
  }, [user?.id_ies]);

  // Filter visible study guide subitems
  const visibleStudyGuideItems = studyGuideItems.filter((item) => {
    if (item.accessKey === "dashboard") {
      return isAdmin(user);
    }
    return accessRules[item.accessKey];
  });

  // Filter visible main menu items
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.accessKey === "home") return false; // Rendered separately above
    if (item.accessKey === "sanarclass") return accessRules.sanarclass;
    if (item.accessKey === "simulados") return true;
    if (item.accessKey === "analytics") return isAdmin(user);
    if (item.accessKey === "desempenhoInstitucional") return isAdmin(user) || isProfessor(user) || isB2BPartner(user);
    return accessRules[item.accessKey];
  });

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar
        data-testid="app-sidebar"
        className="bg-transparent transition-all duration-300"
        collapsible="icon"
      >
        {/* Header with Brand */}
        <SidebarHeader className={`p-4 ${collapsed ? "px-3 flex items-center justify-center" : "px-5"}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="relative shrink-0">
              <img
                src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
                alt="SanarFlix Academy"
                loading="lazy"
                className={`rounded-xl shadow-md object-contain ring-2 ring-primary/10 hover:ring-primary/20 transition-all duration-200 ${collapsed ? "w-9 h-9" : "w-10 h-10"}`}
              />
            </div>
            {!collapsed && (
              <h2 className="font-bold text-lg text-sidebar-foreground tracking-tight">
                Academy
              </h2>
            )}
          </div>
        </SidebarHeader>

        {/* Main Content */}
        <SidebarContent className={`flex-1 overflow-y-auto p-3 ${collapsed ? "px-1.5" : "px-4"} space-y-4`}>
          {/* User Card */}
          {user && (
            <SidebarUserCard
              user={{
                nome: user.nome,
                ies_nome: user.ies_nome,
                semestre: user.semestre,
              }}
              collapsed={collapsed}
            />
          )}

          {/* Main Navigation */}
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium px-3 mb-2">
                Menu Principal
              </SidebarGroupLabel>
            )}

            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {/* Home */}
                {accessRules.home && (
                  <SidebarNavItem
                    item={{
                      title: "Início",
                      url: "/home",
                      icon: HomeIcon,
                      description: "Sua página inicial personalizada",
                    }}
                    isActive={isActive("/home")}
                    collapsed={collapsed}
                  />
                )}

                {/* Study Guide Group */}
                {accessRules.studyGuide && hasStudyGuideContent && (
                  <SidebarNavGroup
                    title="Guia de Estudos"
                    icon={BookOpen}
                    isOpen={studyGuideOpen}
                    onOpenChange={setStudyGuideOpen}
                    isActive={isStudyGuideAreaActive()}
                    collapsed={collapsed}
                  >
                    {visibleStudyGuideItems.map((item) => (
                      <SidebarSubItem
                        key={item.url}
                        item={item}
                        isActive={isActive(item.url)}
                      />
                    ))}
                  </SidebarNavGroup>
                )}

                {/* Other Menu Items */}
                {visibleMenuItems.map((item) => (
                  <SidebarNavItem
                    key={item.url}
                    item={item}
                    isActive={isActive(item.url)}
                    collapsed={collapsed}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer with Logout */}
        <SidebarFooter className={`p-4 ${collapsed ? "px-1.5 flex items-center justify-center" : "px-4"}`}>
          <SidebarLogoutButton onLogout={logout} collapsed={collapsed} />
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
