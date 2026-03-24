import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, TrendingDown, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { JourneyFunnelData, FunnelStage } from './types';

interface JourneyFunnelChartProps {
  data: JourneyFunnelData | null;
  isLoading: boolean;
}

const STAGE_COLORS = [
  'bg-primary',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-emerald-500',
  'bg-purple-500',
];

const STAGE_GRADIENTS = [
  'from-primary/20 to-primary/5',
  'from-blue-500/20 to-blue-500/5',
  'from-amber-500/20 to-amber-500/5',
  'from-green-500/20 to-green-500/5',
  'from-emerald-500/20 to-emerald-500/5',
  'from-purple-500/20 to-purple-500/5',
];

const FunnelStageBar: React.FC<{
  stage: FunnelStage;
  index: number;
  maxWidth: number;
}> = ({ stage, index, maxWidth }) => {
  const width = Math.max(stage.percentage * (maxWidth / 100), 5);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
            className="relative"
            style={{ transformOrigin: 'left' }}
          >
            <div
              className={`h-12 rounded-lg bg-gradient-to-r ${STAGE_GRADIENTS[index]} border border-border/50 flex items-center justify-between px-4 cursor-pointer hover:shadow-md transition-shadow`}
              style={{ width: `${width}%` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-3 h-3 rounded-full ${STAGE_COLORS[index]}`} />
                <span className="font-medium text-sm truncate">{stage.shortName}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary" className="text-xs">
                  {stage.count}
                </Badge>
                <span className="text-sm font-semibold">{stage.percentage}%</span>
              </div>
            </div>
            
            {/* Dropoff indicator */}
            {stage.dropoff > 0 && index > 0 && (
              <div className="absolute -top-2 right-0 flex items-center gap-1 text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                <TrendingDown className="h-3 w-3" />
                -{stage.dropoff}%
              </div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{stage.name}</p>
            <p className="text-sm text-muted-foreground">{stage.description}</p>
            <div className="flex items-center gap-2 pt-1">
              <Users className="h-3 w-3" />
              <span className="text-sm">{stage.count} usuários</span>
            </div>
            {stage.dropoff > 0 && (
              <p className="text-sm text-red-500">
                {stage.dropoff}% não chegaram nesta etapa
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const JourneyFunnelChart: React.FC<JourneyFunnelChartProps> = ({
  data,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-12"
              style={{ width: `${100 - i * 12}%` }}
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChevronRight className="h-5 w-5 text-primary" />
              Funil da Jornada
            </CardTitle>
            <CardDescription>
              6 estágios do usuário: do primeiro acesso à retenção
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {data.conversionRate}%
            </div>
            <div className="text-xs text-muted-foreground">
              conversão total
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.stages.map((stage, i) => (
            <FunnelStageBar
              key={stage.id}
              stage={stage}
              index={i}
              maxWidth={100}
            />
          ))}
        </div>
        
        {/* Funnel summary */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-muted-foreground">Entrada: </span>
                <span className="font-semibold">{data.stages[0]?.count || 0}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Convertidos: </span>
                <span className="font-semibold text-emerald-500">
                  {data.stages[4]?.count || 0}
                </span>
              </div>
            </div>
            <Badge variant={data.conversionRate >= 10 ? 'default' : 'secondary'}>
              {data.conversionRate >= 10 ? 'Saudável' : 'Atenção'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
