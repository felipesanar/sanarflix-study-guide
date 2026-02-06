import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  UserCog,
  TrendingUp,
  Menu,
  X,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRules } from "@/hooks/useAccessRules";
import { isAdmin } from "@/utils/accessRules";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItemConfig {
  title: string;
  url: string;
  icon: React.ElementType;
  accessKey?: string;
}

const mainNavItems: NavItemConfig[] = [
  { title: "Início", url: "/home", icon: Home, accessKey: "home" },
  { title: "SanarClass", url: "/sanarclass", icon: GraduationCap, accessKey: "sanarclass" },
  { title: "Simulados", url: "/simulados", icon: ClipboardCheck },
  { title: "Portal do Admin", url: "/gestao-usuarios", icon: UserCog, accessKey: "userManagement" },
  { title: "Analytics", url: "/analytics", icon: TrendingUp, accessKey: "analytics" },
];

const studyGuideItems: NavItemConfig[] = [
  { title: "Seu guia", url: "/guia-estudos", icon: BookOpen, accessKey: "studyGuide" },
  { title: "Seu progresso", url: "/dashboard", icon: BarChart3, accessKey: "dashboard" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { accessRules } = useAccessRules();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [studyGuideOpen, setStudyGuideOpen] = useState(false);

  // Log breakpoint mode
  useEffect(() => {
    console.log("[Nav]", "breakpoint", { mode: "navbar" });
  }, []);

  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const isStudyGuideActive = studyGuideItems.some((item) => isActive(item.url));

  // Filter visible items based on access rules
  const visibleMainItems = mainNavItems.filter((item) => {
    if (!item.accessKey) return true;
    if (item.accessKey === "analytics") return isAdmin(user);
    return accessRules[item.accessKey as keyof typeof accessRules];
  });

  const visibleStudyGuideItems = studyGuideItems.filter((item) => {
    if (item.accessKey === "dashboard") return isAdmin(user);
    return item.accessKey ? accessRules[item.accessKey as keyof typeof accessRules] : true;
  });

  const showStudyGuide = accessRules.studyGuide && visibleStudyGuideItems.length > 0;

  // Quick nav items for bottom bar (max 4)
  const quickNavItems = [
    { title: "Início", url: "/home", icon: Home, show: accessRules.home },
    { title: "Guia", url: "/guia-estudos", icon: BookOpen, show: accessRules.studyGuide },
    { title: "Simulados", url: "/simulados", icon: ClipboardCheck, show: true },
  ].filter((item) => item.show);

  return (
    <nav
      aria-label="Barra de navegação móvel"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden"
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-xl border-t border-border/50 shadow-2xl" />

      {/* Nav content */}
      <div className="relative px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        <div className="flex items-center justify-around gap-1">
          {quickNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive: active }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-xl transition-all duration-200 min-w-[64px]
                ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50 active:scale-95"
                }`
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </NavLink>
          ))}

          {/* Menu button */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-xl transition-all duration-200 min-w-[64px]
                  ${isMenuOpen ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium">Menu</span>
              </button>
            </SheetTrigger>

            <SheetContent
              side="bottom"
              className="h-auto max-h-[85vh] rounded-t-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <SheetHeader className="pb-4 border-b border-border/50">
                <SheetTitle className="text-left text-lg font-bold">
                  Menu Principal
                </SheetTitle>
              </SheetHeader>

              <div className="py-4 space-y-2 overflow-y-auto max-h-[60vh]">
                {/* Study Guide Group */}
                {showStudyGuide && (
                  <Collapsible open={studyGuideOpen || isStudyGuideActive} onOpenChange={setStudyGuideOpen}>
                    <CollapsibleTrigger asChild>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center justify-between w-full px-4 py-3.5 rounded-xl transition-all duration-200
                          ${isStudyGuideActive ? "bg-primary/10 text-primary" : "hover:bg-accent active:bg-accent/70"}`}
                        aria-expanded={studyGuideOpen || isStudyGuideActive}
                        aria-controls="study-guide-submenu"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-5 w-5" />
                          <span className="font-medium">Guia de Estudos</span>
                        </div>
                        <motion.div
                          animate={{ rotate: studyGuideOpen || isStudyGuideActive ? 90 : 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </motion.div>
                      </motion.button>
                    </CollapsibleTrigger>

                    <CollapsibleContent 
                      id="study-guide-submenu"
                      className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up"
                    >
                      <div className="ml-4 mt-1 pl-4 border-l-2 border-border/50 space-y-1">
                        {visibleStudyGuideItems.map((item) => {
                          const isItemActive = isActive(item.url);
                          return (
                            <NavLink
                              key={item.url}
                              to={item.url}
                              onClick={() => setIsMenuOpen(false)}
                              aria-current={isItemActive ? "page" : undefined}
                              className={({ isActive: active }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 min-h-[44px]
                                ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50 active:bg-accent/70"}`
                              }
                            >
                              <item.icon className="h-4 w-4" />
                              <span className="text-sm">{item.title}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Separator */}
                {showStudyGuide && visibleMainItems.length > 0 && (
                  <div className="my-2 mx-4 h-px bg-border/40" />
                )}

                {/* Main nav items */}
                {visibleMainItems.map((item) => {
                  const isItemActive = isActive(item.url);
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      onClick={() => setIsMenuOpen(false)}
                      aria-current={isItemActive ? "page" : undefined}
                      className={({ isActive: active }) =>
                        `flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 min-h-[44px]
                        ${active ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent active:bg-accent/70"}`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </NavLink>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
