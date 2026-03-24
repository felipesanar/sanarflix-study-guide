import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, ChevronDown, ChevronRight, CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { MateriaProgress, TemaProgress, SubtemaProgress } from '@/types/progressHub';
import { TEMA_STATUS, getTemaStatus } from '@/types/progressHub';
import { cn } from '@/lib/utils';
import { TemaItem } from './TemaItem';

interface SemesterMapCardProps {
  byMateria: MateriaProgress[];
  byTema: TemaProgress[];
  bySubtema: SubtemaProgress[];
  onThemeClick?: (materia: string, tema: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Progress bar color helper based on percentage
const getProgressColor = (pct: number): string => {
  if (pct === 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-emerald-400';
  if (pct >= 30) return 'bg-amber-400';
  if (pct > 0) return 'bg-red-400';
  return 'bg-muted-foreground/25';
};

export const SemesterMapCard: React.FC<SemesterMapCardProps> = ({
  byMateria,
  byTema,
  bySubtema,
  onThemeClick,
  searchQuery: externalSearchQuery,
  onSearchChange,
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [expandedMaterias, setExpandedMaterias] = useState<Set<string>>(new Set());
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;

  // Filter materias and temas by search query
  const { filteredMaterias, filteredTemas, filteredSubtemas } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { 
        filteredMaterias: byMateria, 
        filteredTemas: byTema,
        filteredSubtemas: bySubtema 
      };
    }

    const query = searchQuery.toLowerCase().trim();
    
    const matchingTemas = byTema.filter(
      t => t.tema.toLowerCase().includes(query) || 
           t.materia.toLowerCase().includes(query)
    );
    
    const matchingMateriaNames = new Set([
      ...matchingTemas.map(t => t.materia),
      ...byMateria.filter(m => m.materia.toLowerCase().includes(query)).map(m => m.materia)
    ]);
    
    const filteredMaterias = byMateria.filter(m => matchingMateriaNames.has(m.materia));
    const filteredTemas = byTema.filter(t => matchingMateriaNames.has(t.materia));
    const filteredSubtemas = bySubtema.filter(s => matchingMateriaNames.has(s.materia));
    
    return { filteredMaterias, filteredTemas, filteredSubtemas };
  }, [byMateria, byTema, bySubtema, searchQuery]);

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

  const getAnimationProps = (delay: number) => shouldReduceMotion ? {} : {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.25 }
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
      <CardContent className="space-y-2 pt-0 px-3 sm:px-6" role="list" aria-label="Progresso por matéria">
      
        {filteredMaterias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
            <p className="text-sm text-muted-foreground">
              Nenhum resultado para "{searchQuery}"
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-2"
            >
              Limpar busca
            </Button>
          </div>
        ) : (
          filteredMaterias.map((materia, index) => {
            const isExpanded = expandedMaterias.has(materia.materia);
            const materiaStatus = getTemaStatus(materia.percentage);
            const statusConfig = TEMA_STATUS[materiaStatus];
            const temasForMateria = filteredTemas.filter(t => t.materia === materia.materia);
            const isComplete = materia.percentage === 100;
            const progressColor = getProgressColor(materia.percentage);

            return (
              <motion.div
                key={materia.materia}
                {...getAnimationProps(index * 0.03)}
                role="listitem"
              >
                <Collapsible open={isExpanded} onOpenChange={() => toggleMateria(materia.materia)}>
                  <CollapsibleTrigger asChild>
                    <motion.div
                      className={cn(
                        "w-full p-3.5 sm:p-4 rounded-xl border bg-card cursor-pointer",
                        "active:bg-muted/60 hover:bg-muted/50 hover:border-primary/20",
                        "transition-all duration-200",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isExpanded && "border-primary/30 bg-muted/30 shadow-sm"
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
                      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Expand icon */}
                        <div className="flex-shrink-0" aria-hidden="true">
                          <ChevronRight className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )} />
                        </div>

                        {/* Materia info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="font-medium text-sm truncate">
                              {materia.materia}
                            </h4>
                            {isComplete && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-label="Concluído" />
                            )}
                          </div>
                          <div className="flex items-center gap-2.5">
                            {/* Custom colored progress bar */}
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                                style={{ width: `${materia.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                              {materia.completed}/{materia.total}
                            </span>
                          </div>
                        </div>

                        {/* Percentage badge */}
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs flex-shrink-0 font-semibold tabular-nums min-w-[3rem] justify-center",
                            statusConfig.color
                          )}
                        >
                          {materia.percentage}%
                        </Badge>
                      </div>
                    </motion.div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                          transition={shouldReduceMotion ? {} : { duration: 0.2 }}
                          className="pl-6 sm:pl-8 pr-2 sm:pr-4 py-2 space-y-1.5"
                          role="list"
                          aria-label={`Temas de ${materia.materia}`}
                        >
                          {temasForMateria.map((tema) => {
                            const subtemasForTema = filteredSubtemas.filter(
                              s => s.materia === tema.materia && s.tema === tema.tema
                            );
                            
                            return (
                              <TemaItem
                                key={`${tema.materia}-${tema.tema}`}
                                tema={tema}
                                subtemas={subtemasForTema}
                                onThemeClick={onThemeClick}
                              />
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CollapsibleContent>
                </Collapsible>
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
