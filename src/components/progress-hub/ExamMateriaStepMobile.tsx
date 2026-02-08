import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Calendar, BookOpen } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { MateriaProgress } from '@/types/progressHub';

interface ExamMateriaStepMobileProps {
  selectedDate: Date;
  selectedMateria: string;
  examName: string;
  materias: string[];
  materiasProgress: MateriaProgress[];
  onMateriaSelect: (materia: string) => void;
  onExamNameChange: (name: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const ExamMateriaStepMobile: React.FC<ExamMateriaStepMobileProps> = ({
  selectedDate,
  selectedMateria,
  examName,
  materias,
  materiasProgress,
  onMateriaSelect,
  onExamNameChange,
  onBack,
  onSubmit,
  isSubmitting,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const today = startOfDay(new Date());
  const daysUntil = differenceInDays(startOfDay(selectedDate), today);

  // Get progress for a specific materia
  const getProgress = (materia: string): MateriaProgress | undefined => {
    return materiasProgress.find(
      m => m.materia.toLowerCase() === materia.toLowerCase()
    );
  };

  return (
    <div className="flex flex-col min-h-0 max-h-[85vh]">
      {/* Header with back button and date preview */}
      <div className="flex items-center justify-between py-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2 h-10 px-3 rounded-lg active:scale-95 transition-transform"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        {/* Date badge */}
        <motion.div
          initial={shouldReduceMotion ? {} : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium"
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{format(selectedDate, 'dd/MM', { locale: ptBR })}</span>
          <span className="text-primary/70">• {daysUntil}d</span>
        </motion.div>
      </div>

      {/* Title */}
      <div className="flex items-center gap-3 py-2 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Qual matéria?</h2>
          <p className="text-sm text-muted-foreground">Selecione a disciplina</p>
        </div>
      </div>

      {/* Materia list - Full width vertical layout with invisible scroll */}
      <div 
        className={cn(
          "flex-1 min-h-0 -mx-4 px-4 overflow-y-auto",
          "[&::-webkit-scrollbar]:hidden",
          "[-ms-overflow-style:none]",
          "[scrollbar-width:none]"
        )}
      >
        <div className="flex flex-col gap-2 py-2">
          {materias.map((materia) => {
            const isSelected = selectedMateria === materia;
            const progress = getProgress(materia);
            const percentage = progress?.percentage || 0;

            return (
              <motion.button
                key={materia}
                type="button"
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                onClick={() => onMateriaSelect(materia)}
                disabled={isSubmitting}
                className={cn(
                  "relative w-full px-3 py-3 rounded-xl border text-left",
                  "transition-all duration-200 min-h-[48px]",
                  "flex items-center gap-3",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                  "active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                {/* Checkbox circle */}
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}>
                  <AnimatePresence mode="wait">
                    {isSelected && (
                      <motion.div
                        initial={shouldReduceMotion ? {} : { scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={shouldReduceMotion ? {} : { scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Content - Full name visible */}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-medium text-sm block leading-tight",
                    "break-words hyphens-auto",
                    isSelected && "text-primary"
                  )}
                  style={{ wordBreak: 'break-word' }}
                  >
                    {materia}
                  </span>
                  
                  {/* Progress bar - show when selected */}
                  <AnimatePresence>
                    {isSelected && progress && (
                      <motion.div
                        initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1.5 space-y-1 overflow-hidden"
                      >
                        <Progress value={percentage} className="h-1.5" />
                        <span className="text-xs text-muted-foreground">
                          {percentage}% concluído
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Percentage badge (when not selected) */}
                {!isSelected && progress && percentage > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                    {percentage}%
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Exam name input + Submit button - Fixed at bottom */}
      <div className="shrink-0 pt-3 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="exam-name-mobile" className="text-xs text-muted-foreground">
            Nome da prova (opcional)
          </Label>
          <Input
            id="exam-name-mobile"
            placeholder="P1, P2, Prova Final..."
            value={examName}
            onChange={(e) => onExamNameChange(e.target.value)}
            disabled={isSubmitting}
            maxLength={50}
            className="h-10 rounded-lg text-sm"
          />
        </div>

        <Button
          className="w-full h-12 gap-2 rounded-xl font-semibold text-base"
          disabled={!selectedMateria || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
              />
              Salvando...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Salvar Prova
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
