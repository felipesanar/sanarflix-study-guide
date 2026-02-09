import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, TrendingUp, Clock, Calendar, 
  AlertTriangle, Target, Zap, Activity 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExecutiveMetrics } from './types';

interface ExecutiveSummaryCardsProps {
  metrics: ExecutiveMetrics | null;
  isLoading: boolean;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  tooltip: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
  delay?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subValue,
  trend,
  tooltip,
  color = 'default',
  delay = 0,
}) => {
  const colorClasses = {
    default: 'text-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };

  const bgClasses = {
    default: 'bg-muted/50',
    success: 'bg-emerald-500/10',
    warning: 'bg-amber-500/10',
    danger: 'bg-red-500/10',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.05, duration: 0.3 }}
          >
            <Card className="hover:shadow-md transition-shadow cursor-help">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${bgClasses[color]}`}>
                    {icon}
                  </div>
                  {trend && (
                    <Badge 
                      variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <p className={`text-2xl font-bold ${colorClasses[color]}`}>
                    {value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
                  {subValue && (
                    <p className="text-xs text-muted-foreground/70 mt-1">{subValue}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ExecutiveSummaryCards: React.FC<ExecutiveSummaryCardsProps> = ({
  metrics,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4">
              <Skeleton className="h-8 w-8 rounded-lg mb-3" />
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const stickinessColor = metrics.stickiness >= 30 ? 'success' : metrics.stickiness >= 15 ? 'warning' : 'danger';
  const activationColor = metrics.activationRate >= 80 ? 'success' : metrics.activationRate >= 50 ? 'warning' : 'danger';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard
        icon={<Users className="h-4 w-4 text-primary" />}
        label="DAU"
        value={metrics.dau}
        subValue={`WAU: ${metrics.wau} | MAU: ${metrics.mau}`}
        tooltip="Daily Active Users - média de alunos únicos por dia nos últimos 30 dias"
        delay={0}
      />
      
      <MetricCard
        icon={<Zap className="h-4 w-4 text-amber-500" />}
        label="Stickiness"
        value={`${metrics.stickiness}%`}
        subValue="DAU/MAU"
        tooltip="Razão entre alunos diários e mensais. Quanto maior, mais engajada a turma."
        color={stickinessColor}
        trend={metrics.stickiness >= 25 ? 'up' : metrics.stickiness >= 15 ? 'neutral' : 'down'}
        delay={1}
      />
      
      <MetricCard
        icon={<Activity className="h-4 w-4 text-blue-500" />}
        label="Profundidade"
        value={`${metrics.avgSessionDepth} pgs`}
        subValue={`${metrics.avgSessionDuration} min/sessão`}
        tooltip="Média de páginas visitadas e tempo por sessão"
        delay={2}
      />
      
      <MetricCard
        icon={<Target className="h-4 w-4 text-emerald-500" />}
        label="Time to Value"
        value={metrics.timeToFirstSimulado !== null ? `${metrics.timeToFirstSimulado}d` : 'N/A'}
        subValue="até 1º simulado"
        tooltip="Tempo médio entre primeiro acesso e conclusão do primeiro simulado"
        color={metrics.timeToFirstSimulado !== null && metrics.timeToFirstSimulado <= 3 ? 'success' : 'default'}
        delay={3}
      />
      
      <MetricCard
        icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
        label="Ativação"
        value={`${metrics.activationRate}%`}
        subValue={`${metrics.neverActiveCount} nunca acessaram`}
        tooltip="Porcentagem de alunos matriculados que já acessaram a plataforma pelo menos uma vez"
        color={activationColor}
        trend={metrics.activationRate >= 70 ? 'up' : metrics.activationRate >= 50 ? 'neutral' : 'down'}
        delay={4}
      />
      
      <MetricCard
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        label="Baixa Atividade"
        value={metrics.lowEngagementCount}
        subValue="alunos (1 visita/14d)"
        tooltip="Alunos que acessaram apenas 1 vez nas últimas 2 semanas - podem precisar de ações de ativação"
        color={metrics.lowEngagementCount <= 5 ? 'success' : metrics.lowEngagementCount <= 20 ? 'warning' : 'danger'}
        delay={5}
      />
    </div>
  );
};
