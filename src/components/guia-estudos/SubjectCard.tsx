import React, { memo, useCallback, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { LessonRow, LessonRowProps } from './LessonRow';

interface SubtemaData {
  subtema: string;
  aulas: LessonRowProps['aula'][];
}

interface TemaData {
  tema: string;
  subtemas: SubtemaData[];
  isCompleted?: boolean;
  aulasCount?: number;
}

interface SubjectCardProps {
  materia: string;
  icon: string;
  temas: TemaData[];
  progress: number;
  totalAulas: number;
  isCompleted?: boolean;
  onTemaClick?: (tema: string) => void;
  onAulaToggle?: (aulaId: string) => void;
  onAulaAction?: (aulaId: string, action: 'video' | 'pdf' | 'quiz') => void;
  isAulaCompleted?: (aulaId: string) => boolean;
  selectedSemestre: string;
  highlightedAula?: string | null;
  highlightedTema?: string | null;
  materiaRef?: React.RefObject<HTMLDivElement>;
  aulaRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
  className?: string;
}

export const SubjectCard: React.FC<SubjectCardProps> = memo(({
  materia,
  icon,
  temas,
  progress,
  totalAulas,
  isCompleted = false,
  onTemaClick,
  onAulaToggle,
  onAulaAction,
  isAulaCompleted,
  selectedSemestre,
  highlightedAula,
  highlightedTema,
  materiaRef,
  aulaRefs,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();
  // Memoize animation props
  const motionProps = useMemo(() => 
    shouldReduceMotion ? {} : {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4 }
    }, [shouldReduceMotion]);

  return (
    <motion.div
      {...motionProps}
      ref={materiaRef}
    >
      <Card className={cn(
        "overflow-hidden transition-all duration-300",
        "border-black/5 dark:border-white/10",
        "shadow-lg hover:shadow-xl",
        isCompleted && "border-green-500/30 dark:border-green-500/20",
        className
      )}>
        {/* Header */}
        <CardHeader className={cn(
          "relative pb-4",
          isCompleted 
            ? "bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent" 
            : "bg-gradient-to-r from-primary/5 via-primary/3 to-transparent"
        )}>
          {/* Completed badge */}
          {isCompleted && (
            <div className="absolute top-4 right-4">
              <Badge className={cn(
                "gap-1.5 px-3 py-1 rounded-full",
                "bg-green-500 hover:bg-green-600 text-white border-green-500"
              )}>
                <Check className="h-3 w-3" />
                Concluída
              </Badge>
            </div>
          )}

          {/* Title row */}
          <div className="flex items-start gap-3 pr-6 sm:pr-28">
            <div className={cn(
              "p-2.5 rounded-xl text-2xl shrink-0",
              isCompleted 
                ? "bg-green-500/10" 
                : "bg-primary/10"
            )}>
              {icon}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <h2 className={cn(
                "text-lg sm:text-xl font-bold leading-tight break-words",
                isCompleted && "text-green-700 dark:text-green-400"
              )}>
                {materia}
                {isCompleted && <span className="ml-2">🏆</span>}
              </h2>
              <p className="text-sm text-muted-foreground">
                {totalAulas} aulas disponíveis
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground uppercase tracking-wide">
                Progresso Geral
              </span>
              <span className={cn(
                "font-bold",
                isCompleted ? "text-green-600 dark:text-green-400" : "text-primary"
              )}>
                {progress}%
              </span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-muted/50 dark:bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isCompleted 
                    ? "bg-gradient-to-r from-green-500 to-green-400" 
                    : "bg-gradient-to-r from-primary to-primary/80"
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {Math.round((progress / 100) * totalAulas)} de {totalAulas} aulas concluídas
            </p>
          </div>
        </CardHeader>

        {/* Content - Accordions */}
        <CardContent className="pt-4 pb-2">
          <Accordion type="multiple" className="space-y-2">
            {temas.map((tema, tIdx) => {
              const temaAulasCount = tema.subtemas.reduce((s, st) => s + st.aulas.length, 0);
              const isHighlighted = highlightedTema === tema.tema;
              
              return (
                <AccordionItem
                  key={`tema-${tIdx}`}
                  value={`tema-${tIdx}`}
                  className={cn(
                    "border rounded-xl px-4 transition-all duration-300",
                    "border-black/5 dark:border-white/10",
                    tema.isCompleted 
                      ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/10" 
                      : "hover:border-primary/20",
                    isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                >
                  <AccordionTrigger 
                    className="hover:no-underline py-4"
                    data-tema={tema.tema}
                    onClick={() => onTemaClick?.(tema.tema)}
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-semibold text-sm sm:text-base leading-tight",
                          tema.isCompleted && "text-green-700 dark:text-green-400"
                        )}>
                          {tema.tema}
                          {tema.isCompleted && <span className="ml-2 text-green-500">✓</span>}
                        </h3>
                        <p className={cn(
                          "text-xs mt-0.5",
                          tema.isCompleted 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-muted-foreground"
                        )}>
                          {temaAulasCount} {temaAulasCount === 1 ? 'aula' : 'aulas'}
                          {tema.isCompleted && <span className="ml-2 font-medium">• Concluído</span>}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2 pb-4">
                    {tema.subtemas.map((subtema, stIdx) => (
                      <div key={stIdx} className="space-y-2 mb-4 last:mb-0">
                        {/* Subtema header */}
                        <div className="flex items-center gap-2 py-2 px-1">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Tópico: {subtema.subtema}
                          </span>
                        </div>

                        {/* Aulas */}
                        <div className="space-y-2 pl-4 border-l-2 border-border/30 dark:border-white/5">
                          {subtema.aulas.map((aula, aIdx) => {
                            const aulaId = `${selectedSemestre}-${materia}-${tema.tema}-${subtema.subtema}-${aula.aula}`;
                            const completed = isAulaCompleted?.(aulaId) || false;
                            const isHighlightedAula = highlightedAula === aula.aula;

                            return (
                              <LessonRow
                                key={aIdx}
                                aula={aula}
                                isCompleted={completed}
                                isHighlighted={isHighlightedAula}
                                onToggleComplete={() => onAulaToggle?.(aulaId)}
                                onAction={(action) => onAulaAction?.(aulaId, action)}
                                ref={(el) => {
                                  if (el && aulaRefs?.current) {
                                    aulaRefs.current.set(aula.aula, el);
                                  }
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </motion.div>
  );
});

SubjectCard.displayName = 'SubjectCard';
