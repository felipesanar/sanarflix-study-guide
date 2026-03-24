import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Activity, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TrackingHealth } from '@/hooks/useAnalyticsData';

interface TrackingHealthSectionProps {
  trackingHealth: TrackingHealth[];
  isLoading: boolean;
}

const statusConfig = {
  ok: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-800',
    label: 'OK',
  },
  baixo: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-200 dark:border-yellow-800',
    label: 'Baixo',
  },
  critico: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    label: 'Crítico',
  },
};

const tabelaDescricoes: Record<string, string> = {
  user_sessions: 'Sessões de usuário (login, navegação)',
  page_views: 'Visualizações de página',
  analytics_events: 'Eventos de analytics (cliques, ações)',
  study_progress: 'Progresso de estudo (marcações de conteúdo)',
  aula_views: 'Visualizações de aulas',
  sanarclass_views: 'Visualizações do SanarClass',
};

export const TrackingHealthSection: React.FC<TrackingHealthSectionProps> = ({
  trackingHealth,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticosOuBaixos = trackingHealth.filter(t => t.status !== 'ok');
  const hasCritical = trackingHealth.some(t => t.status === 'critico');

  return (
    <Card className={hasCritical ? 'border-red-200 dark:border-red-800' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Saúde do Tracking
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Monitora o volume de dados coletados por cada tabela de tracking nos últimos 7 dias. Valores baixos podem indicar problemas na coleta de dados.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>

          {criticosOuBaixos.length > 0 && (
            <Badge variant={hasCritical ? 'destructive' : 'secondary'} className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {criticosOuBaixos.length} {hasCritical ? 'problema(s)' : 'alerta(s)'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {trackingHealth.map((item) => {
            const config = statusConfig[item.status];
            const Icon = config.icon;

            return (
              <TooltipProvider key={item.tabela}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-colors hover:opacity-90`}>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                      <div className="text-lg font-bold">{item.ultimos7dias}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.tabela.replace('_', ' ')}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{item.tabela}</p>
                    <p className="text-sm text-muted-foreground">
                      {tabelaDescricoes[item.tabela] || 'Tabela de tracking'}
                    </p>
                    <p className="text-sm mt-1">
                      <strong>{item.ultimos7dias}</strong> registros nos últimos 7 dias
                    </p>
                    {item.status === 'critico' && (
                      <p className="text-sm text-red-500 mt-1">
                        ⚠️ Volume muito baixo - tracking pode estar inativo
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {hasCritical && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-700 dark:text-red-300">
                  Tracking com volume crítico detectado
                </p>
                <p className="text-red-600 dark:text-red-400 mt-1">
                  Algumas tabelas têm menos de 5 registros nos últimos 7 dias. 
                  Verifique se os hooks de tracking estão sendo chamados corretamente nos componentes.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
