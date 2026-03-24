import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCcw, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TemaProgress } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface SpacedRevisionCardProps {
  byTema: TemaProgress[];
  onNavigate?: (materia: string, tema: string) => void;
}

interface RevisionSuggestion {
  tema: TemaProgress;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
}

export const SpacedRevisionCard: React.FC<SpacedRevisionCardProps> = ({
  byTema,
  onNavigate,
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Calculate revision suggestions
  const suggestions = useMemo((): RevisionSuggestion[] => {
    const now = new Date();
    const items: RevisionSuggestion[] = [];

    // Filter completed or high-progress temas that haven't been touched recently
    const candidates = byTema.filter(t => 
      t.percentage >= 80 && 
      t.days_inactive !== undefined && 
      t.days_inactive >= 14
    );

    for (const tema of candidates) {
      const daysInactive = tema.days_inactive || 0;
      
      let urgency: RevisionSuggestion['urgency'];
      let reason: string;

      if (daysInactive >= 30) {
        urgency = 'high';
        reason = `Última revisão há ${daysInactive} dias`;
      } else if (daysInactive >= 21) {
        urgency = 'medium';
        reason = `${daysInactive} dias sem estudar`;
      } else {
        urgency = 'low';
        reason = `Revisar para fixar`;
      }

      items.push({ tema, reason, urgency });
    }

    // Sort by urgency and days inactive
    return items
      .sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        }
        return (b.tema.days_inactive || 0) - (a.tema.days_inactive || 0);
      })
      .slice(0, 4);
  }, [byTema]);

  const handleNavigate = (materia: string, tema: string) => {
    onNavigate?.(materia, tema);
    navigate(`/guia-estudos?materia=${encodeURIComponent(materia)}&tema=${encodeURIComponent(tema)}`);
  };

  const getUrgencyConfig = (urgency: RevisionSuggestion['urgency']) => {
    switch (urgency) {
      case 'high':
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          label: 'Urgente'
        };
      case 'medium':
        return {
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          label: 'Revisar'
        };
      case 'low':
        return {
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          label: 'Reforçar'
        };
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCcw className="h-5 w-5 text-primary" aria-hidden="true" />
          Revisão Espaçada
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Temas que você dominou mas não revisou recentemente
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((item, index) => {
          const config = getUrgencyConfig(item.urgency);
          
          return (
            <motion.div
              key={`${item.tema.materia}-${item.tema.tema}`}
              initial={shouldReduceMotion ? {} : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {/* Progress indicator */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {item.tema.percentage}%
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.tema.tema}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">{item.reason}</span>
                </div>
              </div>

              {/* Badge + Action */}
              <Badge variant="secondary" className={cn("text-xs", config.color)}>
                {config.label}
              </Badge>
              
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleNavigate(item.tema.materia, item.tema.tema)}
                aria-label={`Revisar ${item.tema.tema}`}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};
