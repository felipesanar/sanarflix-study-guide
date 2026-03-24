import React from 'react';
import { GraduationCap } from 'lucide-react';
import { ExamTrackerCard } from '@/components/progress-hub/ExamTrackerCard';
import type { MateriaProgress } from '@/types/progressHub';

interface ProvasTabProps {
  byMateria: MateriaProgress[];
  materiasList: string[];
  onExamAdded: (materia: string, daysUntil: number) => void;
  onExamRemoved: (examId: string, daysUntil: number) => void;
  onExamClicked: (examId: string, source: string) => void;
}

export const ProvasTab: React.FC<ProvasTabProps> = ({
  byMateria,
  materiasList,
  onExamAdded,
  onExamRemoved,
  onExamClicked,
}) => {
  return (
    <div className="px-4 py-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-primary" />
        Suas Provas
      </h3>
      
      {/* Full exam tracker - not compact on mobile */}
      <ExamTrackerCard
        byMateria={byMateria}
        materiasList={materiasList}
        compact={false}
        onExamAdded={onExamAdded}
        onExamRemoved={onExamRemoved}
        onExamClicked={onExamClicked}
      />
    </div>
  );
};
