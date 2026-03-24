import React, { useMemo, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import type { MateriaProgress } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface CoverageRankingCardProps {
  byMateria: MateriaProgress[];
  onMateriaClick?: (materia: string, rank: number, direction: 'low' | 'high') => void;
}

export const CoverageRankingCard: React.FC<CoverageRankingCardProps> = memo(({ 
  byMateria,
  onMateriaClick
}) => {
  const navigate = useNavigate();

  const { leastStudied, mostAdvanced } = useMemo(() => {
    const sorted = [...byMateria].sort((a, b) => a.percentage - b.percentage);
    
    return {
      leastStudied: sorted.filter(m => m.percentage < 50).slice(0, 3),
      mostAdvanced: sorted.filter(m => m.percentage >= 50).reverse().slice(0, 3),
    };
  }, [byMateria]);

  const handleNavigate = useCallback((materia: string, rank: number, direction: 'low' | 'high') => {
    onMateriaClick?.(materia, rank, direction);
    navigate(`/guia-estudos?materia=${encodeURIComponent(materia)}`);
  }, [navigate, onMateriaClick]);

  const handleFocusOnLeast = useCallback(() => {
    if (leastStudied[0]) {
      onMateriaClick?.(leastStudied[0].materia, 1, 'low');
      navigate(`/guia-estudos?materia=${encodeURIComponent(leastStudied[0].materia)}`);
    }
  }, [leastStudied, navigate, onMateriaClick]);

  if (byMateria.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart2 className="h-5 w-5 text-primary" aria-hidden="true" />
            Sua Cobertura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma matéria disponível
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart2 className="h-5 w-5 text-primary" aria-hidden="true" />
          Sua Cobertura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Least Studied Section */}
        {leastStudied.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <span className="font-medium text-muted-foreground">Menos estudado</span>
            </div>
            <div className="space-y-2">
              {leastStudied.map((materia, index) => (
                <motion.button
                  key={materia.materia}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg",
                    "hover:bg-muted/50 transition-colors text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  onClick={() => handleNavigate(materia.materia, index + 1, 'low')}
                  aria-label={`${materia.materia}: ${materia.percentage}% concluído`}
                >
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{materia.materia}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress 
                        value={materia.percentage} 
                        className="h-1.5 flex-1"
                        aria-hidden="true"
                      />
                      <span className={cn(
                        "text-xs font-medium tabular-nums shrink-0",
                        materia.percentage < 30 ? "text-red-500" : "text-amber-500"
                      )}>
                        {materia.percentage}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Most Advanced Section */}
        {mostAdvanced.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span className="font-medium text-muted-foreground">Mais avançado</span>
            </div>
            <div className="space-y-2">
              {mostAdvanced.map((materia, index) => (
                <motion.button
                  key={materia.materia}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg",
                    "hover:bg-muted/50 transition-colors text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                  onClick={() => handleNavigate(materia.materia, index + 1, 'high')}
                  aria-label={`${materia.materia}: ${materia.percentage}% concluído`}
                >
                  <span className="text-xs font-medium text-muted-foreground w-4">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{materia.materia}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress 
                        value={materia.percentage} 
                        className="h-1.5 flex-1"
                        aria-hidden="true"
                      />
                      <span className={cn(
                        "text-xs font-medium tabular-nums shrink-0",
                        materia.percentage === 100 ? "text-emerald-500" : "text-blue-500"
                      )}>
                        {materia.percentage}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {leastStudied.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={handleFocusOnLeast}
          >
            Focar no menos estudado
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

CoverageRankingCard.displayName = 'CoverageRankingCard';
