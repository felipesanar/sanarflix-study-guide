import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, Plus, Calendar, ChevronRight, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUserExams, calculateExamInsight } from '@/hooks/useUserExams';
import { AddExamModal } from './AddExamModal';
import { ExamItem } from './ExamItem';
import { ExamsFullModal } from './ExamsFullModal';
import type { MateriaProgress, ExamInsight } from '@/types/progressHub';

interface ExamTrackerCardProps {
  byMateria: MateriaProgress[];
  materiasList: string[];
  compact?: boolean;
  className?: string;
}

export const ExamTrackerCard: React.FC<ExamTrackerCardProps> = ({
  byMateria,
  materiasList,
  compact = false,
  className
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { exams, loading, addExam, removeExam } = useUserExams();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);

  // Calculate insights for each exam
  const examInsights = useMemo((): ExamInsight[] => {
    return exams.map(exam => {
      const materiaProgress = byMateria.find(m => 
        m.materia.toLowerCase() === exam.materia.toLowerCase()
      ) || null;
      return calculateExamInsight(exam, materiaProgress);
    }).filter(insight => insight.days_remaining >= 0); // Filter out past exams
  }, [exams, byMateria]);

  // Preview exams (max 2 for compact mode)
  const previewExams = compact ? examInsights.slice(0, 2) : examInsights;
  const hasMoreExams = compact && examInsights.length > 2;

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

  // Get next upcoming exam for compact preview
  const nextExam = examInsights[0];

  const getStatusColor = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-amber-500';
      case 'on_track': return 'text-emerald-500';
      case 'excellent': return 'text-blue-500';
    }
  };

  const getStatusIcon = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'on_track': return '🟢';
      case 'excellent': return '🔵';
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          {!compact && <Skeleton className="h-16 w-full rounded-lg" />}
        </CardContent>
      </Card>
    );
  }

  // Empty state - Compact
  if (exams.length === 0 && compact) {
    return (
      <>
        <Card className={cn("border-dashed h-full", className)}>
          <CardContent className="flex flex-col items-center justify-center py-6 text-center h-full min-h-[180px]">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Suas Provas</h3>
            <p className="text-xs text-muted-foreground mb-3 max-w-[180px]">
              Cadastre suas provas para acompanhar seu progresso
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 h-8 text-xs"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Adicionar prova
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

  // Empty state - Full
  if (exams.length === 0) {
    return (
      <>
        <Card className={cn("border-dashed h-full", className)}>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center h-full">
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

  // Compact mode with exams
  if (compact) {
    return (
      <>
        <Card className={cn("h-full flex flex-col", className)}>
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
                Suas Provas
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsAddModalOpen(true)}
                aria-label="Adicionar prova"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
            <div className="space-y-2 flex-1">
              {previewExams.map((insight) => (
                <motion.div
                  key={insight.exam.id}
                  initial={shouldReduceMotion ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "rounded-lg border p-2.5 cursor-pointer transition-colors hover:bg-accent/50",
                    insight.status === 'critical' && "border-l-2 border-l-red-500",
                    insight.status === 'warning' && "border-l-2 border-l-amber-500",
                    insight.status === 'on_track' && "border-l-2 border-l-emerald-500",
                    insight.status === 'excellent' && "border-l-2 border-l-blue-500"
                  )}
                  onClick={() => handleNavigate(insight.exam.materia)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm" aria-hidden="true">{getStatusIcon(insight.status)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">{insight.exam.materia}</h4>
                        <span className={cn("text-xs font-medium", getStatusColor(insight.status))}>
                          {insight.days_remaining === 0 ? 'Hoje' : 
                           insight.days_remaining === 1 ? 'Amanhã' : 
                           `${insight.days_remaining}d`}
                        </span>
                      </div>
                      {insight.materia_progress && (
                        <div className="mt-1.5">
                          <Progress value={insight.materia_progress.percentage} className="h-1.5" />
                          <span className="text-[10px] text-muted-foreground mt-0.5 block">
                            {insight.materia_progress.percentage}% concluído
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer: View all or Add */}
            <div className="flex items-center gap-2 pt-2 mt-auto border-t">
              {hasMoreExams ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs gap-1"
                  onClick={() => setIsFullModalOpen(true)}
                >
                  Ver todas ({examInsights.length})
                  <ChevronRight className="h-3 w-3" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs gap-1 text-muted-foreground"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar outra
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <AddExamModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          materias={materiasList}
          onAdd={handleAddExam}
        />

        <ExamsFullModal
          open={isFullModalOpen}
          onOpenChange={setIsFullModalOpen}
          exams={examInsights}
          onNavigate={handleNavigate}
          onRemove={handleRemoveExam}
          onAddClick={() => setIsAddModalOpen(true)}
        />
      </>
    );
  }

  // Full mode (non-compact)
  return (
    <>
      <Card className={cn("h-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
              Suas Provas
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsAddModalOpen(true)}
              aria-label="Adicionar prova"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
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
