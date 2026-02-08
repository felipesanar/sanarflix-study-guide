import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { GraduationCap, Plus, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExamItem } from './ExamItem';
import type { ExamInsight } from '@/types/progressHub';

interface ExamsFullModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exams: ExamInsight[];
  onNavigate: (materia: string) => void;
  onRemove: (examId: string) => void;
  onAddClick: () => void;
}

export const ExamsFullModal: React.FC<ExamsFullModalProps> = ({
  open,
  onOpenChange,
  exams,
  onNavigate,
  onRemove,
  onAddClick
}) => {
  const shouldReduceMotion = useReducedMotion();

  const handleAddClick = () => {
    onOpenChange(false);
    // Small delay to allow modal transition
    setTimeout(() => onAddClick(), 150);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
              Suas Provas
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleAddClick}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar
            </Button>
          </div>
        </DialogHeader>

        {exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Calendar className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-base mb-2">Nenhuma prova cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[240px]">
              Adicione suas provas para acompanhar seu progresso de estudos
            </p>
            <Button onClick={handleAddClick} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar primeira prova
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {exams.map((insight) => (
                  <motion.div
                    key={insight.exam.id}
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
                  >
                    <ExamItem
                      insight={insight}
                      onNavigate={(materia) => {
                        onOpenChange(false);
                        onNavigate(materia);
                      }}
                      onRemove={onRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
