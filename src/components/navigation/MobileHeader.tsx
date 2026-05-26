import React, { useState } from "react";
import { motion } from "framer-motion";
import { Bell, User, AlertTriangle, Info, X, LogOut, Loader2, Pencil } from "lucide-react";
import { EditProfileSheet } from "@/components/EditProfileSheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { usePasswordDialog } from "@/contexts/PasswordDialogContext";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, toBrazilDate } from "@/utils/timezone";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logger } from '@/utils/logger';

interface MobileHeaderProps {
  hasScrolled?: boolean;
}

export function MobileHeader({ hasScrolled = false }: MobileHeaderProps) {
  const { user, logout } = useAuth();
  const passwordDialog = usePasswordDialog();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      Logger.error("[Nav] logout error:", error);
      toast.error("Erro ao sair. Tente novamente.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className={`sticky top-0 z-30 h-14 flex items-center justify-between px-4 md:hidden transition-all duration-300 ${
      hasScrolled 
        ? 'bg-background/60 dark:bg-background/40 backdrop-blur-lg border-b border-border/20 dark:border-white/10' 
        : 'bg-transparent border-b border-transparent'
    }`}>
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img
          src="/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png"
          alt="SanarFlix Academy"
          className="h-8 w-auto"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <NotificationsButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2.5 rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Perfil do usuário"
            >
              <User className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">Conta</span>
            </motion.button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48 mt-2">
            <DropdownMenuLabel className="truncate">
              {user?.nome || "Minha Conta"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setEditProfileOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar perfil
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => passwordDialog.setOpen(true)}>
              Alterar senha
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-destructive focus:text-destructive"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saindo...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
      </div>

      <EditProfileSheet open={editProfileOpen} onOpenChange={setEditProfileOpen} />
    </header>
  );
}

function NotificationsButton() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<
    Array<{
      id: string;
      titulo: string;
      descricao: string;
      prioridade: string;
      link_botao?: string | null;
    }>
  >([]);

  const isExpired = (exp?: string) =>
    exp ? toBrazilDate(exp) < getBrazilDate() : false;

  React.useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!user?.id) return;

      const { data } = await supabase
        .from("announcements")
        .select(
          "id, titulo, descricao, prioridade, created_at, data_expiracao, link_botao, ativo"
        )
        .eq("ativo", true)
        .order("prioridade", { ascending: false })
        .order("created_at", { ascending: false });

      if (!mounted || !data) return;

      let filtered = data.filter((a: any) => !isExpired(a.data_expiracao));

      try {
        const { data: viewed } = await supabase
          .from("announcements_viewed")
          .select("announcement_id")
          .eq("user_id", user.id);

        const viewedSet = new Set(
          (viewed || []).map((v: any) => v.announcement_id)
        );
        filtered = filtered.filter((a: any) => !viewedSet.has(a.id));
      } catch {}

      setItems(filtered);
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const count = items.length;

  const markViewed = async (id: string) => {
    if (!user) return;
    try {
      await supabase
        .from("announcements_viewed")
        .insert({ announcement_id: id, user_id: user.id });
    } catch {}
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleItemClick = async (a: {
    id: string;
    link_botao?: string | null;
  }) => {
    await markViewed(a.id);
    let url = a.link_botao || "";
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center justify-center min-h-11 min-w-11 rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium min-w-[18px] text-center shadow-sm"
            >
              {count}
            </motion.span>
          )}
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-2">
        {count === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Info className="h-4 w-4" />
            Sem notificações
          </div>
        ) : (
          <div className="max-h-72 overflow-auto">
            {items.map((a) => {
              const desc = a.descricao
                ? a.descricao.length > 100
                  ? a.descricao.slice(0, 100) + "…"
                  : a.descricao
                : "";
              const isHigh =
                a.prioridade?.toLowerCase().includes("alta") ||
                a.prioridade?.toLowerCase().includes("muito");

              return (
                <DropdownMenuItem
                  key={a.id}
                  className="flex items-start gap-3 p-2 cursor-pointer"
                  onClick={() => handleItemClick(a)}
                >
                  {isHigh ? (
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <Bell className="h-5 w-5 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight line-clamp-1">
                      {a.titulo}
                    </div>
                    {desc && (
                      <div className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                        {desc}
                      </div>
                    )}
                  </div>
                  <button
                    className="ml-1 rounded-md p-1 hover:bg-accent/50 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      markViewed(a.id);
                    }}
                    aria-label="Dispensar aviso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
