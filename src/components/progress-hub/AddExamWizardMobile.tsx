import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { ExamCalendarStepMobile } from './ExamCalendarStepMobile';
import { ExamMateriaStepMobile } from './ExamMateriaStepMobile';
import { ExamSuccessStepMobile } from './ExamSuccessStepMobile';
import { calculateExamInsight } from '@/hooks/useUserExams';
import type { MateriaProgress, ExamInsight, UserExam } from '@/types/progressHub';

type WizardStep = 'calendar' | 'materia' | 'success';

interface WizardState {
  step: WizardStep;
  selectedDate: Date | undefined;
  selectedMateria: string;
  examName: string;
  direction: number;
}

interface AddExamWizardMobileProps {
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

// Haptic feedback helper
const triggerHaptic = (duration: number = 10) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration);
  }
};

export const AddExamWizardMobile: React.FC<AddExamWizardMobileProps> = ({
  open,
  onOpenChange,
  materias,
  materiasProgress,
  onAdd,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [state, setState] = useState<WizardState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedInsight, setSavedInsight] = useState<ExamInsight | null>(null);

  // Mobile-optimized animation variants
  const slideVariants = useMemo(() => ({
    enter: (direction: number) => ({
      x: shouldReduceMotion ? 0 : direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: shouldReduceMotion ? 0 : direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  }), [shouldReduceMotion]);

  // Faster transitions for mobile
  const mobileTransition = useMemo(() => ({
    x: { type: "spring" as const, stiffness: 500, damping: 40 },
    opacity: { duration: 0.15 },
  }), []);

  // Reset wizard state
  const resetWizard = useCallback(() => {
    setState(initialState);
    setSavedInsight(null);
  }, []);

  // Handle drawer close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(resetWizard, 200);
    }
    onOpenChange(newOpen);
  }, [onOpenChange, resetWizard]);

  // Navigate to step
  const goToStep = useCallback((step: WizardStep, direction: number = 1) => {
    triggerHaptic(5);
    setState(prev => ({ ...prev, step, direction }));
  }, []);

  // Handle date selection with haptic
  const handleDateSelect = useCallback((date: Date | undefined) => {
    triggerHaptic(10);
    setState(prev => ({ ...prev, selectedDate: date }));
  }, []);

  // Handle materia selection with haptic
  const handleMateriaSelect = useCallback((materia: string) => {
    triggerHaptic(10);
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
    triggerHaptic(15);

    const year = state.selectedDate.getFullYear();
    const month = String(state.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(state.selectedDate.getDate()).padStart(2, '0');
    const examDate = `${year}-${month}-${day}`;

    const result = await onAdd(state.selectedMateria, state.examName, examDate);
    
    setIsSubmitting(false);

    if (!result.error) {
      triggerHaptic(20);
      
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
    triggerHaptic(10);
    resetWizard();
  }, [resetWizard]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent 
        className="max-h-[96vh] focus:outline-none"
        aria-describedby="exam-wizard-mobile-description"
      >
        <span id="exam-wizard-mobile-description" className="sr-only">
          Wizard para adicionar nova prova em três etapas
        </span>
        
        <div className="relative overflow-hidden px-4 pb-[env(safe-area-inset-bottom,16px)]">
          <AnimatePresence mode="wait" custom={state.direction}>
            {state.step === 'calendar' && (
              <motion.div
                key="calendar"
                custom={state.direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={mobileTransition}
              >
                <ExamCalendarStepMobile
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
                transition={mobileTransition}
              >
                <ExamMateriaStepMobile
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
                transition={mobileTransition}
              >
                <ExamSuccessStepMobile
                  insight={savedInsight}
                  onAddAnother={handleAddAnother}
                  onClose={() => handleOpenChange(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
