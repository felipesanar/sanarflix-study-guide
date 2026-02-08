import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Calendar, BookOpen } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="flex flex-col py-4 space-y-4 min-h-[70vh]">
      {/* Header with back button and date preview */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="lg"
          className="gap-2 -ml-3 h-12 px-4 rounded-xl active:scale-95 transition-transform"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar
        </Button>

        {/* Date badge */}
        <motion.div
          initial={shouldReduceMotion ? {} : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-4 py-2 rounded-full font-medium"
        >
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{format(selectedDate, 'dd/MM', { locale: ptBR })}</span>
          <span className="text-primary/70">• {daysUntil}d</span>
        </motion.div>
      </div>

      {/* Title */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Qual matéria?</h2>
          <p className="text-sm text-muted-foreground">Selecione a disciplina</p>
        </div>
      </div>

      {/* Materia list - Full width vertical layout for mobile */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="flex flex-col gap-3 pb-2">
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
                  "relative w-full px-4 py-4 rounded-2xl border-2 text-left",
                  "transition-all duration-200 min-h-[56px]",
                  "flex items-center gap-3",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                    : "border-border hover:border-primary/50 bg-card"
                )}
              >
                {/* Checkbox circle */}
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
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
                        <Check className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "font-medium text-base block",
                    isSelected && "text-primary"
                  )}>
                    {materia}
                  </span>
                  
                  {/* Progress bar - always visible for selected */}
                  <AnimatePresence>
                    {isSelected && progress && (
                      <motion.div
                        initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 space-y-1 overflow-hidden"
                      >
                        <Progress value={percentage} className="h-2" />
                        <span className="text-xs text-muted-foreground">
                          {percentage}% concluído
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Percentage badge (when not selected) */}
                {!isSelected && progress && percentage > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {percentage}%
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Exam name input (optional) - Fixed at bottom */}
      <div className="space-y-2 px-1">
        <Label htmlFor="exam-name-mobile" className="text-sm text-muted-foreground">
          Nome da prova (opcional)
        </Label>
        <Input
          id="exam-name-mobile"
          placeholder="P1, P2, Prova Final..."
          value={examName}
          onChange={(e) => onExamNameChange(e.target.value)}
          disabled={isSubmitting}
          maxLength={50}
          className="h-12 rounded-xl text-base"
        />
      </div>

      {/* Footer button - Large for mobile */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ 
          opacity: selectedMateria ? 1 : 0.5, 
          y: 0,
        }}
        transition={{ duration: 0.2 }}
        className="pt-2"
      >
        <Button
          className="w-full h-14 gap-2 rounded-2xl font-semibold text-lg"
          disabled={!selectedMateria || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
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
      </motion.div>
    </div>
  );
};
