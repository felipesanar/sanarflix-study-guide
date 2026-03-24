import React from 'react';
import { motion } from 'framer-motion';
import { 
  Lightbulb, AlertTriangle, TrendingUp, 
  Zap, Target, ArrowRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SmartInsight } from './types';

interface SmartInsightsEngineProps {
  insights: SmartInsight[];
  isLoading: boolean;
}

const INSIGHT_ICONS = {
  anomaly: AlertTriangle,
  opportunity: Zap,
  risk: AlertTriangle,
  correlation: TrendingUp,
  positive: Target,
};

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  },
};

const TYPE_LABELS = {
  anomaly: 'Anomalia',
  opportunity: 'Oportunidade',
  risk: 'Atenção',
  correlation: 'Correlação',
  positive: 'Positivo',
};

export const SmartInsightsEngine: React.FC<SmartInsightsEngineProps> = ({
  insights,
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
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Insights Automáticos
          </CardTitle>
          <CardDescription>
            Análise inteligente baseada em padrões de dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Lightbulb className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Nenhum insight significativo detectado no momento
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Os insights serão gerados conforme mais dados forem coletados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by severity (critical first)
  const sortedInsights = [...insights].sort((a, b) => {
    const order = ['critical', 'warning', 'info', 'success'];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Insights Automáticos
            </CardTitle>
            <CardDescription>
              {insights.length} insight{insights.length !== 1 ? 's' : ''} detectado{insights.length !== 1 ? 's' : ''} a partir dos dados
            </CardDescription>
          </div>
          <Badge variant="outline">
            Powered by AI
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedInsights.map((insight, i) => {
            const Icon = INSIGHT_ICONS[insight.type];
            const styles = SEVERITY_STYLES[insight.severity];
            
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-4 rounded-lg border ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${styles.bg}`}>
                    <Icon className={`h-4 w-4 ${styles.icon}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{insight.title}</span>
                      <Badge className={`text-xs ${styles.badge}`}>
                        {TYPE_LABELS[insight.type]}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {insight.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {insight.metric && (
                          <span>
                            <span className="font-medium">{insight.metric}:</span>{' '}
                            {insight.value}
                            {insight.change !== undefined && (
                              <span className={insight.change >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                {' '}({insight.change >= 0 ? '+' : ''}{insight.change}%)
                              </span>
                            )}
                          </span>
                        )}
                        <span className="opacity-50">
                          Fonte: {insight.dataSource}
                        </span>
                      </div>
                      
                      {insight.action && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs h-7 gap-1"
                        >
                          {insight.action}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
