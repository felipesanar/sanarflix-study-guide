import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BookOpen, Target, AlertTriangle, Lightbulb, BarChart3 } from 'lucide-react';
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
  Legend,
} from 'recharts';
import type { StudyVsPerformanceData } from './types';

interface StudyCorrelationCardProps {
  data: StudyVsPerformanceData | null;
  isLoading: boolean;
}

const getCorrelationLabel = (coef: number): { label: string; color: string } => {
  if (coef >= 0.7) return { label: 'Forte', color: 'text-emerald-500' };
  if (coef >= 0.4) return { label: 'Moderada', color: 'text-amber-500' };
  if (coef >= 0.1) return { label: 'Fraca', color: 'text-orange-500' };
  return { label: 'Sem correlação', color: 'text-muted-foreground' };
};

const getGapBadge = (gap: string): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
  switch (gap) {
    case 'content':
      return { label: 'Gap de Conteúdo', variant: 'destructive' };
    case 'activation':
      return { label: 'Oportunidade', variant: 'secondary' };
    default:
      return { label: 'Balanceado', variant: 'outline' };
  }
};

export const StudyCorrelationCard: React.FC<StudyCorrelationCardProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

  if (!data || !data.hasEnoughData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Correlação Estudo x Desempenho
          </CardTitle>
          <CardDescription>
            Dados insuficientes para análise de correlação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center gap-2">
            <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
            <p>Aguardando dados de estudo e simulados para gerar análise</p>
            <p className="text-xs">São necessários dados de aulas concluídas e respostas em simulados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare radar chart data with dual series
  const radarData = data.areaCorrelation.slice(0, 7).map(area => ({
    area: area.area.length > 12 ? area.area.substring(0, 10) + '...' : area.area,
    fullName: area.area,
    estudo: area.studyPercentage,
    desempenho: area.accuracy,
    gap: area.gap,
  }));

  const correlationInfo = getCorrelationLabel(data.correlationCoefficient);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const areaFull = data.areaCorrelation.find(a => a.area === item.fullName);
      const gapInfo = getGapBadge(item.gap);
      
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
          <p className="font-semibold mb-2">{item.fullName}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estudo:</span>
              <span className="text-primary font-medium">{item.estudo}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desempenho:</span>
              <span className="text-accent-foreground font-medium">{item.desempenho}%</span>
            </div>
            {areaFull && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                  <span>{areaFull.lessonsCompleted} aulas</span>
                  <span>{areaFull.totalAnswers} questões</span>
                </div>
              </>
            )}
            <div className="pt-1">
              <Badge variant={gapInfo.variant} className="text-xs">
                {gapInfo.label}
              </Badge>
            </div>
          </div>
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
              <TrendingUp className="h-5 w-5 text-primary" />
              Correlação Estudo x Desempenho
            </CardTitle>
            <CardDescription>
              Quem estuda mais, acerta mais?
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Coef:</span>
              <span className={`text-2xl font-bold ${correlationInfo.color}`}>
                {data.correlationCoefficient.toFixed(2)}
              </span>
            </div>
            <div className={`text-xs ${correlationInfo.color}`}>{correlationInfo.label}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart Comparativo */}
          {radarData.length > 0 && (
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
                    name="Estudo"
                    dataKey="estudo"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Desempenho"
                    dataKey="desempenho"
                    stroke="hsl(var(--chart-3))"
                    fill="hsl(var(--chart-3))"
                    fillOpacity={0.3}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Faixas de Estudo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Faixas de Estudo</span>
            </div>
            
            <div className="space-y-3 max-h-52 overflow-y-auto pr-2">
              {data.studyBands.map((band, i) => (
                <motion.div
                  key={band.band}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{band.band} aulas</span>
                      <span className="text-xs text-muted-foreground">
                        ({band.userCount} alunos)
                      </span>
                    </div>
                    <Badge 
                      variant={band.avgAccuracy >= 60 ? 'default' : band.avgAccuracy >= 45 ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {band.avgAccuracy}% acurácia
                    </Badge>
                  </div>
                  <Progress 
                    value={band.avgAccuracy} 
                    className="h-1.5"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Insights Automáticos */}
        {data.topInsights.length > 0 && (
          <div className="mt-4 p-4 bg-muted/50 border border-border/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Insights</span>
            </div>
            <div className="space-y-2">
              {data.topInsights.map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-sm text-muted-foreground"
                >
                  {insight}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Gaps Pedagógicos */}
        {data.areaCorrelation.filter(a => a.gap !== 'balanced').length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Content Gaps */}
            {data.areaCorrelation
              .filter(a => a.gap === 'content')
              .slice(0, 2)
              .map(area => (
                <div 
                  key={area.area}
                  className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-sm">Gap de Conteúdo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>{area.area}</strong>: {area.studyPercentage}% estudo, {area.accuracy}% acurácia
                  </p>
                  <p className="text-xs text-destructive mt-1">
                    Revisar qualidade do material
                  </p>
                </div>
              ))}
            
            {/* Activation Opportunities */}
            {data.areaCorrelation
              .filter(a => a.gap === 'activation')
              .slice(0, 2)
              .map(area => (
                <div 
                  key={area.area}
                  className="p-3 bg-warning/10 border border-warning/30 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-warning" />
                    <span className="font-medium text-sm">Oportunidade</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>{area.area}</strong>: {area.studyPercentage}% estudo, {area.accuracy}% acurácia
                  </p>
                  <p className="text-xs text-warning mt-1">
                    Incentivar consumo de aulas
                  </p>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
