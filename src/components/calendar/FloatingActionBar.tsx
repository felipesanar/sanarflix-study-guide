import React from 'react';
import { motion } from 'framer-motion';
import { Undo2, RefreshCw, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SyncStatus } from './types';

interface FloatingActionBarProps {
  onUndo: () => void;
  onReset: () => void;
  syncStatus: SyncStatus;
  canUndo?: boolean;
  variant?: 'dark' | 'light';
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  onUndo,
  onReset,
  syncStatus,
  canUndo = true,
  variant = 'dark'
}) => {
  const getSyncStatusDisplay = () => {
    switch (syncStatus) {
      case 'syncing':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Sincronizando...',
          color: 'text-yellow-500',
          dotColor: 'bg-yellow-500'
        };
      case 'saved':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'Salvo agora',
          color: 'text-green-500',
          dotColor: 'bg-green-500'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: 'Erro ao salvar',
          color: 'text-red-500',
          dotColor: 'bg-red-500'
        };
      default:
        return {
          icon: null,
          text: '',
          color: 'text-muted-foreground',
          dotColor: 'bg-muted-foreground'
        };
    }
  };

  const status = getSyncStatusDisplay();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className={cn(
        "flex items-center gap-1 px-2 py-2 rounded-full shadow-2xl border backdrop-blur-xl",
        variant === 'dark'
          ? "bg-card/95 border-border/50"
          : "bg-white/95 border-border/30"
      )}>
        {/* Undo button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            "gap-2 rounded-full px-4",
            variant === 'dark' ? "hover:bg-muted" : "hover:bg-muted/50"
          )}
        >
          <Undo2 className="h-4 w-4" />
          <span className="text-sm">Desfazer</span>
        </Button>

        {/* Divider */}
        <div className={cn(
          "w-px h-6",
          variant === 'dark' ? "bg-border/50" : "bg-border/30"
        )} />

        {/* Reset button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className={cn(
            "gap-2 rounded-full px-4",
            variant === 'dark' ? "hover:bg-muted" : "hover:bg-muted/50"
          )}
        >
          <RefreshCw className="h-4 w-4" />
          <span className="text-sm">Resetar semana</span>
        </Button>

        {/* Sync status */}
        {syncStatus !== 'idle' && (
          <>
            <div className={cn(
              "w-px h-6",
              variant === 'dark' ? "bg-border/50" : "bg-border/30"
            )} />
            <div className={cn(
              "flex items-center gap-2 px-3 py-1",
              status.color
            )}>
              <motion.div 
                className={cn("w-2 h-2 rounded-full", status.dotColor)}
                animate={{ scale: syncStatus === 'syncing' ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: syncStatus === 'syncing' ? Infinity : 0, duration: 1 }}
              />
              <span className="text-sm font-medium">{status.text}</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

// Mobile Footer Actions
interface MobileFooterActionsProps {
  onUndo: () => void;
  onSave: () => void;
  isSaving?: boolean;
  canUndo?: boolean;
  variant?: 'dark' | 'light';
}

export const MobileFooterActions: React.FC<MobileFooterActionsProps> = ({
  onUndo,
  onSave,
  isSaving = false,
  canUndo = true,
  variant = 'dark'
}) => {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 p-4 border-t backdrop-blur-xl",
      variant === 'dark'
        ? "bg-background/95 border-border/50"
        : "bg-white/95 border-border/30"
    )}>
      <div className="flex gap-3 max-w-lg mx-auto">
        <Button
          variant="outline"
          size="lg"
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(
            "flex-1 gap-2 rounded-xl h-12",
            variant === 'dark' 
              ? "border-border/50 hover:bg-muted" 
              : "border-border/30 hover:bg-muted/50"
          )}
        >
          <Undo2 className="h-5 w-5" />
          Desfazer
        </Button>
        <Button
          size="lg"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 gap-2 rounded-xl h-12 bg-primary hover:bg-primary/90"
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle className="h-5 w-5" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
};
