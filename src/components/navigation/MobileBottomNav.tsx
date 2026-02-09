import React, { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Home,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  GraduationCap,
  UserCog,
  TrendingUp,
  Lock,
  Sun,
  Moon,
  MessageCircle,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRules } from "@/hooks/useAccessRules";
import { isAdmin } from "@/utils/accessRules";
import { useTheme } from "next-themes";
import { usePasswordDialog } from "@/contexts/PasswordDialogContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface BottomNavItem {
  id: string;
  title: string;
  url: string;
  icon: React.ElementType;
  show: boolean;
}

// Motion variants for reduced motion support
const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

const reducedMotionTransition = {
  duration: 0.15,
};

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { accessRules } = useAccessRules();
  const { resolvedTheme, setTheme } = useTheme();
  const passwordDialog = usePasswordDialog();

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Log breakpoint mode
  useEffect(() => {
    console.log("[Nav]", "breakpoint", { mode: "navbar" });
  }, []);

  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;

  const transition = prefersReducedMotion ? reducedMotionTransition : springTransition;

  // Quick nav items for bottom bar (4 items + Menu)
  const quickNavItems: BottomNavItem[] = useMemo(() => [
    { id: "home", title: "Início", url: "/home", icon: Home, show: accessRules.home },
    { id: "guide", title: "Guia", url: "/guia-estudos", icon: BookOpen, show: accessRules.studyGuide },
    { id: "simulados", title: "Simulados", url: "/simulados", icon: ClipboardCheck, show: true },
    { id: "progress", title: "Progresso", url: "/dashboard", icon: BarChart3, show: accessRules.dashboard },
  ].filter((item) => item.show), [accessRules]);

  // User info for menu header
  const userInitials = useMemo(() => {
    if (!user?.nome) return "";
    return user.nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [user?.nome]);

  // Menu sections
  const menuSections = useMemo(() => {
    const sections: { title: string; items: { title: string; url?: string; icon: React.ElementType; action?: () => void; show: boolean }[] }[] = [];

    // Estudos section
    const estudosItems = [
      { title: "Guia de Estudos", url: "/guia-estudos", icon: BookOpen, show: accessRules.studyGuide },
      { title: "Seu Progresso", url: "/dashboard", icon: BarChart3, show: accessRules.dashboard },
      { title: "SanarClass", url: "/sanarclass", icon: GraduationCap, show: accessRules.sanarclass },
    ].filter(item => item.show);

    if (estudosItems.length > 0) {
      sections.push({ title: "Estudos", items: estudosItems });
    }

    // Ferramentas section
    sections.push({
      title: "Ferramentas",
      items: [
        { title: "Simulados", url: "/simulados", icon: ClipboardCheck, show: true },
      ],
    });

    // Admin section
    if (isAdmin(user)) {
      sections.push({
        title: "Administração",
        items: [
          { title: "Portal do Admin", url: "/gestao-usuarios", icon: UserCog, show: true },
          { title: "Analytics", url: "/analytics", icon: TrendingUp, show: true },
        ],
      });
    }

    return sections;
  }, [accessRules, user]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      setIsMenuOpen(false);
      navigate("/");
      toast.success("Até logo!");
    } catch {
      toast.error("Erro ao sair");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSemestreErrado = () => {
    const msg = encodeURIComponent(
      "Olá, o meu semestre na plataforma Sanarflix Academy está errado."
    );
    window.open(`https://wa.me/5571993120049?text=${msg}`, "_blank", "noopener,noreferrer");
    setIsMenuOpen(false);
  };

  const handleChangePassword = () => {
    passwordDialog.setOpen(true);
    setIsMenuOpen(false);
  };

  // Stagger animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.04,
        delayChildren: prefersReducedMotion ? 0 : 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  };

  return (
    <nav
      aria-label="Barra de navegação móvel"
      role="navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden"
    >
      {/* Glass background - more subtle in dark mode */}
      <div className="absolute inset-0 bg-background/70 dark:bg-background/40 backdrop-blur-xl dark:backdrop-blur-2xl border-t border-border/30 dark:border-white/[0.06] shadow-lg dark:shadow-none" />

      {/* Nav content */}
      <div className="relative px-1.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]">
        <LayoutGroup>
          <div className="flex items-center justify-around">
            {quickNavItems.map((item) => {
              const active = isActive(item.url);
              return (
                <NavLink
                  key={item.id}
                  to={item.url}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.title}
                  className="relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {/* Animated pill background */}
                  {active && (
                    <motion.div
                      layoutId="bottomNavActivePill"
                      className="absolute inset-0 bg-primary rounded-2xl shadow-lg"
                      transition={transition}
                      style={{
                        boxShadow: "0 4px 12px -2px hsl(var(--primary) / 0.3)",
                      }}
                    />
                  )}

                  {/* Content */}
                  <motion.div
                    className="relative z-10 flex flex-col items-center gap-0.5"
                    whileTap={prefersReducedMotion ? {} : { scale: 0.92, y: 1 }}
                  >
                    {/* Icon with bounce on active */}
                    <motion.div
                      animate={
                        active && !prefersReducedMotion
                          ? { scale: [1, 1.12, 1] }
                          : {}
                      }
                      transition={{ duration: 0.25 }}
                    >
                      <item.icon
                        className={`h-5 w-5 transition-colors duration-150 ${
                          active ? "text-primary-foreground" : "text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      />
                    </motion.div>

                    {/* Label - only visible on active */}
                    <AnimatePresence mode="wait">
                      {active && (
                        <motion.span
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: 4, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-[10px] font-semibold text-primary-foreground leading-tight"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </NavLink>
              );
            })}

            {/* Menu button */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <motion.button
                  whileTap={prefersReducedMotion ? {} : { scale: 0.92, y: 1 }}
                  className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-150 ${
                    isMenuOpen
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu de navegação"}
                  aria-expanded={isMenuOpen}
                >
                  {/* Morphing icon */}
                  <motion.div
                    animate={{ rotate: isMenuOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isMenuOpen ? (
                        <motion.div
                          key="close"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.1 }}
                        >
                          <X className="h-5 w-5" aria-hidden="true" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="menu"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.1 }}
                        >
                          <Menu className="h-5 w-5" aria-hidden="true" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Label for menu button - always visible but style changes */}
                  <span className={`text-[10px] font-semibold leading-tight mt-0.5 ${isMenuOpen ? "text-primary-foreground" : ""}`}>
                    Menu
                  </span>
                </motion.button>
              </SheetTrigger>

              <SheetContent
                side="bottom"
                className="h-auto max-h-[85vh] rounded-t-3xl px-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
              >
                <SheetHeader className="px-5 pb-4">
                  <SheetTitle className="sr-only">Menu Principal</SheetTitle>
                  
                  {/* User Header */}
                  {user && (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-md">
                        {userInitials ? (
                          <span className="text-base font-semibold text-primary-foreground">
                            {userInitials}
                          </span>
                        ) : (
                          <User className="h-6 w-6 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {user.nome}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.ies_nome}
                          {user.semestre ? ` • ${user.semestre}º período` : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </SheetHeader>

                <Separator className="mb-3" />

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="px-4 space-y-4 overflow-y-auto max-h-[calc(85vh-140px)]"
                >
                  {/* Menu Sections */}
                  {menuSections.map((section, sectionIndex) => (
                    <motion.div key={section.title} variants={itemVariants}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                        {section.title}
                      </p>
                      <div className="space-y-0.5">
                        {section.items.map((item) => (
                          <motion.div key={item.title} variants={itemVariants}>
                            {item.url ? (
                              <NavLink
                                to={item.url}
                                onClick={() => setIsMenuOpen(false)}
                                aria-current={isActive(item.url) ? "page" : undefined}
                                className={({ isActive: active }) =>
                                  `flex items-center gap-3 px-3 py-3 rounded-xl min-h-[48px] transition-all duration-150 ${
                                    active
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-foreground hover:bg-accent active:bg-accent/80"
                                  }`
                                }
                              >
                                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                                <span className="flex-1 font-medium">{item.title}</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              </NavLink>
                            ) : (
                              <button
                                onClick={item.action}
                                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl min-h-[48px] text-foreground hover:bg-accent active:bg-accent/80 transition-all duration-150"
                              >
                                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                                <span className="flex-1 font-medium text-left">{item.title}</span>
                              </button>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  {/* Quick Actions Section */}
                  <motion.div variants={itemVariants}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                      Ações Rápidas
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Theme Toggle */}
                      <motion.button
                        whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                        onClick={toggleTheme}
                        className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors min-h-[48px]"
                        aria-label={resolvedTheme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
                      >
                        {resolvedTheme === "dark" ? (
                          <Sun className="h-5 w-5 text-warning" aria-hidden="true" />
                        ) : (
                          <Moon className="h-5 w-5 text-primary" aria-hidden="true" />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {resolvedTheme === "dark" ? "Claro" : "Escuro"}
                        </span>
                      </motion.button>

                      {/* Change Password */}
                      <motion.button
                        whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                        onClick={handleChangePassword}
                        className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors min-h-[48px]"
                      >
                        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm font-medium">Senha</span>
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Account Actions */}
                  <motion.div variants={itemVariants}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                      Conta
                    </p>
                    <div className="space-y-0.5">
                      <button
                        onClick={handleSemestreErrado}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl min-h-[48px] text-foreground hover:bg-accent active:bg-accent/80 transition-all duration-150"
                      >
                        <MessageCircle className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="flex-1 font-medium text-left">Semestre errado?</span>
                      </button>

                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl min-h-[48px] text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-all duration-150 disabled:opacity-50"
                      >
                        {isLoggingOut ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 border-2 border-destructive border-t-transparent rounded-full shrink-0"
                          />
                        ) : (
                          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                        )}
                        <span className="flex-1 font-medium text-left">
                          {isLoggingOut ? "Saindo..." : "Sair"}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              </SheetContent>
            </Sheet>
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
