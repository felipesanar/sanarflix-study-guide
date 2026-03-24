import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sancao?: string | null;
  percentProficientes?: number;
}

export const InstitutionalAlertBanner: React.FC<Props> = ({ sancao, percentProficientes }) => {
  if (!sancao) return null;

  return (
    <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 w-fit">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Sanção regulatória ativa</p>
        <p className="text-xs text-muted-foreground">
          Com {percentProficientes ?? '—'}% de alunos proficientes: {sancao}.
        </p>
      </div>
    </div>
  );
};
