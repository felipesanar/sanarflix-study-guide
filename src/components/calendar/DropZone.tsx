import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  isActive: boolean;
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  isActive,
  variant = 'dark',
  size = 'md',
  showAddButton = false,
  onAddClick
}) => {
  const sizeClasses = {
    sm: 'py-3',
    md: 'py-6',
    lg: 'py-10'
  };

  if (showAddButton && !isActive) {
    // Mobile add slot between cards
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "w-full border-2 border-dashed rounded-xl flex items-center justify-center transition-all duration-200",
          sizeClasses[size],
          variant === 'dark'
            ? "border-border/40 hover:border-border/60"
            : "border-border/50 hover:border-primary/30"
        )}
        onClick={onAddClick}
      >
        <motion.button
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
            variant === 'dark'
              ? "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50"
              : "bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
            boxShadow: variant === 'dark'
              ? "0 0 20px rgba(var(--primary), 0.2)"
              : "0 0 15px rgba(var(--primary), 0.15)"
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute inset-0 z-10 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all backdrop-blur-[2px]",
            sizeClasses[size],
            variant === 'dark'
              ? "border-primary/60 bg-primary/10"
              : "border-primary/50 bg-primary/5"
          )}
        >
          <motion.div
            animate={{
              y: [0, -6, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut"
            }}
            className={cn(
              "p-3 rounded-full",
              variant === 'dark' ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
            )}
          >
            <Download className="h-6 w-6" />
          </motion.div>
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider",
            variant === 'dark' ? "text-primary" : "text-primary"
          )}>
            Soltar Matéria
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Empty state for day column
interface EmptyDayStateProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyDayState: React.FC<EmptyDayStateProps> = ({
  variant = 'dark',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-20'
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      sizeClasses[size]
    )}>
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
        variant === 'dark'
          ? "bg-muted/30"
          : "bg-muted/50"
      )}>
        <svg
          className={cn(
            "w-6 h-6",
            variant === 'dark' ? "text-muted-foreground/50" : "text-muted-foreground/60"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className={cn(
        "text-sm font-medium",
        variant === 'dark' ? "text-muted-foreground/70" : "text-muted-foreground"
      )}>
        Dia livre
      </p>
      <p className={cn(
        "text-xs mt-1",
        variant === 'dark' ? "text-muted-foreground/50" : "text-muted-foreground/70"
      )}>
        Arraste matérias para preencher
      </p>
    </div>
  );
};
