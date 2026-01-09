import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MetricCardProps {
  titulo: string;
  valor: string | number;
  subtitulo: string;
  interpretacao: string;
  status: 'positivo' | 'negativo' | 'neutro' | 'alerta';
  icon: React.ReactNode;
  tendencia?: {
    valor: number;
    periodo: string;
  };
  dataIndisponivel?: boolean;
  motivoIndisponivel?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  titulo,
  valor,
  subtitulo,
  interpretacao,
  status,
  icon,
  tendencia,
  dataIndisponivel,
  motivoIndisponivel,
}) => {
  const statusStyles = {
    positivo: 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20',
    negativo: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
    neutro: 'border-l-muted-foreground bg-muted/30',
    alerta: 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20',
  };

  const StatusIcon = status === 'positivo' ? CheckCircle : 
                    status === 'negativo' ? AlertTriangle :
                    status === 'alerta' ? AlertTriangle : Info;

  const statusIconColor = {
    positivo: 'text-green-600',
    negativo: 'text-red-600',
    neutro: 'text-muted-foreground',
    alerta: 'text-yellow-600',
  };

  if (dataIndisponivel) {
    return (
      <Card className="border-l-4 border-l-muted border-dashed opacity-70">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{motivoIndisponivel || 'Dados ainda não disponíveis'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
          <div className="text-xl font-bold text-muted-foreground mt-1">—</div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            {motivoIndisponivel || 'Coletando dados...'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-l-4 transition-all hover:shadow-md', statusStyles[status])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-lg bg-background/80">{icon}</div>
          {tendencia && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium',
              tendencia.valor > 0 ? 'text-green-600' : 
              tendencia.valor < 0 ? 'text-red-600' : 'text-muted-foreground'
            )}>
              {tendencia.valor > 0 ? <TrendingUp className="w-3 h-3" /> : 
               tendencia.valor < 0 ? <TrendingDown className="w-3 h-3" /> : 
               <Minus className="w-3 h-3" />}
              {tendencia.valor > 0 ? '+' : ''}{tendencia.valor}% {tendencia.periodo}
            </div>
          )}
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">{titulo}</h3>
        <div className="text-2xl font-bold mt-1">{valor}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>

        {/* Interpretação */}
        <div className={cn(
          'mt-3 pt-3 border-t border-dashed flex items-start gap-2',
        )}>
          <StatusIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', statusIconColor[status])} />
          <p className="text-xs text-foreground/80 leading-relaxed">
            {interpretacao}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
