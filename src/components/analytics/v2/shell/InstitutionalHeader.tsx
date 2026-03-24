import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeaderSummary } from '@/types/desempenhoV2';

interface Props {
  summary?: HeaderSummary | null;
}

export const InstitutionalHeader: React.FC<Props> = ({ summary }) => {
  const percent = summary?.percentProficientes ?? 0;
  const hasData = !!summary && summary.totalAlunos > 0;

  const statusConfig = percent >= 60
    ? { label: 'Acima da meta', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', Icon: CheckCircle }
    : percent >= 40
    ? { label: 'Atenção necessária', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', Icon: TrendingUp }
    : { label: 'Situação crítica', color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400', Icon: AlertTriangle };

  return (
    <div className="space-y-1.5">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
        Painel de Desempenho
      </h1>
      {hasData ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{percent}%</span> dos alunos proficientes
            {summary!.alunosFaltamMeta > 0 && (
              <> · faltam <span className="font-semibold text-foreground">{summary!.alunosFaltamMeta}</span> para a próxima faixa</>
            )}
          </p>
          <Badge className={cn('text-[11px] gap-1 border-0', statusConfig.color)}>
            <statusConfig.Icon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Selecione um simulado para visualizar os dados.</p>
      )}
    </div>
  );
};
