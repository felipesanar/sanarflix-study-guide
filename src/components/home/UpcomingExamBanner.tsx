import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GraduationCap, Plus, ArrowRight, AlertTriangle, Clock, 
  CheckCircle, Trophy, Calendar, MoreVertical, Zap 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    border: 'border-destructive/40',
    bg: 'bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent',
    text: 'text-destructive',
    badgeBg: 'bg-destructive text-destructive-foreground',
    progressBg: 'bg-destructive',
    ctaVariant: 'destructive' as const,
    Icon: AlertTriangle,
    pulse: true,
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    text: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500 text-white',
    progressBg: 'bg-amber-500',
    ctaVariant: 'outline' as const,
    Icon: Clock,
    pulse: false,
  },
  on_track: {
    border: 'border-emerald-500/40',
    bg: 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent',
    text: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500 text-white',
    progressBg: 'bg-emerald-500',
    ctaVariant: 'outline' as const,
    Icon: CheckCircle,
    pulse: false,
  },
  excellent: {
    border: 'border-primary/40',
    bg: 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
    text: 'text-primary',
    badgeBg: 'bg-primary text-primary-foreground',
    progressBg: 'bg-primary',
    ctaVariant: 'outline' as const,
    Icon: Trophy,
    pulse: false,
  },
};

// Pulse ring animation component
const PulseRing = () => (
  <div className="absolute -inset-0.5 rounded-xl sm:rounded-2xl">
    <div className="absolute inset-0 rounded-xl sm:rounded-2xl border-2 border-destructive/50 animate-ping opacity-20" />
    <div className="absolute inset-0 rounded-xl sm:rounded-2xl border border-destructive/30 animate-pulse" />
  </div>
);

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
      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/30 border border-border/50 mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-3 w-32 mb-3" />
        <Skeleton className="h-2 w-full rounded-full mb-2" />
        <Skeleton className="h-9 w-full rounded-lg" />
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
          className={cn(
            "w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 border-dashed",
            "border-muted-foreground/20 hover:border-primary/50",
            "bg-gradient-to-br from-muted/20 via-transparent to-transparent",
            "hover:from-primary/5 hover:via-primary/2 hover:to-transparent",
            "transition-all duration-300 group"
          )}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className={cn(
              "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl",
              "bg-muted/50 group-hover:bg-primary/10",
              "flex items-center justify-center transition-colors duration-300"
            )}>
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                Acompanhe suas provas
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-[200px]">
                Cadastre sua próxima prova para organizar seus estudos
              </p>
            </div>
            
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-primary/10 text-primary font-medium text-sm",
              "group-hover:bg-primary group-hover:text-primary-foreground",
              "transition-all duration-300"
            )}>
              <Plus className="w-4 h-4" />
              <span>Adicionar prova</span>
            </div>
          </div>
        </button>
      </motion.div>
    );
  }

  const config = statusConfig[exam.status];
  const StatusIcon = config.Icon;
  const percentage = exam.materia_progress?.percentage ?? 0;
  const completed = exam.materia_progress?.completed ?? 0;
  const total = exam.materia_progress?.total ?? 0;

  // Format date
  const formatExamDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, "d 'de' MMM", { locale: ptBR });
  };

  const handleCardClick = () => {
    setShowDetailSheet(true);
  };

  const handleStudyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const encodedMateria = encodeURIComponent(exam.exam.materia);
    navigate(`/guia-estudos?materia=${encodedMateria}`);
  };

  const handleMenuAction = (e: React.MouseEvent, action: 'edit' | 'remove') => {
    e.stopPropagation();
    if (action === 'edit' && onEditExam) {
      onEditExam(exam.exam.id);
    } else if (action === 'remove' && onRemoveExam) {
      onRemoveExam(exam.exam.id);
    }
  };

  const getDaysLabel = () => {
    if (exam.days_remaining === 0) return 'Hoje!';
    if (exam.days_remaining === 1) return 'Amanhã';
    return `${exam.days_remaining} dias`;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-3 sm:mb-4"
      >
        <div
          onClick={handleCardClick}
          className={cn(
            "relative p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 cursor-pointer",
            "transition-all duration-300",
            "hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20",
            "hover:scale-[1.01] active:scale-[0.99]",
            config.border,
            config.bg
          )}
        >
          {/* Pulse animation for critical status */}
          {config.pulse && <PulseRing />}

          {/* Header Row */}
          <div className="relative flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <StatusIcon className={cn("w-4 h-4", config.text)} />
              <span className="text-xs font-medium text-muted-foreground">
                Próxima Prova
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold", config.badgeBg)}>
                {getDaysLabel()}
              </Badge>
              
              {(onEditExam || onRemoveExam) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {onEditExam && (
                      <DropdownMenuItem onClick={(e) => handleMenuAction(e as any, 'edit')}>
                        Editar prova
                      </DropdownMenuItem>
                    )}
                    {onRemoveExam && (
                      <DropdownMenuItem 
                        onClick={(e) => handleMenuAction(e as any, 'remove')}
                        className="text-destructive focus:text-destructive"
                      >
                        Remover prova
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="relative space-y-1.5 mb-3">
            <h4 className="font-semibold text-sm sm:text-base text-foreground leading-tight">
              {exam.exam.materia}
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{exam.exam.exam_name} • {formatExamDate(exam.exam.exam_date)}</span>
            </p>
          </div>

          {/* Progress Section */}
          <div className="relative space-y-2 mb-3">
            <div className="h-2 sm:h-2.5 bg-muted/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn("h-full rounded-full", config.progressBg)}
              />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">
                {completed}/{total} aulas concluídas
              </span>
              <span className={cn("font-semibold", config.text)}>
                {Math.round(percentage)}%
              </span>
            </div>
          </div>

          {/* Insight Message */}
          {exam.lessons_per_day > 0 && (
            <div className="relative flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
              <Zap className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {Math.ceil(exam.lessons_per_day)} {exam.lessons_per_day === 1 ? 'aula' : 'aulas'}/dia para atingir a meta
              </span>
            </div>
          )}

          {/* CTA Button */}
          <Button
            onClick={handleStudyClick}
            variant={config.ctaVariant}
            className={cn(
              "w-full gap-2 font-semibold text-sm h-10 sm:h-11 rounded-lg sm:rounded-xl",
              config.ctaVariant === 'destructive' && "shadow-lg shadow-destructive/20"
            )}
          >
            {exam.cta_label}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

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
