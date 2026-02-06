import React from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePasswordDialog } from "@/contexts/PasswordDialogContext";

interface SidebarUserCardProps {
  user: {
    nome: string;
    ies_nome?: string;
    semestre?: number;
  } | null;
  collapsed?: boolean;
}

export function SidebarUserCard({ user, collapsed }: SidebarUserCardProps) {
  const passwordDialog = usePasswordDialog();

  if (!user) return null;

  const initials = (user.nome || "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSemestreErrado = () => {
    const msg = encodeURIComponent(
      "Olá, o meu semestre na plataforma Sanarflix Academy está errado."
    );
    const url = `https://wa.me/5571993120049?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`
            group relative w-full text-left 
            rounded-xl p-3 
            bg-gradient-to-br from-card via-card to-secondary/20
            border border-border/40
            shadow-sm hover:shadow-md
            hover:border-primary/20
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar
            transition-all duration-200 cursor-pointer
            ${collapsed ? "px-2 justify-center" : ""}
          `}
          style={{
            boxShadow: "inset 0 1px 0 0 hsl(var(--background) / 0.5)"
          }}
          aria-label="Abrir opções de conta"
        >
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-md group-hover:shadow-lg transition-all duration-200">
                {initials ? (
                  <span className="text-sm font-semibold text-primary-foreground">
                    {initials}
                  </span>
                ) : (
                  <User className="h-5 w-5 text-primary-foreground" />
                )}
              </div>
              {/* Status indicator */}
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-sidebar shadow-sm"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* User info */}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-sidebar-foreground">
                  {user.nome}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.ies_nome}
                  {user.semestre ? ` • ${user.semestre}º período` : ""}
                </p>
              </div>
            )}
          </div>
        </motion.button>
      </PopoverTrigger>

      <PopoverContent
        side={collapsed ? "bottom" : "right"}
        align="start"
        sideOffset={8}
        className="w-56 p-1.5 rounded-xl shadow-xl backdrop-blur-md bg-popover/95 border border-border/50"
      >
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-9 px-3 rounded-lg hover:bg-accent"
            onClick={() => passwordDialog.setOpen(true)}
          >
            Trocar a senha
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-9 px-3 rounded-lg hover:bg-accent"
            onClick={handleSemestreErrado}
          >
            Semestre errado
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
