import React from 'react';
import { ArrowRight, Lightbulb, Clock, PlayCircle, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NextLessonCardProps {
  lessonTitle?: string;
  tip?: string;
  onContinue?: () => void;
  isEmpty?: boolean;
  isLoading?: boolean;
  className?: string;
}

export const NextLessonCard: React.FC<NextLessonCardProps> = ({
  lessonTitle,
  tip = "Estude em blocos de 25min para máxima retenção (Técnica Pomodoro). Mantenha o foco constante para melhorar seus resultados.",
  onContinue,
  isEmpty = false,
  isLoading = false,
  className
}) => {
  if (isLoading) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-2xl p-6 sm:p-8",
        "bg-gradient-to-br from-card via-card to-card/80",
        "border border-border/50 shadow-lg",
        className
      )}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-7 w-3/4 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-10 w-32 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "relative overflow-hidden rounded-2xl p-6 sm:p-8",
          "bg-gradient-to-br from-card via-card to-muted/30",
          "border border-border/50 shadow-lg",
          className
        )}
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="p-4 rounded-2xl bg-muted/50 mb-4">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Escolha uma matéria para começar
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Selecione uma matéria na lista abaixo para iniciar seus estudos e acompanhar seu progresso.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-card via-card to-card/80",
        "border border-border/40 dark:border-white/5",
        "shadow-lg hover:shadow-xl transition-shadow duration-300",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
      
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-5 dark:opacity-10">
        <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-primary blur-3xl" />
        <div className="absolute top-12 right-12 w-24 h-24 rounded-full bg-primary/50 blur-2xl" />
      </div>

      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Content */}
          <div className="flex-1 space-y-4">
            {/* Label */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
                <PlayCircle className="h-3 w-3" />
                Próxima Lição
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {lessonTitle || "Introdução a prática médica"}
            </h2>

            {/* Tip */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 dark:bg-white/5 border border-border/30 dark:border-white/5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
                <Lightbulb className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {tip}
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-start lg:items-end gap-3 lg:min-w-[180px]">
            <Button
              size="lg"
              onClick={onContinue}
              className={cn(
                "group gap-2 px-6 h-12 rounded-xl font-semibold",
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                "shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30",
                "transition-all duration-300"
              )}
            >
              Continuar
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>~25 min</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
