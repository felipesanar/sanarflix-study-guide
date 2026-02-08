import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProgressFilters, FilterStatus } from './FiltersDrawerMobile';
import { cn } from '@/lib/utils';

interface FilterChipsProps {
  filters: ProgressFilters;
  onRemoveFilter: (key: keyof ProgressFilters) => void;
  onClearAll: () => void;
  className?: string;
}

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: 'Todos',
  pending: 'Pendentes',
  completed: 'Concluídos',
};

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
  className,
}) => {
  const hasActiveFilters = filters.status !== 'all' || filters.materia !== null;

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div 
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label="Filtros ativos"
    >
      {/* Status chip */}
      {filters.status !== 'all' && (
        <Badge
          variant="secondary"
          className="gap-1 pl-2.5 pr-1.5 py-1 text-xs font-medium cursor-pointer hover:bg-secondary/80 transition-colors"
          onClick={() => onRemoveFilter('status')}
          role="button"
          aria-label={`Remover filtro: ${STATUS_LABELS[filters.status]}`}
        >
          <span>Status: {STATUS_LABELS[filters.status]}</span>
          <X className="h-3 w-3" aria-hidden="true" />
        </Badge>
      )}

      {/* Materia chip */}
      {filters.materia && (
        <Badge
          variant="secondary"
          className="gap-1 pl-2.5 pr-1.5 py-1 text-xs font-medium cursor-pointer hover:bg-secondary/80 transition-colors max-w-[200px]"
          onClick={() => onRemoveFilter('materia')}
          role="button"
          aria-label={`Remover filtro: ${filters.materia}`}
        >
          <span className="truncate">{filters.materia}</span>
          <X className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        </Badge>
      )}

      {/* Clear all */}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded"
      >
        Limpar todos
      </button>
    </div>
  );
};
