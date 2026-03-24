import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Autoplay from 'embla-carousel-autoplay';
import { 
  GraduationCap, Plus, Calendar, ChevronRight, Clock, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import { useUserExams, calculateExamInsight } from '@/hooks/useUserExams';
import { AddExamWizard } from './AddExamWizard';
import { ExamItem } from './ExamItem';
import { ExamsFullModal } from './ExamsFullModal';
import type { MateriaProgress, ExamInsight } from '@/types/progressHub';

interface ExamTrackerCardProps {
  byMateria: MateriaProgress[];
  materiasList: string[];
  compact?: boolean;
  className?: string;
  onExamAdded?: (materia: string, daysUntil: number) => void;
  onExamRemoved?: (examId: string, daysUntil: number) => void;
  onExamClicked?: (examId: string, source: 'carousel' | 'card') => void;
}

export const ExamTrackerCard: React.FC<ExamTrackerCardProps> = memo(({
  byMateria,
  materiasList,
  compact = false,
  className,
  onExamAdded,
  onExamRemoved,
  onExamClicked
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { exams, loading, addExam, removeExam } = useUserExams();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);
  
  // Carousel state
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Autoplay plugin - pauses on hover
  const autoplayPlugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  
  // Track current slide
  useEffect(() => {
    if (!carouselApi) return;
    
    setCurrentSlide(carouselApi.selectedScrollSnap());
    
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

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
  const handleNavigate = useCallback((materia: string, examId?: string, source: 'carousel' | 'card' = 'card') => {
    if (examId) {
      onExamClicked?.(examId, source);
    }
    navigate(`/guia-estudos?materia=${encodeURIComponent(materia)}`);
  }, [navigate, onExamClicked]);

  // Handle add exam
  const handleAddExam = useCallback(async (materia: string, examName: string, examDate: string) => {
    const startTime = Date.now();
    const result = await addExam(materia, examName, examDate);
    
    if (!result.error) {
      // Calculate days until exam
      const [year, month, day] = examDate.split('-').map(Number);
      const examDateObj = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((examDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      onExamAdded?.(materia, daysUntil);
    }
    
    return { error: result.error };
  }, [addExam, onExamAdded]);

  // Handle remove exam
  const handleRemoveExam = useCallback(async (examId: string) => {
    // Find exam to get days remaining
    const exam = examInsights.find(e => e.exam.id === examId);
    if (exam) {
      onExamRemoved?.(examId, exam.days_remaining);
    }
    await removeExam(examId);
  }, [removeExam, examInsights, onExamRemoved]);

  // Get next upcoming exam for compact preview
  const nextExam = examInsights[0];

  const getStatusColor = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-amber-500';
      case 'on_track': return 'text-emerald-500';
      case 'excellent': return 'text-primary';
    }
  };

  const getStatusBg = (status: ExamInsight['status']) => {
    switch (status) {
      case 'critical': return 'bg-destructive/10 border-destructive/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      case 'on_track': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'excellent': return 'bg-primary/10 border-primary/30';
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

        <AddExamWizard
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          materias={materiasList}
          materiasProgress={byMateria}
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

        <AddExamWizard
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          materias={materiasList}
          materiasProgress={byMateria}
          onAdd={handleAddExam}
        />
      </>
    );
  }

  // Compact mode with exams - Netflix-style carousel
  if (compact) {
    const hasMultipleExams = examInsights.length > 1;
    const carouselPlugins = shouldReduceMotion || !hasMultipleExams 
      ? [] 
      : [autoplayPlugin.current];

    return (
      <>
        <Card className={cn("h-full flex flex-col", className)}>
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
                Suas Provas
                {hasMultipleExams && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({examInsights.length})
                  </span>
                )}
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
            <Carousel
              setApi={setCarouselApi}
              plugins={carouselPlugins}
              opts={{ loop: true, align: 'start' }}
              className="w-full flex-1"
            >
              <CarouselContent className="-ml-2">
                {examInsights.map((insight) => (
                  <CarouselItem key={insight.exam.id} className="pl-2 basis-full">
                    <div
                      className={cn(
                        "rounded-xl border p-3 cursor-pointer transition-all duration-200",
                        "hover:shadow-md hover:border-primary/30",
                        getStatusBg(insight.status)
                      )}
                      onClick={() => handleNavigate(insight.exam.materia)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNavigate(insight.exam.materia);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Status indicator with pulse for urgent */}
                        <div className="relative flex-shrink-0">
                          <span className="text-base" aria-hidden="true">{getStatusIcon(insight.status)}</span>
                          {insight.status === 'critical' && insight.days_remaining <= 3 && (
                            <motion.div
                              animate={shouldReduceMotion ? {} : { scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="absolute inset-0 rounded-full bg-destructive/30"
                            />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm truncate">{insight.exam.materia}</h4>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {insight.days_remaining <= 7 && (
                                <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              )}
                              <span className={cn("text-xs font-bold tabular-nums", getStatusColor(insight.status))}>
                                {insight.days_remaining === 0 ? 'Hoje!' : 
                                 insight.days_remaining === 1 ? 'Amanhã' : 
                                 `${insight.days_remaining}d`}
                              </span>
                            </div>
                          </div>
                          
                          {insight.materia_progress && (
                            <div className="mt-2 space-y-1">
                              <Progress value={insight.materia_progress.percentage} className="h-1.5" />
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{insight.materia_progress.percentage}%</span>
                                {insight.status === 'critical' && insight.lessons_per_day > 0 && (
                                  <span className="flex items-center gap-0.5 text-destructive font-medium">
                                    <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                                    {Math.ceil(insight.lessons_per_day)}/dia
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            {/* Navigation dots (Netflix-style) */}
            {hasMultipleExams && (
              <div className="flex justify-center gap-1.5 pt-3">
                {examInsights.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => carouselApi?.scrollTo(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === currentSlide 
                        ? "bg-primary w-4" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5"
                    )}
                    aria-label={`Ir para prova ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Footer: View all or Add */}
            <div className="flex items-center gap-2 pt-2 mt-auto border-t">
              {examInsights.length > 2 ? (
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

        <AddExamWizard
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          materias={materiasList}
          materiasProgress={byMateria}
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

      <AddExamWizard
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        materias={materiasList}
        materiasProgress={byMateria}
        onAdd={handleAddExam}
      />
    </>
  );
});

ExamTrackerCard.displayName = 'ExamTrackerCard';
