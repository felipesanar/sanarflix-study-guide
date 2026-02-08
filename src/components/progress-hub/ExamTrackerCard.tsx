import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, Plus, Calendar, ChevronDown, ChevronUp 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUserExams, calculateExamInsight } from '@/hooks/useUserExams';
import { AddExamModal } from './AddExamModal';
import { ExamItem } from './ExamItem';
import type { MateriaProgress, ExamInsight } from '@/types/progressHub';

interface ExamTrackerCardProps {
  byMateria: MateriaProgress[];
  materiasList: string[];
  className?: string;
}

export const ExamTrackerCard: React.FC<ExamTrackerCardProps> = ({
  byMateria,
  materiasList,
  className
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { exams, loading, addExam, removeExam } = useUserExams();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate insights for each exam
  const examInsights = useMemo((): ExamInsight[] => {
    return exams.map(exam => {
      const materiaProgress = byMateria.find(m => 
        m.materia.toLowerCase() === exam.materia.toLowerCase()
      ) || null;
      return calculateExamInsight(exam, materiaProgress);
    }).filter(insight => insight.days_remaining >= 0); // Filter out past exams
  }, [exams, byMateria]);

  // Handle navigation to study guide
  const handleNavigate = (materia: string) => {
    navigate(`/guia-estudos?materia=${encodeURIComponent(materia)}`);
  };

  // Handle add exam
  const handleAddExam = async (materia: string, examName: string, examDate: string) => {
    const result = await addExam(materia, examName, examDate);
    return { error: result.error };
  };

  // Handle remove exam
  const handleRemoveExam = async (examId: string) => {
    await removeExam(examId);
  };

  // Loading state
  if (loading) {
    return (
      <Card className={cn("h-fit", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // Empty state - No exams
  if (exams.length === 0) {
    return (
      <>
        <Card className={cn("border-dashed h-fit", className)}>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-base mb-1">Suas Provas</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-[200px]">
              Cadastre suas provas para acompanhar seu progresso de estudos
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar primeira prova
            </Button>
          </CardContent>
        </Card>

        <AddExamModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          materias={materiasList}
          onAdd={handleAddExam}
        />
      </>
    );
  }

  return (
    <>
      <Card className={cn("h-fit", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
              Suas Provas
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsAddModalOpen(true)}
                aria-label="Adicionar prova"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Summary when collapsed */}
          {!isExpanded && examInsights.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {examInsights.length} {examInsights.length === 1 ? 'prova' : 'provas'} cadastradas
            </p>
          )}
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {examInsights.map((insight) => (
                        <ExamItem
                          key={insight.exam.id}
                          insight={insight}
                          onNavigate={handleNavigate}
                          onRemove={handleRemoveExam}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>

                {/* Add more button at bottom */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3 gap-2 text-muted-foreground"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar outra prova
                </Button>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <AddExamModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        materias={materiasList}
        onAdd={handleAddExam}
      />
    </>
  );
};
