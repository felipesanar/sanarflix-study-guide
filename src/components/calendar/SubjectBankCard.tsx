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
        "relative group cursor-grab active:cursor-grabbing select-none",
        "min-w-[160px] max-w-[200px]",
        "p-3 rounded-xl border transition-all duration-200",
        variant === 'dark' 
          ? "bg-card/80 border-border/50 hover:border-border hover:bg-card"
          : "bg-white border-border/30 hover:border-border/60 hover:shadow-md",
        isDragging && "opacity-50 scale-95"
      )}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Color dot indicator */}
      <div 
        className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full shadow-sm"
        style={{ backgroundColor: color }}
      />
      
      {/* Drag handle */}
      <div className={cn(
        "absolute top-3 right-3 opacity-40 group-hover:opacity-70 transition-opacity",
        variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground/80"
      )}>
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="pt-4 pr-4">
        {variant === 'light' && (
          <span 
            className="text-[10px] font-semibold uppercase tracking-wide mb-1 block"
            style={{ color }}
          >
            {category}
          </span>
        )}
        <h4 className={cn(
          "font-medium leading-tight line-clamp-2",
          variant === 'dark' ? "text-foreground text-sm" : "text-foreground text-sm"
        )}>
          {name}
        </h4>
        {variant === 'light' && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <span>{icon}</span>
            <span>•</span>
            <span>60m</span>
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
