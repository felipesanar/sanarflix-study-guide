import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Play, FileText, ListChecks, Sparkles, 
  Zap, Rocket, ChevronRight, ExternalLink 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { NextAction } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface NextActionsCardProps {
  actions: NextAction[];
  onComplete?: (action: NextAction) => void;
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
  onComplete 
}) => {
  const navigate = useNavigate();

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Próximos passos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
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
    // Deep link to study guide
    const params = new URLSearchParams();
    if (action.materia) params.set('materia', action.materia);
    if (action.tema) params.set('tema', action.tema);
    if (action.aula) params.set('aula', action.aula);
    navigate(`/guia-estudos?${params.toString()}`);
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          O que fazer agora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.slice(0, 3).map((action, index) => {
          const typeConfig = ActionTypeConfig[action.type];
          const TypeIcon = typeConfig.icon;
          const hasVideo = !!action.link_aula;
          const hasPdf = !!action.link_pdf;
          const hasQuiz = !!action.link_quiz;

          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
            >
              <div 
                className={cn(
                  "p-4 rounded-xl border bg-card",
                  "hover:bg-muted/50 hover:border-primary/20 transition-all cursor-pointer"
                )}
                onClick={() => handleOpenContent(action)}
              >
                {/* Type badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="secondary" className={cn("text-xs", typeConfig.color)}>
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {typeConfig.label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                {/* Content info */}
                <h4 className="font-medium text-sm line-clamp-2 mb-1">
                  {action.aula || action.tema || action.materia}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                  {action.reason}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {hasVideo && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLink(action.link_aula!);
                      }}
                    >
                      <Play className="h-3 w-3" />
                      Assistir
                    </Button>
                  )}
                  {hasPdf && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLink(action.link_pdf!);
                      }}
                    >
                      <FileText className="h-3 w-3" />
                      PDF
                    </Button>
                  )}
                  {hasQuiz && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLink(action.link_quiz!);
                      }}
                    >
                      <ListChecks className="h-3 w-3" />
                      Quiz
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
