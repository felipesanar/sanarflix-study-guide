import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ExamCalendarStep } from './ExamCalendarStep';
import { ExamMateriaStep } from './ExamMateriaStep';
import { ExamSuccessStep } from './ExamSuccessStep';
import { AddExamWizardMobile } from './AddExamWizardMobile';
import { calculateExamInsight } from '@/hooks/useUserExams';
import type { MateriaProgress, ExamInsight, UserExam } from '@/types/progressHub';


type WizardStep = 'calendar' | 'materia' | 'success';

interface WizardState {
  step: WizardStep;
  selectedDate: Date | undefined;
  selectedMateria: string;
  examName: string;
  direction: number; // 1 = forward, -1 = backward
}

interface AddExamWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materias: string[];
  materiasProgress: MateriaProgress[];
  onAdd: (materia: string, examName: string, examDate: string) => Promise<{ error: string | null }>;
}

const initialState: WizardState = {
  step: 'calendar',
  selectedDate: undefined,
  selectedMateria: '',
  examName: '',
  direction: 1,
};

export const AddExamWizard: React.FC<AddExamWizardProps> = ({
  open,
  onOpenChange,
  materias,
  materiasProgress,
  onAdd,
}) => {
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();
  const [state, setState] = useState<WizardState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedInsight, setSavedInsight] = useState<ExamInsight | null>(null);

  // Animation variants for step transitions
  const slideVariants = useMemo(() => ({
    enter: (direction: number) => ({
      x: shouldReduceMotion ? 0 : direction > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: shouldReduceMotion ? 0 : direction < 0 ? 200 : -200,
      opacity: 0,
    }),
  }), [shouldReduceMotion]);

  const transitionConfig = useMemo(() => ({
    x: { type: "spring" as const, stiffness: 400, damping: 35 },
    opacity: { duration: 0.2 },
  }), []);

  // Reset wizard state
  const resetWizard = useCallback(() => {
    setState(initialState);
    setSavedInsight(null);
  }, []);

  // Handle dialog close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(resetWizard, 200);
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetWizard]);

  // Navigate to next step
  const goToStep = useCallback((step: WizardStep, direction: number = 1) => {
    setState(prev => ({ ...prev, step, direction }));
  }, []);

  // Handle date selection
  const handleDateSelect = useCallback((date: Date | undefined) => {
    setState(prev => ({ ...prev, selectedDate: date }));
  }, []);

  // Handle materia selection
  const handleMateriaSelect = useCallback((materia: string) => {
    setState(prev => ({ ...prev, selectedMateria: materia }));
  }, []);

  // Handle exam name change
  const handleExamNameChange = useCallback((name: string) => {
    setState(prev => ({ ...prev, examName: name }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!state.selectedDate || !state.selectedMateria) return;

    setIsSubmitting(true);

    const year = state.selectedDate.getFullYear();
    const month = String(state.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(state.selectedDate.getDate()).padStart(2, '0');
    const examDate = `${year}-${month}-${day}`;

    const result = await onAdd(state.selectedMateria, state.examName, examDate);
    
    setIsSubmitting(false);

    if (!result.error) {
      const mockExam: UserExam = {
        id: 'temp',
        user_id: '',
        materia: state.selectedMateria,
        exam_name: state.examName || 'Prova',
        exam_date: examDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const materiaProgress = materiasProgress.find(
        m => m.materia.toLowerCase() === state.selectedMateria.toLowerCase()
      ) || null;
      
      const insight = calculateExamInsight(mockExam, materiaProgress);
      setSavedInsight(insight);
      goToStep('success', 1);
    }
  }, [state.selectedDate, state.selectedMateria, state.examName, onAdd, materiasProgress, goToStep]);

  // Handle "Add another" action
  const handleAddAnother = useCallback(() => {
    resetWizard();
  }, [resetWizard]);

  // Mobile: Use dedicated mobile wizard with Drawer
  if (isMobile) {
    return (
      <AddExamWizardMobile
        open={open}
        onOpenChange={onOpenChange}
        materias={materias}
        materiasProgress={materiasProgress}
        onAdd={onAdd}
      />
    );
  }

  // Desktop: Use Dialog-based wizard
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-lg overflow-visible p-0"
        aria-describedby="exam-wizard-description"
      >
        <span id="exam-wizard-description" className="sr-only">
          Wizard para adicionar nova prova em três etapas
        </span>
        
        <div className="p-6">
          <AnimatePresence mode="wait" custom={state.direction}>
            {state.step === 'calendar' && (
              <motion.div
                key="calendar"
                custom={state.direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transitionConfig}
              >
                <ExamCalendarStep
                  selectedDate={state.selectedDate}
                  onSelect={handleDateSelect}
                  onNext={() => goToStep('materia', 1)}
                  onClose={() => handleOpenChange(false)}
                />
              </motion.div>
            )}

            {state.step === 'materia' && state.selectedDate && (
              <motion.div
                key="materia"
                custom={state.direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transitionConfig}
              >
                <ExamMateriaStep
                  selectedDate={state.selectedDate}
                  selectedMateria={state.selectedMateria}
                  examName={state.examName}
                  materias={materias}
                  materiasProgress={materiasProgress}
                  onMateriaSelect={handleMateriaSelect}
                  onExamNameChange={handleExamNameChange}
                  onBack={() => goToStep('calendar', -1)}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                />
              </motion.div>
            )}

            {state.step === 'success' && savedInsight && (
              <motion.div
                key="success"
                custom={state.direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transitionConfig}
              >
                <ExamSuccessStep
                  insight={savedInsight}
                  onAddAnother={handleAddAnother}
                  onClose={() => handleOpenChange(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};
