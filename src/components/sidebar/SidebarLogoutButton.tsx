import React, { useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SidebarLogoutButtonProps {
  onLogout: () => Promise<void> | void;
  collapsed?: boolean;
}

export function SidebarLogoutButton({ onLogout, collapsed }: SidebarLogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await onLogout();
    } catch (error) {
      console.error("[Nav] logout error:", error);
      toast.error("Erro ao sair. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (collapsed) {
    return (
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex justify-center">
        <Button
          variant="destructive"
          size="icon"
          onClick={handleLogout}
          disabled={isLoading}
          className="w-11 h-11 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          aria-label="Sair da conta"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      <Button
        variant="destructive"
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full h-11 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium"
      >
        {isLoading ? (
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
      </Button>
    </motion.div>
  );
}
