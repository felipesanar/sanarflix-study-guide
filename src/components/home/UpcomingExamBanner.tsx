import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Plus, ArrowRight, AlertTriangle, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExamInsight } from '@/types/progressHub';

interface UpcomingExamBannerProps {
  exam: ExamInsight | null;
  loading: boolean;
  onAddExamClick: () => void;
}

const statusColors = {
  critical: {
    bg: 'bg-destructive/10 border-destructive/20',
    text: 'text-destructive',
    progress: 'bg-destructive',
    icon: 'text-destructive'
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    progress: 'bg-amber-500',
    icon: 'text-amber-500'
  },
  on_track: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    progress: 'bg-emerald-500',
    icon: 'text-emerald-500'
  },
  excellent: {
    bg: 'bg-primary/10 border-primary/20',
    text: 'text-primary',
    progress: 'bg-primary',
    icon: 'text-primary'
  }
};

export const UpcomingExamBanner: React.FC<UpcomingExamBannerProps> = ({
  exam,
  loading,
  onAddExamClick
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/30 border border-border/50 mb-3 sm:mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
          <Skeleton className="w-16 h-7 rounded-md" />
        </div>
      </div>
    );
  }

  // Empty state - no exam registered
  if (!exam) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-3 sm:mb-4"
      >
        <button
          onClick={onAddExamClick}
          className="w-full p-3 sm:p-4 rounded-lg sm:rounded-xl border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="flex-1 text-left text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Cadastre sua próxima prova
            </span>
            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </button>
      </motion.div>
    );
  }

  const colors = statusColors[exam.status];
  const percentage = exam.materia_progress?.percentage ?? 0;

  const handleStudyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedMateria = encodeURIComponent(exam.exam.materia);
    navigate(`/guia-estudos?materia=${encodedMateria}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 sm:mb-4"
    >
      <div className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border ${colors.bg} transition-all duration-200`}>
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${colors.bg}`}>
            {exam.status === 'critical' ? (
              <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.icon}`} />
            ) : (
              <GraduationCap className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.icon}`} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-semibold text-xs sm:text-sm truncate ${colors.text}`}>
                {exam.exam.materia}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                {exam.days_remaining === 0 
                  ? 'Hoje!' 
                  : exam.days_remaining === 1 
                    ? 'Amanhã' 
                    : `em ${exam.days_remaining} dias`}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 sm:h-2 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${colors.progress} rounded-full`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className={`text-[10px] sm:text-xs font-medium ${colors.text}`}>
                {Math.round(percentage)}%
              </span>
            </div>

            {/* Lessons per day hint */}
            {exam.lessons_per_day > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1 hidden sm:block">
                ⚡ {Math.ceil(exam.lessons_per_day)} {exam.lessons_per_day === 1 ? 'aula' : 'aulas'}/dia restantes
              </p>
            )}
          </div>

          {/* CTA Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleStudyClick}
            className={`flex-shrink-0 gap-1 text-[10px] sm:text-xs font-medium ${colors.text} hover:bg-transparent hover:opacity-80 rounded-md h-7 sm:h-8 px-2 sm:px-3`}
          >
            {exam.cta_label}
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
