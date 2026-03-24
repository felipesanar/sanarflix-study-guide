import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sancao?: string | null;
  percentProficientes?: number;
}

export const InstitutionalAlertBanner: React.FC<Props> = ({ sancao, percentProficientes }) => {
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
    </div>
  );
};
