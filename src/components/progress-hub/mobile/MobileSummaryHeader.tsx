import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Calendar, Zap, Flame, BookOpen, RefreshCw, GraduationCap, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProgressOverview, ProgressStreak, ExamInsight } from '@/types/progressHub';
import { STATUS_CONFIG } from '@/types/progressHub';

interface MobileSummaryHeaderProps {
  overview: ProgressOverview;
  streak: ProgressStreak;
  syncing?: boolean;
  userName?: string;
  semestre?: number | null;
  nextExam?: ExamInsight | null;
  onContinue: () => void;
  onOrganize: () => void;
  onExamClick?: () => void;
}

export const MobileSummaryHeader: React.FC<MobileSummaryHeaderProps> = ({
  overview,
  streak,
  syncing,
  userName,
  semestre,
  nextExam,
  onContinue,
  onOrganize,
  onExamClick,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const statusConfig = STATUS_CONFIG[overview.status_level] || STATUS_CONFIG.starting;

  const fadeIn = shouldReduceMotion ? {} : {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  };

  // Exam status styling
  const getExamStatusStyle = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical':
        return {
          bg: 'bg-destructive/10 border-destructive/30',
          text: 'text-destructive',
          icon: '🔴',
          pulse: true
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30',
          text: 'text-amber-600 dark:text-amber-400',
          icon: '🟡',
          pulse: false
        };
      case 'on_track':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          text: 'text-emerald-600 dark:text-emerald-400',
          icon: '🟢',
          pulse: false
        };
      case 'excellent':
        return {
          bg: 'bg-primary/10 border-primary/30',
          text: 'text-primary',
          icon: '🔵',
          pulse: false
        };
    }
  };

  return (
    <motion.div 
      {...fadeIn}
      className="relative px-4 pt-4 pb-5 bg-gradient-to-b from-primary/5 via-background to-background"
    >
      {/* Top row: Title + compact exam chip */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold text-foreground">Seu Progresso</h1>
            {syncing && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Sincronizando" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {userName} {semestre ? `• ${semestre}º período` : ''}
          </p>
        </div>

        {/* Compact exam chip */}
        {nextExam && (
          <motion.button
            onClick={onExamClick}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "relative flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all flex-shrink-0",
              getExamStatusStyle(nextExam.status).bg
            )}
          >
            {nextExam.status === 'critical' && nextExam.days_remaining <= 3 && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 rounded-xl bg-destructive/20"
              />
            )}
            <GraduationCap className={cn(
              "h-4 w-4 flex-shrink-0 relative z-10",
              nextExam.status === 'critical' ? 'text-destructive' : 'text-primary'
            )} />
            <div className="relative z-10 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate max-w-[100px]">
                {nextExam.exam.materia}
              </p>
              <p className={cn("text-[10px] font-medium", getExamStatusStyle(nextExam.status).text)}>
                {nextExam.days_remaining === 0 ? 'Hoje!' : nextExam.days_remaining === 1 ? 'Amanhã' : `${nextExam.days_remaining}d restantes`}
              </p>
            </div>
            {nextExam.materia_progress && (
              <span className={cn(
                "text-xs font-bold tabular-nums relative z-10",
                getExamStatusStyle(nextExam.status).text
              )}>
                {nextExam.materia_progress.percentage}%
              </span>
            )}
          </motion.button>
        )}
      </div>

      {/* Metrics row: 2-column micro grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Left: Progress percentage + bar */}
        <div className="min-w-0 bg-card/50 border border-border/50 rounded-xl p-3">
          <div className="flex items-baseline gap-1.5 mb-1.5 flex-wrap">
            <span className="text-2xl font-bold text-foreground">{Math.round(overview.percentage)}%</span>
            <Badge 
              variant="outline" 
              className={cn('text-[10px] px-1.5 py-0 h-4 flex-shrink-0', statusConfig.color)}
            >
              {statusConfig.label}
            </Badge>
          </div>
          <Progress value={overview.percentage} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
            {overview.completed}/{overview.total} aulas
          </p>
        </div>

        {/* Right: Streak + weekly goal */}
        <div className="min-w-0 bg-card/50 border border-border/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
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
          <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
            Sequência: {streak.current} {streak.current === 1 ? 'dia' : 'dias'}
          </p>
        </div>
      </div>

      {/* CTA Buttons - Primary + Secondary */}
      <div className="grid grid-cols-[1fr_auto] gap-2.5">
        <Button
          onClick={onContinue}
          className="h-11 gap-2 rounded-xl shadow-md shadow-primary/15 text-sm font-semibold"
        >
          <Play className="h-4 w-4 shrink-0" fill="currentColor" />
          Continuar estudando
        </Button>
        <Button
          onClick={onOrganize}
          variant="outline"
          className="h-11 px-4 gap-2 rounded-xl text-sm font-medium border-border/60"
        >
          <Calendar className="h-4 w-4 shrink-0" />
          Organizar
        </Button>
      </div>
    </motion.div>
  );
};
