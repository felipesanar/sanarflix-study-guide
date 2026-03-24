import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GraduationCap, Plus, ArrowRight, AlertTriangle, Clock, 
  CheckCircle, Sparkles, Calendar, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExamDetailSheet } from './ExamDetailSheet';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ExamInsight } from '@/types/progressHub';

interface UpcomingExamBannerProps {
  exam: ExamInsight | null;
  loading: boolean;
  onAddExamClick: () => void;
  onEditExam?: (examId: string) => void;
  onRemoveExam?: (examId: string) => void;
}

const statusConfig = {
  critical: {
    accent: 'bg-destructive',
    text: 'text-destructive',
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
    Icon: AlertTriangle,
  },
  warning: {
    accent: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    Icon: Clock,
  },
  on_track: {
    accent: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    Icon: CheckCircle,
  },
  excellent: {
    accent: 'bg-primary',
    text: 'text-primary',
    badge: 'bg-primary/15 text-primary border-primary/30',
    Icon: Sparkles,
  },
};

export const UpcomingExamBanner: React.FC<UpcomingExamBannerProps> = ({
  exam,
  loading,
  onAddExamClick,
  onEditExam,
  onRemoveExam,
}) => {
  const navigate = useNavigate();
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 mb-3 animate-pulse">
        <div className="w-1 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 bg-muted rounded" />
          <div className="h-2.5 w-20 bg-muted rounded" />
        </div>
        <div className="h-6 w-14 bg-muted rounded-full" />
      </div>
    );
  }

  // Empty state - compact add button
  if (!exam) {
    return (
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onAddExamClick}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl mb-3",
          "border border-dashed border-muted-foreground/25",
          "hover:border-primary/50 hover:bg-primary/5",
          "transition-all duration-200 group"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          "bg-muted/50 group-hover:bg-primary/10 transition-colors"
        )}>
          <Calendar className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Cadastrar próxima prova
          </span>
        </div>
        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </motion.button>
    );
  }

  const config = statusConfig[exam.status];
  const StatusIcon = config.Icon;
  const percentage = exam.materia_progress?.percentage ?? 0;

  // Format date
  const formatExamDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, "d MMM", { locale: ptBR });
  };

  const handleCardClick = () => {
    setShowDetailSheet(true);
  };

  const getDaysLabel = () => {
    if (exam.days_remaining === 0) return 'Hoje!';
    if (exam.days_remaining === 1) return 'Amanhã';
    return `${exam.days_remaining}d`;
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleCardClick}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl mb-3",
          "bg-card/50 border border-border/60",
          "hover:bg-card hover:border-border hover:shadow-sm",
          "transition-all duration-200 group text-left"
        )}
      >
        {/* Status accent bar */}
        <div className={cn(
          "w-1 h-10 rounded-full flex-shrink-0",
          config.accent,
          exam.status === 'critical' && "animate-pulse"
        )} />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
              Próxima prova
            </span>
            <span className="text-xs text-muted-foreground">
              {formatExamDate(exam.exam.exam_date)}
            </span>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
              config.badge
            )}>
              <StatusIcon className="w-2.5 h-2.5" />
              {getDaysLabel()}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {exam.exam.materia}
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="flex items-center gap-2">
            <Progress 
              value={percentage} 
              className="h-1 flex-1 bg-muted/50" 
            />
            <span className={cn("text-[10px] font-semibold tabular-nums", config.text)}>
              {Math.round(percentage)}%
            </span>
          </div>
        </div>

        {/* Arrow indicator */}
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </motion.button>

      {/* Detail Sheet */}
      <ExamDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        exam={exam}
        onStudyClick={() => {
          setShowDetailSheet(false);
          const encodedMateria = encodeURIComponent(exam.exam.materia);
          navigate(`/guia-estudos?materia=${encodedMateria}`);
        }}
        onEditClick={() => {
          setShowDetailSheet(false);
          onEditExam?.(exam.exam.id);
        }}
        onRemoveClick={() => {
          setShowDetailSheet(false);
          onRemoveExam?.(exam.exam.id);
        }}
      />
    </>
  );
};
