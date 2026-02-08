import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Play, FileText, ListChecks, Sparkles, 
  Zap, Rocket, ChevronRight, Clock 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { NextAction } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface NextActionsCardProps {
  actions: NextAction[];
  onComplete?: (action: NextAction) => void;
  onActionClick?: (action: NextAction, actionType: 'view' | 'video' | 'pdf' | 'quiz') => void;
}

const ActionTypeConfig = {
  today_focus: {
    icon: Sparkles,
    label: 'Foco de hoje',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  quick_win: {
    icon: Zap,
    label: 'Vitória rápida',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  },
  unlock_progress: {
    icon: Rocket,
    label: 'Destravar',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
  }
};

export const NextActionsCard: React.FC<NextActionsCardProps> = ({ 
  actions,
  onComplete,
  onActionClick
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            Próximos passos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center" role="status">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3" aria-hidden="true">
              🎉
            </div>
            <p className="font-medium">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground">Nenhum conteúdo pendente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleOpenContent = (action: NextAction) => {
    onActionClick?.(action, 'view');
    // Deep link to study guide
    const params = new URLSearchParams();
    if (action.materia) params.set('materia', action.materia);
    if (action.tema) params.set('tema', action.tema);
    if (action.aula) params.set('aula', action.aula);
    navigate(`/guia-estudos?${params.toString()}`);
  };

  const handleOpenLink = (action: NextAction, type: 'video' | 'pdf' | 'quiz', url: string) => {
    onActionClick?.(action, type);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Animation helpers
  const getAnimationProps = (delay: number) => shouldReduceMotion ? {} : {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { delay }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          O que fazer agora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3" role="list" aria-label="Próximas ações recomendadas">
        {actions.slice(0, 3).map((action, index) => {
          const typeConfig = ActionTypeConfig[action.type];
          const TypeIcon = typeConfig.icon;
          const hasVideo = !!action.link_aula;
          const hasPdf = !!action.link_pdf;
          const hasQuiz = !!action.link_quiz;
          const estimatedMinutes = action.estimated_minutes;

          return (
            <motion.div
              key={action.id}
              {...getAnimationProps(index * 0.08)}
              className="group relative"
              role="listitem"
              whileHover={shouldReduceMotion ? {} : { scale: 1.01 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.99 }}
            >
              <div 
                className={cn(
                  "p-4 rounded-xl border bg-card",
                  "hover:bg-muted/50 hover:border-primary/20 hover:shadow-md",
                  "transition-all duration-200 cursor-pointer",
                  "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                )}
                onClick={() => handleOpenContent(action)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenContent(action);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${typeConfig.label}: ${action.aula || action.tema || action.materia}. ${action.reason}`}
              >
                {/* Type badge + duration */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={cn("text-xs", typeConfig.color)}>
                      <TypeIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                      {typeConfig.label}
                    </Badge>
                    {estimatedMinutes && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                        ~{estimatedMinutes} min
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" aria-hidden="true" />
                </div>

                {/* Content info */}
                <h4 className="font-medium text-sm line-clamp-2 mb-1">
                  {action.aula || action.tema || action.materia}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                  {action.reason}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                  {hasVideo && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className={cn(
                        "h-8 sm:h-7 min-w-[44px] sm:min-w-0 text-xs gap-1",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        "transition-all duration-200 hover:shadow-sm"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLink(action, 'video', action.link_aula!);
                      }}
                      aria-label={`Assistir aula: ${action.aula || action.tema}`}
                    >
                      <Play className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden="true" />
                      <span className="hidden sm:inline">Assistir</span>
                    </Button>
                  )}
                  {hasPdf && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className={cn(
                        "h-8 sm:h-7 min-w-[44px] sm:min-w-0 text-xs gap-1",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        "transition-all duration-200 hover:shadow-sm"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLink(action, 'pdf', action.link_pdf!);
                      }}
                      aria-label={`Abrir PDF: ${action.aula || action.tema}`}
                    >
                      <FileText className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden="true" />
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  )}
                  {hasQuiz && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className={cn(
                        "h-8 sm:h-7 min-w-[44px] sm:min-w-0 text-xs gap-1",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        "transition-all duration-200 hover:shadow-sm"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLink(action, 'quiz', action.link_quiz!);
                      }}
                      aria-label={`Fazer quiz: ${action.aula || action.tema}`}
                    >
                      <ListChecks className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden="true" />
                      <span className="hidden sm:inline">Quiz</span>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};
