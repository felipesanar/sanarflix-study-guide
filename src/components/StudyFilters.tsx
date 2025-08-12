
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
  // Optional controls for week/day when provided by parent
  selectedWeek?: string;
  selectedDay?: string;
  onWeekChange?: (week: string) => void;
  onDayChange?: (day: string) => void;
}

export const StudyFilters: React.FC<StudyFiltersProps> = ({
  selectedDiscipline,
  selectedStatus,
  onDisciplineChange,
  onStatusChange,
  onReset,
  selectedWeek,
  selectedDay,
  onWeekChange,
  onDayChange,
}) => {
  const { studyContents } = useStudy();

  // Get unique disciplines
  const disciplines = Array.from(new Set(studyContents.map(content => content.discipline))).sort();

  // Weeks and days derived from studyContents (supports 'semana'/'week' and 'dia'/'day')
  const weeks = Array.from(
    new Set(
      (studyContents as any[])
        .map((c: any) => c?.semana ?? c?.week)
        .filter(Boolean)
    )
  ).sort();

  const hasSelectedWeek = !!selectedWeek && selectedWeek !== 'all';

  const days = hasSelectedWeek
    ? Array.from(
        new Set(
          (studyContents as any[])
            .filter((c: any) => (c?.semana ?? c?.week) === selectedWeek)
            .map((c: any) => c?.dia ?? c?.day)
            .filter(Boolean)
        )
      ).sort()
    : [];

  const hasActiveFilters =
    hasSelectedWeek || (!!selectedDay && selectedDay !== 'all') ||
    selectedDiscipline !== 'all' || selectedStatus !== 'all';

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-input mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4" />
          Filtros:
        </div>

        <div className="flex gap-3 flex-wrap flex-1">
          {/* Semana */}
          {onWeekChange && (
            <div className="min-w-[160px]">
              <Select value={selectedWeek ?? 'all'} onValueChange={onWeekChange}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue placeholder="Selecionar semana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as semanas</SelectItem>
                  {weeks.map((week) => (
                    <SelectItem key={String(week)} value={String(week)}>
                      {String(week)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dia - aparece somente após selecionar semana */}
          {onDayChange && hasSelectedWeek && (
            <div className="min-w-[140px]">
              <Select value={selectedDay ?? 'all'} onValueChange={onDayChange}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue placeholder="Selecionar dia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os dias</SelectItem>
                  {days.map((day) => (
                    <SelectItem key={String(day)} value={String(day)}>
                      {String(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Disciplina */}
          <div className="min-w-[180px]">
            <Select value={selectedDiscipline} onValueChange={onDisciplineChange}>
              <SelectTrigger className="h-9 bg-card">
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

          {/* Status */}
          <div className="min-w-[160px]">
            <Select value={selectedStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="h-9 bg-card">
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
              className="h-9 px-3 hover:bg-accent/20"
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
