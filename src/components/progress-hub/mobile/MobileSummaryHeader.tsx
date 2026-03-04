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

      {/* Exam indicator - compact card */}
      {nextExam && (
        <motion.button
          onClick={onExamClick}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-xl border mb-4 text-left transition-all",
            "hover:shadow-md active:scale-[0.99]",
            getExamStatusStyle(nextExam.status).bg
          )}
        >
          {/* Icon with pulse for critical */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              nextExam.status === 'critical' ? 'bg-destructive/20' : 'bg-primary/10'
            )}>
              <GraduationCap className={cn(
                "h-5 w-5",
                nextExam.status === 'critical' ? 'text-destructive' : 'text-primary'
              )} />
            </div>
            {nextExam.status === 'critical' && nextExam.days_remaining <= 3 && (
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 rounded-full bg-destructive/30"
              />
            )}
          </div>

          {/* Exam info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground truncate">
                {nextExam.exam.materia}
              </span>
              <span className="text-lg" aria-hidden="true">
                {getExamStatusStyle(nextExam.status).icon}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {nextExam.days_remaining === 0 ? (
                <span className="font-bold text-destructive">Prova hoje!</span>
              ) : nextExam.days_remaining === 1 ? (
                <span className="font-bold text-destructive">Amanhã</span>
              ) : (
                <span>
                  <strong className={getExamStatusStyle(nextExam.status).text}>
                    {nextExam.days_remaining}
                  </strong> dias restantes
                </span>
              )}
            </div>
          </div>

          {/* Progress mini-indicator */}
          {nextExam.materia_progress && (
            <div className="flex-shrink-0 text-right">
              <span className={cn(
                "text-lg font-bold",
                getExamStatusStyle(nextExam.status).text
              )}>
                {nextExam.materia_progress.percentage}%
              </span>
              <p className="text-[10px] text-muted-foreground">pronto</p>
            </div>
          )}
        </motion.button>
      )}

      {/* CTA Buttons - Primary + Secondary */}
      <div className="flex gap-3">
        <Button
          onClick={onContinue}
          className="flex-1 h-12 gap-2 rounded-xl shadow-lg shadow-primary/20 flex-col items-center py-1"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Play className="h-3.5 w-3.5" fill="currentColor" />
            Continuar estudando
          </span>
          <span className="text-[10px] font-normal opacity-80">Siga seu roteiro</span>
        </Button>
        <Button
          onClick={onOrganize}
          variant="outline"
          className="h-12 px-4 gap-2 rounded-xl flex-col items-center py-1"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Calendar className="h-3.5 w-3.5" />
            Vamos organizar
          </span>
          <span className="text-[10px] font-normal text-muted-foreground">Ajuste seu cronograma</span>
        </Button>
      </div>
    </motion.div>
  );
};
