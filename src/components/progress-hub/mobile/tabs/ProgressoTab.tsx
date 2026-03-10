import React, { useState } from 'react';
import { TrendingUp, Map, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeeklyEvolutionCard } from '@/components/progress-hub/WeeklyEvolutionCard';
import { CoverageRankingCard } from '@/components/progress-hub/CoverageRankingCard';
import { SemesterMapCard } from '@/components/progress-hub/SemesterMapCard';
import { FiltersDrawerMobile } from '@/components/progress-hub/FiltersDrawerMobile';
import { FilterChips } from '@/components/progress-hub/FilterChips';
import { EmptyState } from '@/components/progress-hub/EmptyState';
import type { MateriaProgress, TemaProgress, SubtemaProgress, WeeklyEvolution } from '@/types/progressHub';

type ProgressFilters = {
  status: 'all' | 'pending' | 'completed';
  materia: string | null;
  tema: string | null;
  sortBy: 'alphabetical' | 'backlog' | 'percentage' | 'inactive';
};

interface ProgressoTabProps {
  weeklyEvolution: WeeklyEvolution[];
  totalContent: number;
  byMateria: MateriaProgress[];
  byTema: TemaProgress[];
  bySubtema: SubtemaProgress[];
  filters: ProgressFilters;
  materiasList: string[];
  temasList: string[];
  activeFiltersCount: number;
  totalCount: number;
  filteredCount: number;
  onFiltersChange: (filters: ProgressFilters) => void;
  onRemoveFilter: (key: keyof ProgressFilters) => void;
  onClearFilters: () => void;
  onChartInteract: (weekIndex: number, metric: 'aulas' | '%') => void;
  onThemeClick: (materia: string, tema: string) => void;
  onCoverageClick: (materia: string, rank: number, direction: 'low' | 'high') => void;
}

export const ProgressoTab: React.FC<ProgressoTabProps> = ({
  weeklyEvolution,
  totalContent,
  byMateria,
  byTema,
  bySubtema,
  filters,
  materiasList,
  temasList,
  activeFiltersCount,
  totalCount,
  filteredCount,
  onFiltersChange,
  onRemoveFilter,
  onClearFilters,
  onChartInteract,
  onThemeClick,
  onCoverageClick,
}) => {
  const [mapOpen, setMapOpen] = useState(true);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  const hasFilteredResults = byMateria.length > 0 || byTema.length > 0;

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Weekly Evolution */}
      <WeeklyEvolutionCard
        evolution={weeklyEvolution}
        totalContent={totalContent}
        onChartInteract={onChartInteract}
      />

      {/* Coverage Ranking */}
      <CoverageRankingCard byMateria={byMateria} onMateriaClick={onCoverageClick} />

      {/* Semester Map - Collapsible */}
      <Collapsible open={mapOpen} onOpenChange={setMapOpen}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-semibold text-foreground active:opacity-70 transition-opacity">
                <Map className="h-4 w-4 text-primary" />
                Mapa do Semestre
                <ChevronDown className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  mapOpen && 'rotate-180'
                )} />
              </button>
            </CollapsibleTrigger>
            <FiltersDrawerMobile
              filters={filters}
              materias={materiasList}
              temas={temasList}
              onFiltersChange={onFiltersChange}
              activeCount={activeFiltersCount}
              totalCount={totalCount}
              filteredCount={filteredCount}
            />
          </div>

          {/* Active filter chips */}
          {activeFiltersCount > 0 && (
            <FilterChips
              filters={filters}
              onRemoveFilter={onRemoveFilter}
              onClearAll={onClearFilters}
            />
          )}

          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="pt-1">
              {hasFilteredResults ? (
                <SemesterMapCard
                  byMateria={byMateria}
                  byTema={byTema}
                  bySubtema={bySubtema}
                  onThemeClick={onThemeClick}
                  searchQuery={mapSearchQuery}
                  onSearchChange={setMapSearchQuery}
                />
              ) : (
                <EmptyState onClearFilters={onClearFilters} />
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};
