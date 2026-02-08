import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ChevronRight, CheckCircle2, 
  AlertCircle, Trophy, ExternalLink, BookMarked
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { TemaProgress, SubtemaProgress } from '@/types/progressHub';
import { TEMA_STATUS, getTemaStatus } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface TemaItemProps {
  tema: TemaProgress;
  subtemas: SubtemaProgress[];
  onCompleteTheme?: (materia: string, tema: string) => void;
  onThemeClick?: (materia: string, tema: string) => void;
  syncing?: boolean;
}

export const TemaItem: React.FC<TemaItemProps> = ({
  tema,
  subtemas,
  onCompleteTheme,
  onThemeClick,
  syncing
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const temaStatus = getTemaStatus(tema.percentage);
  const temaStatusConfig = TEMA_STATUS[temaStatus];
  const isTemaComplete = tema.percentage === 100;
  const hasSubtemas = subtemas.length > 0;

  const handleViewPending = () => {
    onThemeClick?.(tema.materia, tema.tema);
    const params = new URLSearchParams();
    params.set('materia', tema.materia);
    params.set('tema', tema.tema);
    params.set('status', 'pending');
    navigate(`/guia-estudos?${params.toString()}`);
  };

  const handleCompleteTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCompleteTheme?.(tema.materia, tema.tema);
  };

  // If no subtemas, render simple row
  if (!hasSubtemas) {
    return (
      <div
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
              onClick={handleViewPending}
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
              onClick={handleCompleteTheme}
              aria-label={`Marcar ${tema.tema} como concluído`}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
              Concluir
            </Button>
          )}
        </div>
      </div>
    );
  }

  // With subtemas, render expandable
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isExpanded && "bg-muted/50"
          )}
          tabIndex={0}
          role="button"
          aria-expanded={isExpanded}
          aria-label={`${tema.tema}: ${tema.percentage}% concluído, ${subtemas.length} subtemas`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {/* Expand icon */}
          <div className="flex-shrink-0" aria-hidden="true">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Tema info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium truncate">{tema.tema}</p>
              {isTemaComplete && (
                <Trophy className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-label="Concluído" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Progress 
                value={tema.percentage} 
                className="h-1 flex-1 max-w-24" 
                aria-label={`${tema.percentage}% concluído`}
              />
              <span className="text-xs text-muted-foreground">
                {tema.completed}/{tema.total}
              </span>
            </div>
          </div>

          {/* Status + actions */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge 
              variant="secondary"
              className={cn("text-xs", temaStatusConfig.color)}
            >
              {tema.percentage}%
            </Badge>

            {!isTemaComplete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewPending();
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
                onClick={handleCompleteTheme}
                aria-label={`Marcar ${tema.tema} como concluído`}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                Concluir
              </Button>
            )}
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
              className="pl-8 pr-2 py-1 space-y-1"
              role="list"
              aria-label={`Subtemas de ${tema.tema}`}
            >
              {subtemas.map((subtema) => {
                const subtemaStatus = getTemaStatus(subtema.percentage);
                const subtemaStatusConfig = TEMA_STATUS[subtemaStatus];
                const isSubtemaComplete = subtema.percentage === 100;

                return (
                  <div
                    key={`${subtema.materia}-${subtema.tema}-${subtema.subtema}`}
                    className="flex items-center gap-2 p-2 rounded-md bg-background/50 hover:bg-background/80 transition-colors"
                    role="listitem"
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0" aria-hidden="true">
                      {isSubtemaComplete ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Subtema info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{subtema.subtema}</p>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {subtema.completed}/{subtema.total}
                      </span>
                      <Badge 
                        variant="outline"
                        className={cn("text-xs px-1.5 py-0", subtemaStatusConfig.color)}
                      >
                        {subtema.percentage}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};
