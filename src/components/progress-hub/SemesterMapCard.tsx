import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, ChevronDown, ChevronRight, CheckCircle2, 
  AlertCircle, Trophy, ExternalLink 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { MateriaProgress, TemaProgress } from '@/types/progressHub';
import { TEMA_STATUS, getTemaStatus } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface SemesterMapCardProps {
  byMateria: MateriaProgress[];
  byTema: TemaProgress[];
  onCompleteTheme?: (materia: string, tema: string) => void;
  onThemeClick?: (materia: string, tema: string) => void;
  syncing?: boolean;
}

export const SemesterMapCard: React.FC<SemesterMapCardProps> = ({
  byMateria,
  byTema,
  onCompleteTheme,
  onThemeClick,
  syncing
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [expandedMaterias, setExpandedMaterias] = useState<Set<string>>(new Set());

  const toggleMateria = (materia: string) => {
    setExpandedMaterias(prev => {
      const next = new Set(prev);
      if (next.has(materia)) {
        next.delete(materia);
      } else {
        next.add(materia);
      }
      return next;
    });
  };

  const handleViewPending = (materia: string, tema?: string) => {
    onThemeClick?.(materia, tema || '');
    const params = new URLSearchParams();
    params.set('materia', materia);
    if (tema) params.set('tema', tema);
    params.set('status', 'pending');
    navigate(`/guia-estudos?${params.toString()}`);
  };

  // Animation helpers
  const getAnimationProps = (delay: number) => shouldReduceMotion ? {} : {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay }
  };

  if (byMateria.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            Mapa do Semestre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3" aria-hidden="true">
              📚
            </div>
            <p className="font-medium">Nenhum conteúdo disponível</p>
            <p className="text-sm text-muted-foreground">
              Entre em contato com sua instituição
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          Mapa do Semestre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3" role="list" aria-label="Progresso por matéria">
        {byMateria.map((materia, index) => {
          const isExpanded = expandedMaterias.has(materia.materia);
          const materiaStatus = getTemaStatus(materia.percentage);
          const statusConfig = TEMA_STATUS[materiaStatus];
          const temasForMateria = byTema.filter(t => t.materia === materia.materia);
          const isComplete = materia.percentage === 100;

          return (
            <motion.div
              key={materia.materia}
              {...getAnimationProps(index * 0.05)}
              role="listitem"
            >
              <Collapsible open={isExpanded} onOpenChange={() => toggleMateria(materia.materia)}>
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "w-full p-4 rounded-xl border bg-card cursor-pointer",
                      "hover:bg-muted/50 hover:border-primary/20 transition-all",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isExpanded && "border-primary/30 bg-muted/30"
                    )}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isExpanded}
                    aria-label={`${materia.materia}: ${materia.percentage}% concluído, ${materia.completed} de ${materia.total} aulas`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleMateria(materia.materia);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Expand icon */}
                      <div className="flex-shrink-0" aria-hidden="true">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* Materia info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">
                            {materia.materia}
                          </h4>
                          {isComplete && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-label="Concluído" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={materia.percentage} 
                            className="h-1.5 flex-1" 
                            aria-label={`${materia.percentage}% concluído`}
                          />
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {materia.completed}/{materia.total}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs flex-shrink-0", statusConfig.color)}
                      >
                        {materia.percentage}%
                      </Badge>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                        transition={shouldReduceMotion ? {} : { duration: 0.2 }}
                        className="pl-8 pr-4 py-2 space-y-2"
                        role="list"
                        aria-label={`Temas de ${materia.materia}`}
                      >
                        {temasForMateria.map((tema) => {
                          const temaStatus = getTemaStatus(tema.percentage);
                          const temaStatusConfig = TEMA_STATUS[temaStatus];
                          const isTemaComplete = tema.percentage === 100;

                          return (
                            <div
                              key={`${tema.materia}-${tema.tema}`}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                              role="listitem"
                            >
                              {/* Status icon */}
                              <div className="flex-shrink-0" aria-hidden="true">
                                {isTemaComplete ? (
                                  <Trophy className="h-4 w-4 text-emerald-500" />
                                ) : temaStatus === 'atrasado' ? (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                                )}
                              </div>

                              {/* Tema info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{tema.tema}</p>
                                <p className="text-xs text-muted-foreground">
                                  {tema.completed}/{tema.total} aulas
                                </p>
                              </div>

                              {/* Status + actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge 
                                  variant="secondary"
                                  className={cn("text-xs", temaStatusConfig.color)}
                                >
                                  {temaStatusConfig.label}
                                </Badge>

                                {!isTemaComplete && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewPending(materia.materia, tema.tema);
                                    }}
                                    aria-label={`Ver aulas pendentes de ${tema.tema}`}
                                  >
                                    Ver
                                    <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
                                  </Button>
                                )}

                                {!isTemaComplete && onCompleteTheme && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs focus-visible:ring-2 focus-visible:ring-ring"
                                    disabled={syncing}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCompleteTheme(materia.materia, tema.tema);
                                    }}
                                    aria-label={`Marcar ${tema.tema} como concluído`}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                                    Concluir
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};
