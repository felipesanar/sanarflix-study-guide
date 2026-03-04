import React from 'react';
import { motion } from 'framer-motion';
import { Layers, ChevronUp, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getMateriaColor, getMateriaIcon, getMateriaCategory } from './types';

interface SubjectDrawerMobileProps {
  subjects: string[];
  onAddSubject: (name: string) => void;
  variant?: 'dark' | 'light';
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const SubjectDrawerMobile: React.FC<SubjectDrawerMobileProps> = ({
  subjects,
  onAddSubject,
  variant = 'dark',
  isExpanded = true,
  onToggleExpand
}) => {
  return (
    <div className={cn(
      "border-t",
      variant === 'dark' ? "bg-card border-border/50" : "bg-white border-border/30"
    )}>
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Layers className={cn(
            "h-5 w-5",
            variant === 'dark' ? "text-primary" : "text-primary"
          )} />
          <span className={cn(
            "font-semibold",
            variant === 'dark' ? "text-foreground" : "text-foreground"
          )}>
            Gaveta de Matérias
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] px-2",
              variant === 'dark' ? "border-border/50" : "border-border/30"
            )}
          >
            Toque para adicionar
          </Badge>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      {/* Drag handle bar */}
      <div className="flex justify-center -mt-1">
        <div className={cn(
          "w-12 h-1 rounded-full",
          variant === 'dark' ? "bg-border/50" : "bg-border/60"
        )} />
      </div>

      {/* Subjects grid */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 py-3 pb-32" // Extra padding for footer
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {subjects.map((name, idx) => {
              const color = getMateriaColor(name);
              const icon = getMateriaIcon(name);
              const category = getMateriaCategory(name);

              return (
                <motion.button
                  key={idx}
                  onClick={() => onAddSubject(name)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all duration-200",
                    variant === 'dark'
                      ? "bg-card/80 border-border/40 hover:border-border active:scale-95"
                      : "bg-white border-border/30 hover:border-border/50 active:scale-95"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="w-2 h-2 rounded-full mt-1"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-muted-foreground">{icon}</span>
                  </div>
                  <h5 className={cn(
                    "font-medium text-sm mt-2 line-clamp-2 leading-tight",
                    variant === 'dark' ? "text-foreground" : "text-foreground"
                  )}>
                    {name}
                  </h5>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    60m • {category.charAt(0) + category.slice(1).toLowerCase()}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};
