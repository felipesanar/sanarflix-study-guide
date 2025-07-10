
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, RotateCcw } from 'lucide-react';
import { useStudy } from '@/contexts/StudyContext';

interface StudyFiltersProps {
  selectedDiscipline: string;
  selectedStatus: string;
  onDisciplineChange: (discipline: string) => void;
  onStatusChange: (status: string) => void;
  onReset: () => void;
}

export const StudyFilters: React.FC<StudyFiltersProps> = ({
  selectedDiscipline,
  selectedStatus,
  onDisciplineChange,
  onStatusChange,
  onReset,
}) => {
  const { studyContents } = useStudy();

  // Get unique disciplines
  const disciplines = Array.from(new Set(studyContents.map(content => content.discipline))).sort();

  const hasActiveFilters = selectedDiscipline !== 'all' || selectedStatus !== 'all';

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" />
          Filtros:
        </div>

        <div className="flex gap-3 flex-wrap flex-1">
          <div className="min-w-[180px]">
            <Select value={selectedDiscipline} onValueChange={onDisciplineChange}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Selecionar disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as disciplinas</SelectItem>
                {disciplines.map(discipline => (
                  <SelectItem key={discipline} value={discipline}>
                    {discipline}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <Select value={selectedStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              onClick={onReset}
              variant="outline"
              size="sm"
              className="h-9 px-3 hover:bg-gray-50"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
