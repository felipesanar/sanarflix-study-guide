import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Trash2, Calendar, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ExamInsight } from '@/types/progressHub';

interface ExamItemProps {
  insight: ExamInsight;
  onNavigate: (materia: string) => void;
  onRemove: (examId: string) => void;
}

export const ExamItem: React.FC<ExamItemProps> = ({
  insight,
  onNavigate,
  onRemove
}) => {
  const shouldReduceMotion = useReducedMotion();

  const getStatusStyles = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical':
        return {
          bg: 'bg-destructive/10 border-destructive/30',
          dot: 'bg-destructive',
          text: 'text-destructive',
          icon: '🔴'
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30',
          dot: 'bg-amber-500',
          text: 'text-amber-600 dark:text-amber-400',
          icon: '🟡'
        };
      case 'on_track':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          dot: 'bg-emerald-500',
          text: 'text-emerald-600 dark:text-emerald-400',
          icon: '🟢'
        };
      case 'excellent':
        return {
          bg: 'bg-primary/10 border-primary/30',
          dot: 'bg-primary',
          text: 'text-primary',
          icon: '🔵'
        };
    }
  };

  const styles = getStatusStyles(insight.status);
  const percentage = insight.materia_progress?.percentage || 0;
  const isPastExam = insight.days_remaining < 0;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short'
    });
  };

  if (isPastExam) {
    return null; // Don't render past exams
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? {} : { opacity: 0, x: -20, height: 0 }}
      whileHover={shouldReduceMotion ? {} : { scale: 1.01 }}
      layout
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-all duration-200",
        "hover:shadow-md",
        styles.bg
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            {/* Pulsing indicator for critical */}
            <div className="relative">
              <span className="text-lg" aria-hidden="true">{styles.icon}</span>
              {insight.status === 'critical' && insight.days_remaining <= 3 && (
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 rounded-full bg-destructive/40"
                />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-base">{insight.exam.materia}</h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                <span>{insight.exam.exam_name} • {formatDate(insight.exam.exam_date)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(insight.exam.id);
          }}
          aria-label={`Remover prova de ${insight.exam.materia}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Countdown badge */}
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        insight.status === 'critical' ? "bg-destructive/20" : "bg-background/50"
      )}>
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {insight.days_remaining === 0 ? (
          <span className="font-bold text-destructive">Hoje!</span>
        ) : insight.days_remaining === 1 ? (
          <span className="font-bold text-destructive">Amanhã</span>
        ) : (
          <span className={styles.text}>
            <strong>{insight.days_remaining}</strong> dias restantes
          </span>
        )}
      </div>

      {/* Progress bar */}
      {insight.materia_progress && (
        <div className="space-y-2">
          <Progress value={percentage} className="h-2.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {insight.materia_progress.completed}/{insight.materia_progress.total} aulas
            </span>
            <span className="font-semibold">{percentage}%</span>
          </div>
        </div>
      )}

      {/* Insight message */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {insight.status === 'critical' && insight.lessons_per_day > 0 && (
            <Zap className="h-3 w-3 text-destructive" aria-hidden="true" />
          )}
          {insight.message}
        </p>
      </div>

      {/* CTA */}
      <Button
        variant={insight.status === 'critical' ? 'default' : 'outline'}
        size="sm"
        className="w-full h-9 gap-2 rounded-lg font-medium"
        onClick={() => onNavigate(insight.exam.materia)}
      >
        {insight.cta_label}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </motion.div>
  );
};
