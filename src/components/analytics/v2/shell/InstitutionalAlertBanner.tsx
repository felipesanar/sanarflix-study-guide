import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sancao?: string | null;
  percentProficientes?: number;
  /** Conceito previsto da IES com base no % de proficientes do recorte */
  conceitoScoped?: string | null;
}

export const InstitutionalAlertBanner: React.FC<Props> = ({ sancao, percentProficientes, conceitoScoped }) => {
  if (!sancao) return null;

  return (
    <div className="flex items-center gap-2.5 bg-destructive/8 border border-destructive/15 rounded-lg px-3.5 py-2.5">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <p className="text-xs text-foreground">
        <span className="font-semibold">Sanção regulatória:</span>{' '}
        <span className="text-muted-foreground">
          Com {percentProficientes ?? '—'}% de proficientes
          {conceitoScoped ? ` — ${conceitoScoped} previsto` : ''} — {sancao}.
        </span>
      </p>
    </div>
  );
};
