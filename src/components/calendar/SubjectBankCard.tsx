import React from 'react';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMateriaIcon, getMateriaColor, getMateriaCategory } from './types';

interface SubjectBankCardProps {
  name: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  variant?: 'dark' | 'light';
}

export const SubjectBankCard: React.FC<SubjectBankCardProps> = ({
  name,
  onDragStart,
  onDragEnd,
  isDragging = false,
  variant = 'dark'
}) => {
  const color = getMateriaColor(name);
  const icon = getMateriaIcon(name);
  const category = getMateriaCategory(name);

  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "relative group cursor-grab active:cursor-grabbing select-none overflow-hidden",
        "min-w-[150px] max-w-[190px]",
        "p-3.5 rounded-xl border transition-all duration-300",
        variant === 'dark'
          ? "bg-zinc-900/80 border-white/5 hover:border-white/10 hover:bg-zinc-800 hover:shadow-lg hover:shadow-black/40"
          : "bg-white border-black/5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5",
        isDragging && "opacity-40 grayscale scale-95"
      )}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Background Glow */}
      <div
        className={cn(
          "absolute top-0 right-0 w-16 h-16 rounded-full blur-[30px] opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none",
          "translate-x-1/2 -translate-y-1/2"
        )}
        style={{ backgroundColor: color }}
      />

      {/* Color indicator (Bar) */}
      <div
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full shadow-sm"
        style={{ backgroundColor: color }}
      />

      {/* Drag handle */}
      <div className={cn(
        "absolute top-3 right-3 opacity-20 group-hover:opacity-100 transition-all duration-200",
        variant === 'dark' ? "text-zinc-400 group-hover:text-white" : "text-zinc-400 group-hover:text-foreground"
      )}>
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="pl-3 pr-2 pt-1">
        <span
          className="text-[9px] font-bold uppercase tracking-wider block mb-1.5 opacity-80"
          style={{ color }}
        >
          {category}
        </span>

        <h4 className={cn(
          "font-bold leading-tight line-clamp-2",
          variant === 'dark' ? "text-zinc-100 text-[13px]" : "text-zinc-700 text-[13px]"
        )}>
          {name}
        </h4>

        {variant === 'light' && (
          <p className="text-[10px] font-medium text-slate-400 mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span>60 min</span>
          </p>
        )}
      </div>
    </motion.div>
  );
};

// Create New Card (Light theme only - disabled state)
export const CreateNewCard: React.FC = () => {
  return (
    <div
      className="min-w-[140px] max-w-[180px] p-4 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 opacity-60 cursor-not-allowed"
      title="Em breve"
    >
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
        <span className="text-muted-foreground text-lg">+</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground uppercase">Criar Novo</span>
    </div>
  );
};
