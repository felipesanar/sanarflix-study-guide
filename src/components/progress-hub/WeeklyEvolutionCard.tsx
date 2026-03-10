import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart, Percent, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip 
} from 'recharts';
import type { WeeklyEvolution } from '@/types/progressHub';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WeekDetailSheet } from './WeekDetailSheet';

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, viewMode }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  const weekEnd = format(addDays(parseISO(data.weekStart), 6), "dd/MM", { locale: ptBR });
  const weekStart = format(parseISO(data.weekStart), "dd/MM", { locale: ptBR });

  return (
    <div className="rounded-xl border bg-card px-3.5 py-2.5 shadow-lg text-sm space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">
        {weekStart} — {weekEnd}
      </p>
      {viewMode === 'count' ? (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-semibold text-foreground">{data.count} aulas</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-semibold text-foreground">{data.percentage}% concluído</span>
        </div>
      )}
    </div>
  );
};

// --- Active Dot with glow ---
const GlowDot = (props: any) => {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="hsl(var(--primary))" opacity={0.15} />
      <circle cx={cx} cy={cy} r={5} fill="hsl(var(--primary))" opacity={0.3} />
      <circle cx={cx} cy={cy} r={3} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1.5} />
    </g>
  );
};

interface WeeklyEvolutionCardProps {
  evolution: WeeklyEvolution[];
  totalContent?: number;
  onChartInteract?: (weekIndex: number, metric: 'aulas' | '%') => void;
  onViewModeChange?: (mode: 'count' | 'percentage') => void;
}

export const WeeklyEvolutionCard: React.FC<WeeklyEvolutionCardProps> = ({ 
  evolution,
  totalContent = 100,
  onChartInteract,
  onViewModeChange
}) => {
  const [viewMode, setViewMode] = useState<'count' | 'percentage'>('count');
  const [selectedWeek, setSelectedWeek] = useState<{ weekStart: string; count: number } | null>(null);

  // Weeks with actual activity
  const activeWeeks = useMemo(() => evolution.filter(w => w.completed_count > 0), [evolution]);

  // Process data for chart — reverse so oldest is first (left side)
  const chartData = useMemo(() => {
    return evolution
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
  }, [evolution, totalContent]);

  // Stats
  const totalCompleted = useMemo(() => evolution.reduce((sum, w) => sum + w.completed_count, 0), [evolution]);
  const avgPerWeek = activeWeeks.length > 0 ? Math.round(totalCompleted / activeWeeks.length) : 0;
  
  // Trend: compare last 2 weeks with activity data
  const lastWeek = evolution[0]?.completed_count || 0;
  const previousWeek = evolution[1]?.completed_count || 0;
  const hasTrendData = activeWeeks.length >= 2;
  const trend = !hasTrendData ? 'neutral' : lastWeek > previousWeek ? 'up' : lastWeek < previousWeek ? 'down' : 'stable';
  const trendPct = hasTrendData && previousWeek > 0
    ? Math.round(((lastWeek - previousWeek) / previousWeek) * 100)
    : null;

  // Dynamic label
  const weeksLabel = activeWeeks.length <= 1 
    ? 'Esta semana' 
    : `Últimas ${evolution.length} semanas`;

  const handleWeekClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const payload = data.activePayload[0].payload;
      setSelectedWeek({ weekStart: payload.weekStart, count: payload.count });
    }
  };

  const handleViewModeChange = (newMode: 'count' | 'percentage') => {
    setViewMode(newMode);
    onViewModeChange?.(newMode);
  };

  // Empty state
  if (totalCompleted === 0) {
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
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs rounded-md",
                  viewMode === 'count' && "bg-background shadow-sm"
                )}
                onClick={() => handleViewModeChange('count')}
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
                onClick={() => handleViewModeChange('percentage')}
                aria-pressed={viewMode === 'percentage'}
              >
                <Percent className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm mt-1">
            <p className="text-muted-foreground">{weeksLabel}</p>
            <Badge variant="secondary" className="text-xs font-semibold">
              {totalCompleted} aulas
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Screen reader summary */}
          <div className="sr-only" role="region" aria-label="Resumo da evolução semanal">
            Nas últimas {evolution.length} semanas, você completou {totalCompleted} aulas, 
            com média de {avgPerWeek} aulas por semana.
          </div>
          
          <motion.div 
            className="h-48"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            aria-hidden="true"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={chartData} 
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={handleWeekClick}
                style={{ cursor: 'pointer' }}
              >
                <defs>
                  <linearGradient id="colorProgressEvolution" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
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
                <RechartsTooltip 
                  content={<CustomTooltip viewMode={viewMode} />}
                  cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey={viewMode === 'count' ? 'count' : 'percentage'}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorProgressEvolution)"
                  activeDot={<GlowDot />}
                  dot={false}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Stats row — premium pill badges */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold tabular-nums">{avgPerWeek}</p>
              <p className="text-xs text-muted-foreground">média/semana</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-2xl font-bold tabular-nums">{lastWeek}</p>
              <p className="text-xs text-muted-foreground">última semana</p>
            </div>
            <div className="text-center space-y-1">
              {trend === 'up' && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 text-sm font-semibold gap-0.5 px-2">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {trendPct !== null ? `${trendPct}%` : '↑'}
                </Badge>
              )}
              {trend === 'down' && (
                <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-0 text-sm font-semibold gap-0.5 px-2">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  {trendPct !== null ? `${Math.abs(trendPct)}%` : '↓'}
                </Badge>
              )}
              {trend === 'stable' && (
                <Badge className="bg-muted text-muted-foreground border-0 text-sm font-semibold gap-0.5 px-2">
                  <Minus className="h-3.5 w-3.5" />
                  estável
                </Badge>
              )}
              {trend === 'neutral' && (
                <Badge className="bg-muted text-muted-foreground border-0 text-sm font-semibold px-2">
                  —
                </Badge>
              )}
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
