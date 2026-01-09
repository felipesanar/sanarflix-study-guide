import React from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Info, Zap } from 'lucide-react';

interface InsightBoxProps {
  tipo: 'insight' | 'alerta' | 'oportunidade' | 'problema' | 'info';
  titulo: string;
  descricao: string;
  acao?: string;
  valor?: string | number;
}

export const InsightBox: React.FC<InsightBoxProps> = ({
  tipo,
  titulo,
  descricao,
  acao,
  valor,
}) => {
  const styles = {
    insight: {
      container: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
      icon: <Lightbulb className="w-5 h-5 text-blue-600" />,
      titleColor: 'text-blue-900 dark:text-blue-100',
      textColor: 'text-blue-700 dark:text-blue-300',
    },
    alerta: {
      container: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
      titleColor: 'text-yellow-900 dark:text-yellow-100',
      textColor: 'text-yellow-700 dark:text-yellow-300',
    },
    oportunidade: {
      container: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
      icon: <TrendingUp className="w-5 h-5 text-green-600" />,
      titleColor: 'text-green-900 dark:text-green-100',
      textColor: 'text-green-700 dark:text-green-300',
    },
    problema: {
      container: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      icon: <TrendingDown className="w-5 h-5 text-red-600" />,
      titleColor: 'text-red-900 dark:text-red-100',
      textColor: 'text-red-700 dark:text-red-300',
    },
    info: {
      container: 'bg-muted/50 border-muted-foreground/20',
      icon: <Info className="w-5 h-5 text-muted-foreground" />,
      titleColor: 'text-foreground',
      textColor: 'text-muted-foreground',
    },
  };

  const style = styles[tipo];

  return (
    <div className={cn('p-4 rounded-lg border', style.container)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn('font-semibold text-sm', style.titleColor)}>
              {titulo}
            </h4>
            {valor && (
              <span className={cn('text-lg font-bold', style.titleColor)}>
                {valor}
              </span>
            )}
          </div>
          <p className={cn('text-sm mt-1', style.textColor)}>
            {descricao}
          </p>
          {acao && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
              <Zap className="w-3 h-3" />
              <span className={style.textColor}>{acao}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
