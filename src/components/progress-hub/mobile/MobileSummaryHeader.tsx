import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RefreshCw, GraduationCap } from 'lucide-react';
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
  onExamClick?: () => void;
}

export const MobileSummaryHeader: React.FC<MobileSummaryHeaderProps> = ({
  overview,
  streak,
  syncing,
  userName,
  semestre,
  nextExam,
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
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">Seu Progresso</h1>
            {syncing && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Sincronizando" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {userName} {semestre ? `• ${semestre}º período` : ''}
          </p>
        </div>

        {/* Compact exam chip */}
        {nextExam && (() => {
          const style = getExamStatusStyle(nextExam.status);
          return (
            <motion.button
              onClick={onExamClick}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all flex-shrink-0",
                "active:scale-[0.97]",
                style.bg
              )}
            >
              {/* Pulse for critical */}
              {nextExam.status === 'critical' && nextExam.days_remaining <= 3 && (
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 rounded-xl bg-destructive/20"
                />
              )}
              <GraduationCap className={cn("h-4 w-4 flex-shrink-0 relative z-10", 
                nextExam.status === 'critical' ? 'text-destructive' : 'text-primary'
              )} />
              <div className="relative z-10 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate max-w-[100px]">
                  {nextExam.exam.materia}
                </p>
                <p className={cn("text-[10px] font-medium", style.text)}>
                  {nextExam.days_remaining === 0 ? 'Hoje!' : 
                   nextExam.days_remaining === 1 ? 'Amanhã' : 
                   `${nextExam.days_remaining}d`}
                </p>
              </div>
            </motion.button>
          );
        })()}
      </div>

      {/* Metrics row: 2-column micro grid */}

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
