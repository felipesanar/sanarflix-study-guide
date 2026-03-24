import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const InstitutionalAlertBanner: React.FC = () => (
  <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 w-fit">
    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold text-foreground">Sanção regulatória ativa</p>
      <p className="text-xs text-muted-foreground">
        Com 35% de alunos proficientes, há redução de 50% das vagas. Faltam 5 alunos proficientes para sair desta sanção.
      </p>
    </div>
  </div>
);
