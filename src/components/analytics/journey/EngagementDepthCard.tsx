import React from 'react';
import { motion } from 'framer-motion';
import { Layers, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { EngagementDepthData } from './types';

interface EngagementDepthCardProps {
  data: EngagementDepthData | null;
  isLoading: boolean;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

const getHeatmapColor = (value: number, maxValue: number): string => {
  if (maxValue === 0) return 'bg-muted/30';
  const intensity = value / maxValue;
  if (intensity >= 0.8) return 'bg-primary';
  if (intensity >= 0.6) return 'bg-primary/80';
  if (intensity >= 0.4) return 'bg-primary/60';
  if (intensity >= 0.2) return 'bg-primary/40';
  if (intensity > 0) return 'bg-primary/20';
  return 'bg-muted/30';
};

export const EngagementDepthCard: React.FC<EngagementDepthCardProps> = ({
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Calculate max value for heatmap
  const maxHeatmapValue = Math.max(...data.heatmap.map(h => h.value));

  // Group heatmap data by day
  const heatmapByDay = DAYS.map((day, dayIndex) => ({
    day,
    hours: HOURS.map(hour => {
      // Find cells for this hour range
      const cellsInRange = data.heatmap.filter(
        h => h.dayOfWeek === dayIndex && h.hour >= hour && h.hour < hour + 3
      );
      const value = cellsInRange.reduce((sum, c) => sum + c.value, 0);
      return { hour, value };
    }),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{item.bucket}</p>
          <p className="text-sm text-muted-foreground">
            {item.count} sessões ({item.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Profundidade de Engajamento
            </CardTitle>
            <CardDescription>
              Páginas por sessão e horários de pico
            </CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-primary">{data.avgPagesPerSession}</div>
              <div className="text-xs text-muted-foreground">pág/sessão</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-amber-500">{data.avgTimeOnPlatform}min</div>
              <div className="text-xs text-muted-foreground">tempo médio</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session Depth Bar Chart */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Distribuição de Profundidade
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sessionDepth} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis 
                    dataKey="bucket" 
                    type="category" 
                    width={80}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Heatmap */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Horários de Atividade
            </h4>
            <div className="space-y-1">
              {/* Hour headers */}
              <div className="flex items-center gap-1 ml-10">
                {HOURS.map(hour => (
                  <div 
                    key={hour} 
                    className="flex-1 text-center text-xs text-muted-foreground"
                  >
                    {hour}h
                  </div>
                ))}
              </div>
              
              {/* Heatmap rows */}
              {heatmapByDay.map((dayData, dayIndex) => (
                <motion.div
                  key={dayData.day}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: dayIndex * 0.05 }}
                  className="flex items-center gap-1"
                >
                  <div className="w-10 text-xs text-muted-foreground text-right pr-2">
                    {dayData.day}
                  </div>
                  {dayData.hours.map((hourData, hourIndex) => (
                    <div
                      key={hourIndex}
                      className={`flex-1 h-6 rounded ${getHeatmapColor(hourData.value, maxHeatmapValue)} 
                        transition-colors hover:ring-2 hover:ring-primary/50`}
                      title={`${dayData.day} ${hourData.hour}h: ${hourData.value} sessões`}
                    />
                  ))}
                </motion.div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-2 text-xs">
              <span className="text-muted-foreground">Menos</span>
              <div className="flex gap-0.5">
                <div className="w-4 h-4 rounded bg-muted/30" />
                <div className="w-4 h-4 rounded bg-primary/20" />
                <div className="w-4 h-4 rounded bg-primary/40" />
                <div className="w-4 h-4 rounded bg-primary/60" />
                <div className="w-4 h-4 rounded bg-primary/80" />
                <div className="w-4 h-4 rounded bg-primary" />
              </div>
              <span className="text-muted-foreground">Mais</span>
            </div>
          </div>
        </div>

        {/* Peak insight */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>
              <span className="font-medium">Pico de atividade:</span>{' '}
              {data.peakDay} às {data.peakHour}h
            </span>
          </div>
          <Badge variant="outline">
            Melhor horário para notificações
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
