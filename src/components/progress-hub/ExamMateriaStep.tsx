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

interface ExamMateriaStepProps {
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

export const ExamMateriaStep: React.FC<ExamMateriaStepProps> = ({
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
    <div className="flex flex-col gap-5">
      {/* Header with back button and date preview */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2"
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
          className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium"
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{format(selectedDate, 'dd/MM', { locale: ptBR })}</span>
          <span className="text-primary/70">• {daysUntil}d</span>
        </motion.div>
      </div>

      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Qual matéria?</h2>
          <p className="text-sm text-muted-foreground">Selecione a disciplina da prova</p>
        </div>
      </div>

      {/* Materia cards - NO scroll, modal expands */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {materias.map((materia) => {
          const isSelected = selectedMateria === materia;
          const progress = getProgress(materia);
          const percentage = progress?.percentage || 0;

          return (
            <motion.button
              key={materia}
              type="button"
              whileHover={shouldReduceMotion ? {} : { scale: 1.01 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
              onClick={() => onMateriaSelect(materia)}
              disabled={isSubmitting}
              className={cn(
                "w-full px-4 py-3 rounded-xl border-2 text-left transition-all duration-200",
                "flex items-start gap-3 min-h-[56px]",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              )}
            >
              {/* Radio circle */}
              <div className={cn(
                "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all mt-0.5",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              )}>
                <AnimatePresence mode="wait">
                  {isSelected && (
                    <motion.div
                      initial={shouldReduceMotion ? {} : { scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={shouldReduceMotion ? {} : { scale: 0, rotate: 90 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Materia name - Full text, never truncated */}
                <span 
                  className={cn(
                    "font-medium text-sm block leading-tight",
                    "break-words",
                    isSelected && "text-primary"
                  )}
                  style={{ wordBreak: 'break-word', hyphens: 'auto' }}
                >
                  {materia}
                </span>

                {/* Progress bar - only show when selected */}
                <AnimatePresence>
                  {isSelected && progress && (
                    <motion.div
                      initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-1 overflow-hidden mt-2"
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
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                  {percentage}%
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Exam name input (optional) */}
      <div className="space-y-2">
        <Label htmlFor="exam-name" className="text-sm text-muted-foreground">
          Nome da prova (opcional)
        </Label>
        <Input
          id="exam-name"
          placeholder="P1, P2, Prova Final..."
          value={examName}
          onChange={(e) => onExamNameChange(e.target.value)}
          disabled={isSubmitting}
          maxLength={50}
          className="h-11 rounded-xl"
        />
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12 rounded-xl"
          onClick={onBack}
          disabled={isSubmitting}
        >
          Voltar
        </Button>
        <Button
          className="flex-1 h-12 gap-2 rounded-xl font-medium"
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
              <Check className="h-4 w-4" />
              Salvar Prova
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
