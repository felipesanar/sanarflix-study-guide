import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import type { WeeklyEvolution } from '@/types/progressHub';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyEvolutionCardProps {
  evolution: WeeklyEvolution[];
}

export const WeeklyEvolutionCard: React.FC<WeeklyEvolutionCardProps> = ({ evolution }) => {
  // Process data for chart
  const chartData = evolution
    .slice()
    .reverse()
    .map(item => ({
      week: format(parseISO(item.week_start), "'Sem' d/M", { locale: ptBR }),
      weekFull: format(parseISO(item.week_start), "dd/MM", { locale: ptBR }),
      count: item.completed_count
    }));

  // Calculate stats
  const totalThisMonth = evolution.reduce((sum, w) => sum + w.completed_count, 0);
  const avgPerWeek = evolution.length > 0 
    ? Math.round(totalThisMonth / evolution.length) 
    : 0;
  
  // Trend: compare last 2 weeks
  const lastWeek = evolution[0]?.completed_count || 0;
  const previousWeek = evolution[1]?.completed_count || 0;
  const trend = lastWeek > previousWeek ? 'up' : lastWeek < previousWeek ? 'down' : 'stable';

  if (evolution.length === 0) {
    return (
      <Card>
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução Semanal
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-muted-foreground">Últimas 8 semanas</p>
              <p className="font-semibold">{totalThisMonth} aulas</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div 
          className="h-48"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value} aulas`, 'Concluídas']}
              />
              <Area
                type="monotone"
                dataKey="count"
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
            <p className={`text-2xl font-bold ${
              trend === 'up' ? 'text-emerald-500' : 
              trend === 'down' ? 'text-red-500' : 
              'text-muted-foreground'
            }`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </p>
            <p className="text-xs text-muted-foreground">tendência</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
