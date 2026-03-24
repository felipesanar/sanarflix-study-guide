import React from 'react';
import { List, Calendar, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface GuideToolbarProps {
  selectedSemestre: string;
  semestres: string[];
  viewMode: 'list' | 'calendar';
  onSemestreChange: (value: string) => void;
  onViewModeChange: (mode: 'list' | 'calendar') => void;
  className?: string;
}

export const GuideToolbar: React.FC<GuideToolbarProps> = ({
  selectedSemestre,
  semestres,
  viewMode,
  onSemestreChange,
  onViewModeChange,
  className
}) => {
  const formatSemestreName = (sem: string) => {
    const isNumeric = !isNaN(parseInt(sem));
    return isNumeric ? `${sem}º Semestre` : sem;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
        className
      )}
    >
      {/* Section Title + Semester Select */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          Seu Plano de Estudos
        </h2>
        
        <Select value={selectedSemestre} onValueChange={onSemestreChange}>
          <SelectTrigger 
            aria-label="Selecione o semestre"
            className={cn(
              "w-full sm:w-52 h-10 rounded-xl",
              "bg-card/80 backdrop-blur-sm border-border/50",
              "hover:border-primary/30 focus:ring-2 focus:ring-primary/20",
              "transition-all duration-200"
            )}
          >
            <SelectValue placeholder="Selecione o semestre" />
          </SelectTrigger>
          <SelectContent className="rounded-xl max-h-[300px] overflow-y-auto z-50 bg-popover">
            {semestres.map((sem) => (
              <SelectItem 
                key={sem} 
                value={sem}
                className="rounded-lg"
              >
                {formatSemestreName(sem)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View Mode Toggle */}
      <div className={cn(
        "flex p-1 rounded-xl",
        "bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
      )}>
        <button
          onClick={() => onViewModeChange('list')}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "transition-all duration-200",
            viewMode === 'list' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={viewMode === 'list'}
          aria-label="Ver como lista"
        >
          {viewMode === 'list' && (
            <motion.div
              layoutId="viewModeIndicator"
              className="absolute inset-0 bg-card dark:bg-white/10 rounded-lg shadow-sm border border-border/50 dark:border-white/10"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <List className="h-4 w-4 relative z-10" />
          <span className="relative z-10">Lista</span>
        </button>
        
        <button
          onClick={() => onViewModeChange('calendar')}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "transition-all duration-200",
            viewMode === 'calendar' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={viewMode === 'calendar'}
          aria-label="Ver como calendário"
        >
          {viewMode === 'calendar' && (
            <motion.div
              layoutId="viewModeIndicator"
              className="absolute inset-0 bg-card dark:bg-white/10 rounded-lg shadow-sm border border-border/50 dark:border-white/10"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <Calendar className="h-4 w-4 relative z-10" />
          <span className="relative z-10">Calendário</span>
        </button>
      </div>
    </motion.div>
  );
};
