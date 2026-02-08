import React, { useState } from 'react';
import { TrendingUp, Map, BarChart2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Import filter type from index to ensure consistency
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
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  const hasFilteredResults = byMateria.length > 0 || byTema.length > 0;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Weekly Evolution - compact */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" />
          Evolução Semanal
        </h3>
        <WeeklyEvolutionCard
          evolution={weeklyEvolution}
          totalContent={totalContent}
          onChartInteract={onChartInteract}
        />
      </div>

      {/* Coverage Ranking - compact */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Cobertura por Matéria
        </h3>
        <CoverageRankingCard byMateria={byMateria} onMateriaClick={onCoverageClick} />
      </div>

      {/* Semester Map - Collapsible */}
      <Collapsible open={mapOpen} onOpenChange={setMapOpen}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Map className="h-4 w-4 text-primary" />
              Mapa do Semestre
            </h3>
            <div className="flex items-center gap-2">
              <FiltersDrawerMobile
                filters={filters}
                materias={materiasList}
                temas={temasList}
                onFiltersChange={onFiltersChange}
                activeCount={activeFiltersCount}
                totalCount={totalCount}
                filteredCount={filteredCount}
              />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
                  <ChevronDown className={cn(
                    'h-4 w-4 transition-transform',
                    mapOpen && 'rotate-180'
                  )} />
                  {mapOpen ? 'Fechar' : 'Abrir'}
                </Button>
              </CollapsibleTrigger>
            </div>
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
            <div className="pt-2">
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
