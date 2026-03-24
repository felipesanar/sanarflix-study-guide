import React, { forwardRef, memo, useCallback, useMemo } from 'react';
import { Check, Play, FileText, Brain, Clock } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AulaData {
  aula: string;
  link_aula?: string | null;
  link_pdf?: string | null;
  link_quiz?: string | null;
  duration?: string;
}

export interface LessonRowProps {
  aula: AulaData;
  isCompleted?: boolean;
  isHighlighted?: boolean;
  onToggleComplete?: () => void;
  onAction?: (action: 'video' | 'pdf' | 'quiz') => void;
}

export const LessonRow = memo(forwardRef<HTMLDivElement, LessonRowProps>(({
  aula,
  isCompleted = false,
  isHighlighted = false,
  onToggleComplete,
  onAction
}, ref) => {
  const shouldReduceMotion = useReducedMotion();
  
  const hasVideo = !!aula.link_aula;
  const hasPdf = !!aula.link_pdf;
  const hasQuiz = !!aula.link_quiz;

  // Memoize handlers
  const handleVideoClick = useCallback(() => {
    window.open(aula.link_aula!, '_blank');
    onAction?.('video');
  }, [aula.link_aula, onAction]);

  const handlePdfClick = useCallback(() => {
    window.open(aula.link_pdf!, '_blank');
    onAction?.('pdf');
  }, [aula.link_pdf, onAction]);

  const handleQuizClick = useCallback(() => {
    window.open(aula.link_quiz!, '_blank');
    onAction?.('quiz');
  }, [aula.link_quiz, onAction]);

  // Animation props based on reduced motion preference
  const motionProps = useMemo(() => 
    shouldReduceMotion ? {} : {
      initial: { opacity: 0, x: -10 },
      animate: { opacity: 1, x: 0 },
      whileHover: { scale: 1.005 },
      transition: { type: "spring", stiffness: 400, damping: 25 }
    }, [shouldReduceMotion]);

  return (
    <motion.div
      ref={ref}
      data-aula={aula.aula}
      {...motionProps}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.005 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative p-4 rounded-xl transition-all duration-300",
        "border shadow-sm",
        isCompleted
          ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/30"
          : "bg-card border-border/40 dark:border-white/5 hover:border-primary/20 hover:bg-muted/30",
        isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggleComplete}
          className="shrink-0 mt-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
          aria-label={isCompleted ? "Marcar como pendente" : "Marcar como concluído"}
        >
          <motion.div
            whileTap={{ scale: 0.9 }}
            className={cn(
              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
              isCompleted
                ? "bg-green-500 border-green-500"
                : "border-muted-foreground/40 hover:border-primary group-hover:border-primary/60"
            )}
          >
            <AnimatedCheck show={isCompleted} />
          </motion.div>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              "font-medium text-sm leading-tight",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {aula.aula}
            </h4>
            {aula.duration && (
              <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {aula.duration}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {hasVideo && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.open(aula.link_aula!, '_blank');
                  onAction?.('video');
                }}
                className={cn(
                  "h-8 gap-1.5 rounded-lg text-xs font-medium",
                  "border-border/50 hover:border-primary/30",
                  "hover:bg-primary hover:text-primary-foreground",
                  "transition-all duration-200"
                )}
              >
                <Play className="h-3 w-3" />
                Assistir Aula
              </Button>
            )}
            {hasPdf && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.open(aula.link_pdf!, '_blank');
                  onAction?.('pdf');
                }}
                className={cn(
                  "h-8 gap-1.5 rounded-lg text-xs font-medium",
                  "border-border/50 hover:border-primary/30",
                  "hover:bg-primary hover:text-primary-foreground",
                  "transition-all duration-200"
                )}
              >
                <FileText className="h-3 w-3" />
                Material PDF
              </Button>
            )}
            {hasQuiz && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.open(aula.link_quiz!, '_blank');
                  onAction?.('quiz');
                }}
                className={cn(
                  "h-8 gap-1.5 rounded-lg text-xs font-medium",
                  "border-border/50 hover:border-primary/30",
                  "hover:bg-primary hover:text-primary-foreground",
                  "transition-all duration-200"
                )}
              >
                <Brain className="h-3 w-3" />
                Fazer Quiz
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Completed indicator */}
      {isCompleted && (
        <div className="absolute top-2 right-2">
          <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Concluído
          </span>
        </div>
      )}
    </motion.div>
  );
}));

LessonRow.displayName = 'LessonRow';

// Animated check icon component
const AnimatedCheck: React.FC<{ show: boolean }> = ({ show }) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: show ? 1 : 0, 
        opacity: show ? 1 : 0 
      }}
      transition={{ 
        type: "spring",
        stiffness: 500,
        damping: 30
      }}
    >
      <Check className="h-3 w-3 text-white" />
    </motion.div>
  );
};
