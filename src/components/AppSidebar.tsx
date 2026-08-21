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
import { useNotebookDueCount } from "@/hooks/useNotebookDueCount";
import { ExperienceSwitcher } from "@/experiences/shared/ExperienceSwitcher";
import { isRouteActive } from "@/experiences/shared/navActive";
import {
  BookOpen,
  BarChart3,
  ClipboardCheck,
  Home as HomeIcon,
  GraduationCap,
  BookMarked,
} from "lucide-react";

import {
  SidebarUserCard,
  SidebarNavItem,
  SidebarNavGroup,
  SidebarSubItem,
  SidebarLogoutButton,
} from "@/components/sidebar";
import { Logger } from '@/utils/logger';

// Menu items configuration
const menuItems = [
  {
    title: "Início",
    url: "/",
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
    title: "Caderno de Erros",
    url: "/caderno-de-erros",
    icon: BookMarked,
    accessKey: "errorNotebook" as const,
    description: "Revise seus gaps e evite repeti-los",
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
  const { count: notebookDueCount } = useNotebookDueCount();
  const [studyGuideOpen, setStudyGuideOpen] = useState(false);
  const [hasStudyGuideContent, setHasStudyGuideContent] = useState(true);

  // Log breakpoint mode for debugging
  useEffect(() => {
    Logger.info("[Nav]", "breakpoint", { mode: "sidebar" });
  }, []);

  const isActive = useCallback((path: string) => isRouteActive(currentPath, path), [currentPath]);
  
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
      return accessRules.dashboard;
    }
    return accessRules[item.accessKey];
  });

  // Modelo híbrido: a navegação de aluno é mostrada para TODOS (filtrada por
  // accessRules). Usuários privilegiados recebem, ao final, as entradas para o(s)
  // seu(s) portal(is) dedicado(s) — cada uma apontando para o entrypoint da role.
  const studentItems = menuItems.filter(
    (item) => item.accessKey !== "home" && accessRules[item.accessKey],
  );
  // A sidebar do aluno lista SÓ telas de aluno. Portais (admin/gestão/CX) não
  // são itens de menu: são trocas de experiência, feitas no ExperienceSwitcher
  // do topo desta mesma sidebar.
  const visibleMenuItems = studentItems;

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
            {collapsed ? (
              <img
                src="/sanarflix-academy-symbol.svg"
                alt="SanarFlix Academy"
                loading="lazy"
                className="w-9 h-9 rounded-xl shadow-md object-contain ring-2 ring-primary/10 hover:ring-primary/20 transition-all duration-200"
              />
            ) : (
              <>
                <img
                  src="/sanarflix-academy-lockup.svg"
                  alt="SanarFlix Academy"
                  loading="lazy"
                  className="h-9 w-auto object-contain dark:hidden"
                />
                <img
                  src="/sanarflix-academy-lockup-white.svg"
                  alt="SanarFlix Academy"
                  loading="lazy"
                  className="h-9 w-auto object-contain hidden dark:block"
                />
              </>
            )}
          </div>


          {/* Troca de experiência (portal) — só aparece para quem tem mais de uma. */}
          <div className={collapsed ? "mt-3 flex justify-center" : "mt-3"}>
            <ExperienceSwitcher variant={collapsed ? "icon" : "full"} />
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
                {/* Home (só na experiência do aluno; a raiz "/" só é montada lá) */}
                {accessRules.home && (
                  <SidebarNavItem
                    item={{
                      title: "Início",
                      url: "/",
                      icon: HomeIcon,
                      description: "Sua página inicial personalizada",
                    }}
                    isActive={isActive("/")}
                    collapsed={collapsed}
                  />
                )}

                {/* Study Guide Group (rotas /guia-estudos e /dashboard só no aluno) */}
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
                    item={item.accessKey === "errorNotebook" ? { ...item, badge: notebookDueCount } : item}
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
