import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const ImpersonationBanner: React.FC = () => {
  const { impersonatedUser, stopImpersonation } = useAuth();

  if (!impersonatedUser) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 dark:bg-amber-600 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Visualizando como: <strong>{impersonatedUser.nome}</strong> ({impersonatedUser.email})
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={stopImpersonation}
        className="ml-2 h-7 bg-white/20 border-amber-700 text-amber-950 hover:bg-white/40"
      >
        <X className="h-3 w-3 mr-1" />
        Sair
      </Button>
    </div>
  );
};
