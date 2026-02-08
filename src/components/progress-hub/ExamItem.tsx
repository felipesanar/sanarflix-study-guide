import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Trash2, Calendar, Clock } from 'lucide-react';
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
          border: 'border-l-red-500',
          bg: 'bg-red-50 dark:bg-red-950/20',
          dot: 'bg-red-500',
          icon: '🔴'
        };
      case 'warning':
        return {
          border: 'border-l-amber-500',
          bg: 'bg-amber-50 dark:bg-amber-950/20',
          dot: 'bg-amber-500',
          icon: '🟡'
        };
      case 'on_track':
        return {
          border: 'border-l-emerald-500',
          bg: 'bg-emerald-50 dark:bg-emerald-950/20',
          dot: 'bg-emerald-500',
          icon: '🟢'
        };
      case 'excellent':
        return {
          border: 'border-l-blue-500',
          bg: 'bg-blue-50 dark:bg-blue-950/20',
          dot: 'bg-blue-500',
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
      initial={shouldReduceMotion ? {} : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={shouldReduceMotion ? {} : { opacity: 0, x: 10 }}
      className={cn(
        "rounded-lg border-l-4 p-3 space-y-2",
        styles.border,
        styles.bg
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">{styles.icon}</span>
            <h4 className="font-medium text-sm truncate">{insight.exam.materia}</h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            <span>{insight.exam.exam_name} • {formatDate(insight.exam.exam_date)}</span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(insight.exam.id)}
          aria-label={`Remover prova de ${insight.exam.materia}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {insight.days_remaining === 0 ? (
          <span className="font-bold text-primary">Hoje!</span>
        ) : insight.days_remaining === 1 ? (
          <span className="font-semibold text-destructive">Amanhã</span>
        ) : (
          <span>
            <strong>{insight.days_remaining}</strong> dias restantes
          </span>
        )}
      </div>

      {/* Progress bar */}
      {insight.materia_progress && (
        <div className="space-y-1">
          <Progress value={percentage} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {insight.materia_progress.completed}/{insight.materia_progress.total} aulas
            </span>
            <span className="font-medium">{percentage}%</span>
          </div>
        </div>
      )}

      {/* Insight message */}
      <p className="text-xs text-muted-foreground">{insight.message}</p>

      {/* CTA */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => onNavigate(insight.exam.materia)}
      >
        {insight.cta_label}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Button>
    </motion.div>
  );
};
