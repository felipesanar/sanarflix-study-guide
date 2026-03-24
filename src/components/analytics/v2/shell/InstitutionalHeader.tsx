import React from 'react';
import type { HeaderSummary } from '@/types/desempenhoV2';

interface Props {
  summary?: HeaderSummary | null;
}

export const InstitutionalHeader: React.FC<Props> = ({ summary }) => {
  const percentText = summary ? `${summary.percentProficientes}%` : '—';
  const faltamText = summary ? `${summary.alunosFaltamMeta}` : '—';

  return (
    <div className="space-y-3">
      <span className="inline-block text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
        Situação atual da instituição
      </span>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Dashboard ENAMED
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-semibold text-foreground">{percentText} dos alunos são proficientes.</span>{' '}
          Faltam {faltamText} alunos proficientes para atingir a próxima faixa de conceito.
        </p>
      </div>
    </div>
  );
};
