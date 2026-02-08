import React from 'react';
import { motion } from 'framer-motion';
import { 
  GraduationCap, Calendar, BookOpen, Trash2, Pencil, 
  ArrowRight, AlertTriangle, Clock, CheckCircle, Trophy, Zap 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ExamInsight } from '@/types/progressHub';

interface ExamDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamInsight;
  onStudyClick: () => void;
  onEditClick?: () => void;
  onRemoveClick?: () => void;
}

const statusConfig = {
  critical: {
    label: 'Atenção Urgente',
    description: 'Você precisa acelerar o ritmo para concluir a tempo',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    Icon: AlertTriangle,
  },
  warning: {
    label: 'Requer Atenção',
    description: 'Mantenha o foco para não ficar atrasado',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    Icon: Clock,
  },
  on_track: {
    label: 'No Caminho Certo',
    description: 'Você está mantendo um bom ritmo de estudos',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    Icon: CheckCircle,
  },
  excellent: {
    label: 'Excelente!',
    description: 'Você está quase lá, foque na revisão final',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    Icon: Trophy,
  },
};

const ContentComponent: React.FC<ExamDetailSheetProps> = ({
  exam,
  onStudyClick,
  onEditClick,
  onRemoveClick,
}) => {
  const config = statusConfig[exam.status];
  const StatusIcon = config.Icon;
  const percentage = exam.materia_progress?.percentage ?? 0;
  const completed = exam.materia_progress?.completed ?? 0;
  const total = exam.materia_progress?.total ?? 0;
  const remaining = total - completed;

  // Format date
  const formatExamDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  const getDaysLabel = () => {
    if (exam.days_remaining === 0) return 'Hoje!';
    if (exam.days_remaining === 1) return 'Amanhã';
    return `${exam.days_remaining} dias`;
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={cn(
        "p-4 rounded-xl border-2",
        config.bg,
        config.border
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            config.bg
          )}>
            <StatusIcon className={cn("w-5 h-5", config.color)} />
          </div>
          <div className="flex-1">
            <h4 className={cn("font-semibold text-sm", config.color)}>
              {config.label}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Exam Info */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base text-foreground">
              {exam.exam.materia}
            </h3>
            <p className="text-sm text-muted-foreground">
              {exam.exam.exam_name}
            </p>
          </div>
        </div>

        {/* Date Card */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground capitalize">
              {formatExamDate(exam.exam.exam_date)}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs font-semibold">
            {getDaysLabel()}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Progress Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-foreground">
          Seu Progresso
        </h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Aulas concluídas</span>
            <span className="font-semibold text-foreground">
              {completed} de {total}
            </span>
          </div>
          
          <Progress value={percentage} className="h-3" />
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {remaining} {remaining === 1 ? 'aula restante' : 'aulas restantes'}
            </span>
            <span className={cn("text-sm font-bold", config.color)}>
              {Math.round(percentage)}%
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Aulas restantes</span>
            </div>
            <p className="text-lg font-bold text-foreground">{remaining}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Aulas/dia</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {exam.lessons_per_day > 0 ? Math.ceil(exam.lessons_per_day) : '—'}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={onStudyClick}
          className="w-full gap-2 h-11 font-semibold text-sm rounded-xl shadow-lg shadow-primary/20"
        >
          <BookOpen className="w-4 h-4" />
          Ir para a matéria
          <ArrowRight className="w-4 h-4" />
        </Button>

        <div className="flex gap-2">
          {onEditClick && (
            <Button
              onClick={onEditClick}
              variant="outline"
              className="flex-1 gap-2 h-10 text-sm rounded-lg"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
          )}
          {onRemoveClick && (
            <Button
              onClick={onRemoveClick}
              variant="outline"
              className="flex-1 gap-2 h-10 text-sm rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/50"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ExamDetailSheet: React.FC<ExamDetailSheetProps> = ({
  open,
  onOpenChange,
  exam,
  onStudyClick,
  onEditClick,
  onRemoveClick,
}) => {
  const isMobile = useIsMobile();

  // Mobile: use Sheet (bottom drawer)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-8 pt-4 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-3" />
            <SheetTitle className="text-left text-lg">
              Detalhes da Prova
            </SheetTitle>
          </SheetHeader>
          <ContentComponent
            open={open}
            onOpenChange={onOpenChange}
            exam={exam}
            onStudyClick={onStudyClick}
            onEditClick={onEditClick}
            onRemoveClick={onRemoveClick}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: use Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da Prova</DialogTitle>
        </DialogHeader>
        <ContentComponent
          open={open}
          onOpenChange={onOpenChange}
          exam={exam}
          onStudyClick={onStudyClick}
          onEditClick={onEditClick}
          onRemoveClick={onRemoveClick}
        />
      </DialogContent>
    </Dialog>
  );
};
