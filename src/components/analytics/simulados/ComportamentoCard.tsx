import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, Eye, Maximize2, Clock, 
  UserX, RotateCcw, TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComportamentoMetrics } from '@/hooks/useSimuladosAnalytics';

interface ComportamentoCardProps {
  metrics: ComportamentoMetrics;
  isLoading?: boolean;
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  status?: 'normal' | 'warning' | 'danger';
}

const MetricRow: React.FC<MetricRowProps> = ({ 
  icon, 
  label, 
  value, 
  subtitle,
  status = 'normal'
}) => {
  const statusColors = {
    normal: 'text-foreground',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-background">
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <div className={cn("text-lg font-bold tabular-nums", statusColors[status])}>
        {value}
      </div>
    </div>
  );
};

export const ComportamentoCard: React.FC<ComportamentoCardProps> = ({ 
  metrics, 
  isLoading 
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Comportamento e Integridade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const saidasAbaStatus = metrics.saidasAbaMedia > 3 ? 'danger' : metrics.saidasAbaMedia > 1.5 ? 'warning' : 'normal';
  const saidasFsStatus = metrics.saidasFullscreenMedia > 2 ? 'danger' : metrics.saidasFullscreenMedia > 1 ? 'warning' : 'normal';
  const abandonoStatus = metrics.abandono.taxaAbandono > 30 ? 'danger' : metrics.abandono.taxaAbandono > 15 ? 'warning' : 'normal';

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Comportamento e Integridade da Prova
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricRow
          icon={<Eye className="w-4 h-4 text-muted-foreground" />}
          label="Saídas de Aba"
          value={`${metrics.saidasAbaMedia.toFixed(1)} (p95: ${metrics.saidasAbaP95})`}
          subtitle="média por prova"
          status={saidasAbaStatus}
        />

        <MetricRow
          icon={<Maximize2 className="w-4 h-4 text-muted-foreground" />}
          label="Saídas de Fullscreen"
          value={`${metrics.saidasFullscreenMedia.toFixed(1)} (p95: ${metrics.saidasFullscreenP95})`}
          subtitle="média por prova"
          status={saidasFsStatus}
        />

        <MetricRow
          icon={<UserX className="w-4 h-4 text-muted-foreground" />}
          label="Taxa de Abandono"
          value={`${metrics.abandono.taxaAbandono}%`}
          subtitle={`${metrics.abandono.totalIniciados - metrics.abandono.totalFinalizados} alunos não concluíram`}
          status={abandonoStatus}
        />

        <MetricRow
          icon={<RotateCcw className="w-4 h-4 text-muted-foreground" />}
          label="Liberados Novamente"
          value={`${metrics.liberadoNovamente.count}`}
          subtitle={`${metrics.liberadoNovamente.percent}% das finalizações`}
        />

        {/* Simulados com fricção alta */}
        {metrics.simuladosComFriccaoAlta.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-sm text-yellow-700 dark:text-yellow-400">
                Atenção: Simulados com Fricção Alta
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {metrics.simuladosComFriccaoAlta.slice(0, 3).map((nome) => (
                <Badge 
                  key={nome} 
                  variant="outline" 
                  className="border-yellow-500/50 text-yellow-700 dark:text-yellow-400"
                >
                  {nome.length > 20 ? nome.slice(0, 20) + '...' : nome}
                </Badge>
              ))}
              {metrics.simuladosComFriccaoAlta.length > 3 && (
                <Badge variant="outline" className="border-yellow-500/50">
                  +{metrics.simuladosComFriccaoAlta.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Interpretação */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <p><strong>Interpretação:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Saídas de aba {'>'} 2: pode indicar consulta externa ou distração</li>
            <li>Saídas de fullscreen {'>'} 1: pode indicar problema técnico</li>
            <li>Abandono {'>'} 30%: revisar duração ou condições do simulado</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
