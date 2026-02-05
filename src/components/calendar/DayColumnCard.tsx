import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarEvent, getMateriaCategory } from './types';

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

  if (isCompact) {
    // Desktop compact card (dark/light mode editor)
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "group relative p-2.5 pl-3.5 rounded-lg transition-all duration-200 cursor-pointer overflow-hidden",
          variant === 'dark'
            ? "bg-zinc-800/80 hover:bg-zinc-800 border-y border-r border-white/5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20"
            : "bg-white hover:bg-white hover:shadow-md border-y border-r border-black/5 hover:border-primary/20",
          "hover:-translate-y-0.5"
        )}
        style={{
          boxShadow: variant === 'dark'
            ? `inset 3px 0 0 0 ${event.color}`
            : `inset 3px 0 0 0 ${event.color}, 0 1px 3px rgba(0,0,0,0.05)`
        }}
        onClick={onClick}
        whileHover={{ scale: 1.01 }}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h5 className={cn(
              "font-bold leading-tight tracking-tight break-words hyphens-auto",
              variant === 'dark' ? "text-zinc-100" : "text-zinc-700"
            )}
            style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.8125rem)' }}
            >
              {event.title}
            </h5>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[9px] font-bold uppercase tracking-wider opacity-80"
                style={{ color: event.color }}
              >
                {category}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Remover matéria do dia"
            className="h-6 w-6 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-500 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(event.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // Fallback - should not reach here since isCompact is always true
  return null;
};
