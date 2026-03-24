import React from 'react';
import { motion } from 'framer-motion';
import { Grid3X3, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RetentionCohortData } from './types';

interface RetentionCohortGridProps {
  data: RetentionCohortData | null;
  isLoading: boolean;
}

const getRetentionColor = (percentage: number): string => {
  if (percentage >= 70) return 'bg-emerald-500 text-white';
  if (percentage >= 50) return 'bg-emerald-400 text-white';
  if (percentage >= 30) return 'bg-amber-400 text-white';
  if (percentage >= 15) return 'bg-amber-500 text-white';
  return 'bg-red-400 text-white';
};

const getRetentionBgColor = (percentage: number): string => {
  if (percentage >= 70) return 'bg-emerald-500/20';
  if (percentage >= 50) return 'bg-emerald-400/20';
  if (percentage >= 30) return 'bg-amber-400/20';
  if (percentage >= 15) return 'bg-amber-500/20';
  return 'bg-red-400/20';
};

export const RetentionCohortGrid: React.FC<RetentionCohortGridProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.cohorts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            Matriz de Retenção
          </CardTitle>
          <CardDescription>
            Dados insuficientes para gerar cohorts semanais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Aguardando mais dados de sessão para análise de retenção
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxWeeks = Math.max(...data.cohorts.map(c => c.weeks.length));
  const weekHeaders = Array.from({ length: maxWeeks }, (_, i) => `W${i}`);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              Matriz de Retenção
            </CardTitle>
            <CardDescription>
              Retenção semanal por cohort de entrada
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-primary">
                {data.avgRetentionWeek1}%
              </div>
              <div className="text-xs text-muted-foreground">Semana 1</div>
            </div>
            {data.avgRetentionWeek4 > 0 && (
              <div className="text-center">
                <div className="text-xl font-bold text-amber-500">
                  {data.avgRetentionWeek4}%
                </div>
                <div className="text-xs text-muted-foreground">Semana 4</div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-3 text-left text-sm font-medium text-muted-foreground">
                  Cohort
                </th>
                <th className="py-2 px-3 text-center text-sm font-medium text-muted-foreground">
                  Usuários
                </th>
                {weekHeaders.map((week, i) => (
                  <th 
                    key={i} 
                    className="py-2 px-3 text-center text-sm font-medium text-muted-foreground"
                  >
                    {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort, cohortIndex) => (
                <motion.tr
                  key={cohort.cohortDate}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: cohortIndex * 0.05 }}
                  className="border-b last:border-0"
                >
                  <td className="py-2 px-3 text-sm font-medium">
                    {cohort.cohortLabel}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant="outline" className="text-xs">
                      {cohort.initialUsers}
                    </Badge>
                  </td>
                  {weekHeaders.map((_, weekIndex) => {
                    const weekData = cohort.weeks[weekIndex];
                    
                    if (!weekData) {
                      return (
                        <td key={weekIndex} className="py-2 px-3 text-center">
                          <span className="text-muted-foreground">-</span>
                        </td>
                      );
                    }

                    return (
                      <td key={weekIndex} className="py-2 px-3 text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: cohortIndex * 0.05 + weekIndex * 0.02 }}
                                className={`
                                  inline-flex items-center justify-center
                                  w-12 h-8 rounded text-xs font-semibold
                                  ${getRetentionColor(weekData.percentage)}
                                `}
                              >
                                {weekData.percentage}%
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{weekData.retained} de {cohort.initialUsers} usuários</p>
                              <p className="text-xs text-muted-foreground">
                                retornaram na semana {weekIndex}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500" />
            <span>&gt;70%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-400" />
            <span>50-70%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-400" />
            <span>30-50%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500" />
            <span>15-30%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-400" />
            <span>&lt;15%</span>
          </div>
        </div>

        {/* Insight */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
          {data.avgRetentionWeek1 >= 50 ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>Excelente! A maioria dos novos usuários retorna na segunda semana.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <TrendingDown className="h-4 w-4" />
              <span>Atenção: Retenção na semana 1 abaixo de 50%. Considere melhorar a experiência inicial.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
