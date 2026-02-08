import React from 'react';
import { motion } from 'framer-motion';
import { Target, AlertTriangle, TrendingUp, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { LearningVelocityData } from './types';

interface LearningVelocityCardProps {
  data: LearningVelocityData | null;
  isLoading: boolean;
}

const getAccuracyColor = (accuracy: number): string => {
  if (accuracy >= 70) return 'text-emerald-500';
  if (accuracy >= 50) return 'text-amber-500';
  return 'text-red-500';
};

const getAccuracyBadge = (accuracy: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
  if (accuracy >= 70) return { label: 'Excelente', variant: 'default' };
  if (accuracy >= 50) return { label: 'Moderado', variant: 'secondary' };
  return { label: 'Crítico', variant: 'destructive' };
};

export const LearningVelocityCard: React.FC<LearningVelocityCardProps> = ({
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.areaPerformance.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Performance Pedagógica
          </CardTitle>
          <CardDescription>
            Dados de respostas insuficientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Aguardando dados de simulados para análise
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare radar chart data
  const radarData = data.areaPerformance.slice(0, 7).map(area => ({
    area: area.area.length > 15 ? area.area.substring(0, 12) + '...' : area.area,
    accuracy: area.accuracy,
    fullName: area.area,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const areaFull = data.areaPerformance.find(a => a.area === item.fullName || a.area.startsWith(item.area.replace('...', '')));
      
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{item.fullName}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Acurácia: </span>
            <span className={getAccuracyColor(item.accuracy)}>{item.accuracy}%</span>
          </p>
          {areaFull && (
            <>
              <p className="text-sm text-muted-foreground">
                {areaFull.totalResponses} respostas
              </p>
              <p className="text-sm text-muted-foreground">
                {areaFull.uniqueUsers} usuários
              </p>
            </>
          )}
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
              <Target className="h-5 w-5 text-primary" />
              Performance Pedagógica
            </CardTitle>
            <CardDescription>
              Acurácia por Grande Área de conhecimento
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getAccuracyColor(data.overallAccuracy)}`}>
              {data.overallAccuracy}%
            </div>
            <div className="text-xs text-muted-foreground">acurácia geral</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis 
                  dataKey="area" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={{ fontSize: 10 }}
                />
                <Radar
                  name="Acurácia"
                  dataKey="accuracy"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Area List */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {data.areaPerformance.map((area, i) => {
              const badge = getAccuracyBadge(area.accuracy);
              
              return (
                <motion.div
                  key={area.area}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{area.area}</span>
                    </div>
                    <Badge variant={badge.variant} className="text-xs flex-shrink-0">
                      {area.accuracy}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={area.accuracy} 
                      className="h-1.5 flex-1"
                    />
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {area.totalResponses} resp.
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Gaps Alert */}
        {data.gaps.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm">Áreas que precisam de atenção</span>
            </div>
            <div className="space-y-2">
              {data.gaps.map(gap => (
                <div key={gap.area} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{gap.area}</span>
                  <div className="flex items-center gap-2">
                    <span className={getAccuracyColor(gap.accuracy)}>{gap.accuracy}%</span>
                    <Badge 
                      variant={gap.improvement === 'Crítico' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {gap.improvement}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
