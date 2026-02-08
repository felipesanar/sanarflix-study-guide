import React from 'react';
import { motion } from 'framer-motion';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { BehavioralSegmentsData } from './types';

interface BehavioralSegmentsProps {
  data: BehavioralSegmentsData | null;
  isLoading: boolean;
}

const SEGMENT_ICONS = {
  power: '🚀',
  regular: '📚',
  occasional: '👋',
  at_risk: '⚠️',
};

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

export const BehavioralSegments: React.FC<BehavioralSegmentsProps> = ({
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const chartData = data.segments.map(s => ({
    name: s.name,
    value: s.count,
    color: s.color,
  }));

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} usuários
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Segmentos Comportamentais
        </CardTitle>
        <CardDescription>
          Classificação automática baseada em frequência de acesso
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Segment List */}
          <div className="space-y-3">
            {data.segments.map((segment, i) => (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {SEGMENT_ICONS[segment.id as keyof typeof SEGMENT_ICONS] || '👤'}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{segment.name}</p>
                      <p className="text-xs text-muted-foreground">{segment.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={segment.trend} />
                    <Badge variant="outline" className="text-xs">
                      {segment.count}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={segment.percentage} 
                    className="h-1.5 flex-1"
                    style={{ ['--progress-background' as string]: segment.color }}
                  />
                  <span className="text-xs font-medium w-10 text-right">
                    {segment.percentage}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Total de usuários ativos: </span>
            <span className="font-semibold">{data.totalUsers}</span>
          </div>
          {data.segments[0]?.percentage >= 20 && (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              {data.segments[0].percentage}% são Power Users
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
