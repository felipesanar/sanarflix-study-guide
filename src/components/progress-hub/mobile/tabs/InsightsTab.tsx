import React from 'react';
import { Target } from 'lucide-react';
import { DiagnosticsCard } from '@/components/progress-hub/DiagnosticsCard';
import type { MateriaProgress, TemaProgress } from '@/types/progressHub';

interface InsightsTabProps {
  byMateria: MateriaProgress[];
  byTema: TemaProgress[];
  onDiagnosticClick: (insightType: string, materia: string, tema?: string) => void;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({
  byMateria,
  byTema,
  onDiagnosticClick,
}) => {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Diagnostics */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Diagnóstico
        </h3>
        <DiagnosticsCard 
          byMateria={byMateria}
          byTema={byTema}
          onInsightClick={onDiagnosticClick}
        />
      </div>
    </div>
  );
};
