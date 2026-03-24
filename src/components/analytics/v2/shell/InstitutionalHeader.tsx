import React from 'react';

export const InstitutionalHeader: React.FC = () => (
  <div className="space-y-3">
    <span className="inline-block text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
      Situação atual da instituição
    </span>
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
        Dashboard ENAMED
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        <span className="font-semibold text-foreground">35% dos alunos são proficientes.</span>{' '}
        Faltam 55 alunos proficientes para atingir Conceito 5 (90%).
      </p>
    </div>
  </div>
);
