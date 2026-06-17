import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sancao?: string | null;
  percentProficientes?: number;
  /** Mostra selo "Institucional" quando há recorte de semestre ativo */
  showInstitutionalBadge?: boolean;
}

export const InstitutionalAlertBanner: React.FC<Props> = ({ sancao, percentProficientes, showInstitutionalBadge }) => {
  if (!sancao) return null;

  return (
    <div className="flex items-center gap-2.5 bg-destructive/8 border border-destructive/15 rounded-lg px-3.5 py-2.5">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <p className="text-xs text-foreground">
        <span className="font-semibold">Sanção regulatória:</span>{' '}
        <span className="text-muted-foreground">
          Com {percentProficientes ?? '—'}% de proficientes — {sancao}.
        </span>
      </p>
      {showInstitutionalBadge && (
        <span
          className="ml-auto shrink-0 text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-background/60 text-muted-foreground border border-border"
          title="Refere-se a todos os alunos da IES, não ao recorte de semestre"
        >
          Institucional
        </span>
      )}
    </div>
  );
};
