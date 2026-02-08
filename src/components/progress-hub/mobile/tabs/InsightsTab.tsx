import React from 'react';
import { Lightbulb, Flame, Target } from 'lucide-react';
import { ConsistencyCard } from '@/components/progress-hub/ConsistencyCard';
import { DiagnosticsCard } from '@/components/progress-hub/DiagnosticsCard';
import type { MateriaProgress, TemaProgress, ProgressStreak } from '@/types/progressHub';

interface InsightsTabProps {
  byMateria: MateriaProgress[];
  byTema: TemaProgress[];
  streak: ProgressStreak;
  syncing: boolean;
  onGoalChange: (goal: number) => void;
  onDiagnosticClick: (insightType: string, materia: string, tema?: string) => void;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({
  byMateria,
  byTema,
  streak,
  syncing,
  onGoalChange,
  onDiagnosticClick,
}) => {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Consistency Card */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Sua Consistência
        </h3>
        <ConsistencyCard 
          streak={streak} 
          onGoalChange={onGoalChange}
          syncing={syncing}
        />
      </div>

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
