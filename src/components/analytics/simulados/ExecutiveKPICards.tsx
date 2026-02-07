import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileText, Users, CheckCircle2, Target, Clock, AlertTriangle, 
  RotateCcw, TrendingUp, TrendingDown, Info, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecutiveKPIs } from '@/hooks/useSimuladosAnalytics';

interface ExecutiveKPICardsProps {
  kpis: ExecutiveKPIs;
  isLoading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle: string;
  tooltip: string;
  icon: React.ReactNode;
  status?: 'positive' | 'negative' | 'neutral' | 'warning';
  delta?: number | null;
  sample?: number;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  tooltip,
  icon,
  status = 'neutral',
  delta,
  sample,
}) => {
  const statusColors = {
    positive: 'border-l-green-500',
    negative: 'border-l-red-500',
    warning: 'border-l-yellow-500',
    neutral: 'border-l-primary',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn(
            'border-l-4 transition-all hover:shadow-md cursor-help',
            statusColors[status]
          )}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg bg-muted/50">
                  {icon}
                </div>
                {delta !== null && delta !== undefined && (
                  <div className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'
                  )}>
                    {delta > 0 ? <TrendingUp className="w-3 h-3" /> : 
                     delta < 0 ? <TrendingDown className="w-3 h-3" /> : 
                     <Minus className="w-3 h-3" />}
                    {delta > 0 ? '+' : ''}{delta}%
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {title}
              </p>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p>{tooltip}</p>
          {sample !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">Base: {sample.toLocaleString('pt-BR')} registros</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ExecutiveKPICards: React.FC<ExecutiveKPICardsProps> = ({ kpis, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-muted/30" />
        ))}
      </div>
    );
  }

  const taxaStatus = kpis.taxaConclusao >= 75 ? 'positive' : kpis.taxaConclusao >= 50 ? 'warning' : 'negative';
  const acuraciaStatus = kpis.acuraciaMedia >= 70 ? 'positive' : kpis.acuraciaMedia >= 50 ? 'warning' : 'negative';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard
        title="Simulados Ativos"
        value={kpis.simuladosAtivos}
        subtitle="no período selecionado"
        tooltip="Quantidade de simulados com status 'ativo' no período"
        icon={<FileText className="w-4 h-4 text-primary" />}
      />

      <KPICard
        title="Alunos Iniciaram"
        value={kpis.alunosIniciaram.toLocaleString('pt-BR')}
        subtitle="usuários únicos"
        tooltip="Quantidade de alunos distintos que iniciaram pelo menos um simulado no período"
        icon={<Users className="w-4 h-4 text-primary" />}
        sample={kpis.alunosIniciaram}
      />

      <KPICard
        title="Alunos Concluíram"
        value={kpis.alunosConcluiram.toLocaleString('pt-BR')}
        subtitle="usuários únicos"
        tooltip="Quantidade de alunos distintos que finalizaram pelo menos um simulado no período"
        icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
        sample={kpis.alunosConcluiram}
      />

      <KPICard
        title="Taxa de Conclusão"
        value={`${kpis.taxaConclusao}%`}
        subtitle="concluintes / iniciantes"
        tooltip="Percentual de alunos que concluíram os simulados que iniciaram. Acima de 75% é considerado bom."
        icon={<Target className="w-4 h-4 text-primary" />}
        status={taxaStatus}
        delta={kpis.deltaConclusaoPeriodoAnterior}
      />

      <KPICard
        title="Acurácia Média"
        value={kpis.totalRespostas > 0 ? `${kpis.acuraciaMedia}%` : '—'}
        subtitle={kpis.totalRespostas > 0 ? 'taxa de acertos' : 'sem respostas no recorte'}
        tooltip={
          kpis.totalRespostas > 0
            ? 'Média geral de acertos em todas as questões respondidas. Acima de 70% indica bom desempenho.'
            : 'Sem respostas registradas para este recorte (período/IES/semestre). Ajuste os filtros para visualizar a acurácia.'
        }
        icon={<Target className="w-4 h-4 text-primary" />}
        status={acuraciaStatus}
        sample={kpis.totalRespostas}
      />

      <KPICard
        title="Tempo Mediano"
        value={`${kpis.tempoMedianoMinutos} min`}
        subtitle={`média: ${kpis.tempoMedioMinutos} min`}
        tooltip="Tempo mediano (p50) para completar os simulados. A mediana é mais robusta a outliers que a média."
        icon={<Clock className="w-4 h-4 text-primary" />}
      />

      <KPICard
        title="Fricção (Saídas)"
        value={`${kpis.saidasAbaMediana.toFixed(1)} / ${kpis.saidasFullscreenMediana.toFixed(1)}`}
        subtitle="aba / fullscreen (mediana)"
        tooltip="Mediana de saídas de aba e fullscreen durante as provas. Valores altos podem indicar problemas de foco ou técnicos."
        icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
        status={kpis.saidasAbaMediana > 2 ? 'warning' : 'neutral'}
      />

      <KPICard
        title="Tentativas"
        value={kpis.tentativasMedia.toFixed(1)}
        subtitle={`${kpis.percentLiberadoNovamente}% liberados novamente`}
        tooltip="Média de tentativas por aluno. Se maior que 1, indica que simulados foram liberados novamente para refazer."
        icon={<RotateCcw className="w-4 h-4 text-primary" />}
      />
    </div>
  );
};
