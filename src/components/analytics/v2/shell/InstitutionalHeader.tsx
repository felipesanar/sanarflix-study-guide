import React from 'react';
import type { HeaderSummary } from '@/types/desempenhoV2';

interface Props {
  summary?: HeaderSummary | null;
}

export const InstitutionalHeader: React.FC<Props> = ({ summary }) => {
  const percentText = summary ? `${summary.percentProficientes}%` : '—';
  const faltamText = summary ? `${summary.alunosFaltamMeta}` : '—';

  return (
    <div className="space-y-2.5">
      <span className="inline-flex items-center text-[11px] font-medium tracking-wide uppercase text-muted-foreground bg-muted px-3 py-1 rounded-full">
        Painel Institucional
      </span>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Dashboard ENAMED
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
          <span className="font-semibold text-foreground">{percentText} dos alunos são proficientes.</span>{' '}
          Faltam {faltamText} alunos proficientes para atingir a próxima faixa de conceito.
        </p>
      </div>
    </div>
  );
};
