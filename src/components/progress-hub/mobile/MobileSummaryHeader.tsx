import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Calendar, Zap, Flame, BookOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProgressOverview, ProgressStreak } from '@/types/progressHub';
import { STATUS_CONFIG } from '@/types/progressHub';

interface MobileSummaryHeaderProps {
  overview: ProgressOverview;
  streak: ProgressStreak;
  syncing?: boolean;
  userName?: string;
  semestre?: number | null;
  onContinue: () => void;
  onOrganize: () => void;
}

export const MobileSummaryHeader: React.FC<MobileSummaryHeaderProps> = ({
  overview,
  streak,
  syncing,
  userName,
  semestre,
  onContinue,
  onOrganize,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const statusConfig = STATUS_CONFIG[overview.status_level] || STATUS_CONFIG.starting;

  const fadeIn = shouldReduceMotion ? {} : {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  };

  return (
    <motion.div 
      {...fadeIn}
      className="relative px-4 pt-4 pb-5 bg-gradient-to-b from-primary/5 via-background to-background"
    >
      {/* Top row: Title + sync indicator */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Seu Progresso</h1>
          <p className="text-xs text-muted-foreground">
            {userName} {semestre ? `• ${semestre}º período` : ''}
          </p>
        </div>
        {syncing && (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Sincronizando" />
        )}
      </div>

      {/* Metrics row: 2-column micro grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Left: Progress percentage + bar */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-3">
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-2xl font-bold text-foreground">{Math.round(overview.percentage)}%</span>
            <Badge 
              variant="outline" 
              className={cn('text-[10px] px-1.5 py-0 h-4', statusConfig.color)}
            >
              {statusConfig.label}
            </Badge>
          </div>
          <Progress value={overview.percentage} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {overview.completed}/{overview.total} aulas
          </p>
        </div>

        {/* Right: Streak + weekly goal */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-foreground">
              {streak.active_days_week}/{streak.goal} dias
            </span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 7 }, (_, i) => {
              const isActive = streak.active_days_of_week?.includes(i);
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-1.5 rounded-full transition-colors',
                    isActive ? 'bg-orange-500' : 'bg-muted'
                  )}
                />
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Sequência: {streak.current} {streak.current === 1 ? 'dia' : 'dias'}
          </p>
        </div>
      </div>

      {/* CTA Buttons - Primary + Secondary */}
      <div className="flex gap-3">
        <Button
          onClick={onContinue}
          className="flex-1 h-11 gap-2 text-sm font-semibold rounded-xl shadow-lg shadow-primary/20"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Continuar
        </Button>
        <Button
          onClick={onOrganize}
          variant="outline"
          className="h-11 px-4 gap-2 text-sm font-medium rounded-xl"
        >
          <Calendar className="h-4 w-4" />
          Organizar
        </Button>
      </div>
    </motion.div>
  );
};
