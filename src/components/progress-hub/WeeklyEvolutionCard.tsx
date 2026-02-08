import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import type { WeeklyEvolution } from '@/types/progressHub';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WeekDetailSheet } from './WeekDetailSheet';

interface WeeklyEvolutionCardProps {
  evolution: WeeklyEvolution[];
  totalContent?: number;
}

export const WeeklyEvolutionCard: React.FC<WeeklyEvolutionCardProps> = ({ 
  evolution,
  totalContent = 100
}) => {
  const [viewMode, setViewMode] = useState<'count' | 'percentage'>('count');
  const [selectedWeek, setSelectedWeek] = useState<{ weekStart: string; count: number } | null>(null);

  // Process data for chart
  const chartData = evolution
    .slice()
    .reverse()
    .reduce((acc, item, index) => {
      const prevAccumulated = index > 0 ? acc[index - 1].accumulated : 0;
      const accumulated = prevAccumulated + item.completed_count;
      const percentage = totalContent > 0 ? Math.round((accumulated / totalContent) * 100) : 0;
      
      acc.push({
        week: format(parseISO(item.week_start), "'Sem' d/M", { locale: ptBR }),
        weekFull: format(parseISO(item.week_start), "dd/MM", { locale: ptBR }),
        weekStart: item.week_start,
        count: item.completed_count,
        accumulated,
        percentage: Math.min(percentage, 100),
      });
      return acc;
    }, [] as { week: string; weekFull: string; weekStart: string; count: number; accumulated: number; percentage: number }[]);

  // Calculate stats
  const totalThisMonth = evolution.reduce((sum, w) => sum + w.completed_count, 0);
  const avgPerWeek = evolution.length > 0 
    ? Math.round(totalThisMonth / evolution.length) 
    : 0;
  
  // Trend: compare last 2 weeks
  const lastWeek = evolution[0]?.completed_count || 0;
  const previousWeek = evolution[1]?.completed_count || 0;
  const trend = lastWeek > previousWeek ? 'up' : lastWeek < previousWeek ? 'down' : 'stable';

  const handleWeekClick = (data: any) => {
    if (data && data.weekStart) {
      setSelectedWeek({ weekStart: data.weekStart, count: data.count });
    }
  };

  if (evolution.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              📈
            </div>
            <p className="font-medium">Sem dados ainda</p>
            <p className="text-sm text-muted-foreground">
              Complete algumas aulas para ver sua evolução
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
              Evolução Semanal
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs rounded-md",
                    viewMode === 'count' && "bg-background shadow-sm"
                  )}
                  onClick={() => setViewMode('count')}
                  aria-pressed={viewMode === 'count'}
                >
                  <BarChart className="h-3.5 w-3.5 mr-1" />
                  Aulas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs rounded-md",
                    viewMode === 'percentage' && "bg-background shadow-sm"
                  )}
                  onClick={() => setViewMode('percentage')}
                  aria-pressed={viewMode === 'percentage'}
                >
                  <Percent className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm mt-2">
            <div className="text-right">
              <p className="text-muted-foreground">Últimas 8 semanas</p>
              <p className="font-semibold">{totalThisMonth} aulas</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Screen reader summary */}
          <div className="sr-only" role="region" aria-label="Resumo da evolução semanal">
            Nas últimas {evolution.length} semanas, você completou {totalThisMonth} aulas, 
            com média de {avgPerWeek} aulas por semana. 
            {trend === 'up' && 'Sua tendência está em alta.'}
            {trend === 'down' && 'Sua tendência está em baixa.'}
            {trend === 'stable' && 'Sua tendência está estável.'}
          </div>
          
          <motion.div 
            className="h-48"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            aria-hidden="true"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e) => e?.activePayload?.[0] && handleWeekClick(e.activePayload[0].payload)}
                style={{ cursor: 'pointer' }}
              >
                <defs>
                  <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis 
                  dataKey="weekFull" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  allowDecimals={false}
                  domain={viewMode === 'percentage' ? [0, 100] : undefined}
                  tickFormatter={viewMode === 'percentage' ? (v) => `${v}%` : undefined}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [
                    viewMode === 'count' 
                      ? `${value} aulas` 
                      : `${value}% do conteúdo`,
                    viewMode === 'count' ? 'Concluídas' : 'Progresso'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={viewMode === 'count' ? 'count' : 'percentage'}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProgress)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{avgPerWeek}</p>
              <p className="text-xs text-muted-foreground">média/semana</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{lastWeek}</p>
              <p className="text-xs text-muted-foreground">última semana</p>
            </div>
            <div className="text-center">
              <p className={cn(
                "text-2xl font-bold",
                trend === 'up' && "text-emerald-600 dark:text-emerald-400",
                trend === 'down' && "text-red-600 dark:text-red-400",
                trend === 'stable' && "text-muted-foreground"
              )}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
              </p>
              <p className="text-xs text-muted-foreground">tendência</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week Detail Sheet */}
      <WeekDetailSheet
        open={selectedWeek !== null}
        onOpenChange={(open) => !open && setSelectedWeek(null)}
        weekStart={selectedWeek?.weekStart || null}
        completedCount={selectedWeek?.count || 0}
      />
    </>
  );
};
