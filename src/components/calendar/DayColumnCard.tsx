import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarEvent, getMateriaIcon, getMateriaCategory } from './types';

interface DayColumnCardProps {
  event: CalendarEvent;
  onRemove: (id: string) => void;
  onClick?: () => void;
  variant?: 'dark' | 'light';
  isCompact?: boolean;
}

export const DayColumnCard: React.FC<DayColumnCardProps> = ({
  event,
  onRemove,
  onClick,
  variant = 'dark',
  isCompact = false
}) => {
  const category = getMateriaCategory(event.materia);
  const icon = getMateriaIcon(event.materia);

  // Get category color based on variant
  const getCategoryColor = (cat: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      'ANATOMIA': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      'FISIOLOGIA': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
      'BIOQUÍMICA': { bg: 'bg-green-500/20', text: 'text-green-400' },
      'PATOLOGIA': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
      'HISTOLOGIA': { bg: 'bg-pink-500/20', text: 'text-pink-400' },
      'IMUNOLOGIA': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
      'FARMACOLOGIA': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      'CLÍNICA': { bg: 'bg-red-500/20', text: 'text-red-400' },
    };
    return colors[cat] || { bg: 'bg-muted', text: 'text-muted-foreground' };
  };

  const catColor = getCategoryColor(category);

  if (isCompact) {
    // Desktop compact card (dark theme)
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "group p-3 rounded-lg border-l-4 transition-all duration-200 cursor-pointer",
          variant === 'dark'
            ? "bg-card/80 hover:bg-card border-t border-r border-b border-border/40"
            : "bg-white hover:bg-accent/50 border-t border-r border-b border-border/30 shadow-sm"
        )}
        style={{ borderLeftColor: event.color }}
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h5 className={cn(
              "font-medium text-sm leading-tight truncate",
              variant === 'dark' ? "text-foreground" : "text-foreground"
            )}>
              {event.title}
            </h5>
            <Badge 
              variant="secondary" 
              className={cn(
                "mt-1.5 text-[10px] px-1.5 py-0 h-5",
                catColor.bg, catColor.text
              )}
            >
              {category.charAt(0) + category.slice(1).toLowerCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">60m</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(event.id);
              }}
            >
              <GripVertical className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full card (light theme or mobile)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "group p-4 rounded-xl border-l-4 transition-all duration-200",
        variant === 'dark'
          ? "bg-card/90 border-t border-r border-b border-border/40"
          : "bg-white border-t border-r border-b border-border/30 shadow-sm hover:shadow-md"
      )}
      style={{ borderLeftColor: event.color }}
      onClick={onClick}
    >
      {/* Category badge only - no time */}
      <Badge 
        variant="secondary" 
        className={cn(
          "mb-2 text-[10px] px-1.5 py-0 h-5",
          catColor.bg, catColor.text
        )}
      >
        {category}
      </Badge>
      
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <Badge 
            variant="secondary" 
            className={cn(
              "mb-2 text-[10px] px-1.5 py-0 h-5",
              catColor.bg, catColor.text
            )}
          >
            {category}
          </Badge>
          <h5 className={cn(
            "font-semibold leading-tight",
            variant === 'dark' ? "text-foreground" : "text-foreground"
          )}>
            {event.title}
          </h5>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            Estudo programado para esta matéria.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-60 hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(event.id);
          }}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>{icon}</span>
      </div>
    </motion.div>
  );
};
