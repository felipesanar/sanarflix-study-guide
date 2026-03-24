import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Database, X, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DesempenhoV2Filters, SimuladoOption, IesOption } from '@/types/desempenhoV2';
import { countActiveFilters } from '@/types/desempenhoV2';

interface FilterOption {
  id: string;
  label: string;
}

interface Props {
  filters: DesempenhoV2Filters;
  onFilterChange: <K extends keyof DesempenhoV2Filters>(key: K, value: DesempenhoV2Filters[K]) => void;
  onClearFilters: () => void;
  simulados: SimuladoOption[];
  iesList: IesOption[];
  availableAreas?: FilterOption[];
  availableEspecialidades?: FilterOption[];
  availableSemestres?: FilterOption[];
  availableTemas?: FilterOption[];
  usingMock?: boolean;
}

// Multi-select popover component
const MultiSelectFilter: React.FC<{
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}> = ({ label, options, selected, onChange }) => {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 border-dashed bg-background/70">
          <Filter className="h-3 w-3" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <ScrollArea className="max-h-60">
          <div className="p-2 space-y-1">
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma opção disponível</p>
            )}
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selected.includes(opt.id)}
                  onCheckedChange={() => toggle(opt.id)}
                />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

// Active filter chip
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <Badge variant="secondary" className="gap-1 text-xs pl-2 pr-1 py-0.5 h-6 rounded-md">
    {label}
    <button
      type="button"
      onClick={onRemove}
      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
      aria-label={`Remover filtro: ${label}`}
    >
      <X className="h-3 w-3" />
    </button>
  </Badge>
);

export const GlobalFilterBar: React.FC<Props> = ({
  filters,
  onFilterChange,
  onClearFilters,
  simulados,
  iesList,
  availableAreas = [],
  availableEspecialidades = [],
  availableSemestres = [],
  availableTemas = [],
  usingMock,
}) => {
  const activeCount = countActiveFilters(filters);
  // Don't count simuladoId and iesId in the "extra filters" chip count since they're always visible
  const extraActiveCount = activeCount - (filters.iesId ? 1 : 0) - (filters.simuladoId ? 1 : 0);

  // Build active filter chips for visual feedback
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.iesId) {
    const ies = iesList.find((i) => i.id === filters.iesId);
    activeChips.push({
      key: 'ies',
      label: `IES: ${ies?.nome ?? filters.iesId}`,
      onRemove: () => onFilterChange('iesId', ''),
    });
  }

  filters.areas.forEach((areaId) => {
    const area = availableAreas.find((a) => a.id === areaId);
    activeChips.push({
      key: `area-${areaId}`,
      label: `Área: ${area?.label ?? areaId}`,
      onRemove: () => onFilterChange('areas', filters.areas.filter((a) => a !== areaId)),
    });
  });

  filters.especialidades.forEach((espId) => {
    const esp = availableEspecialidades.find((e) => e.id === espId);
    activeChips.push({
      key: `esp-${espId}`,
      label: `Esp: ${esp?.label ?? espId}`,
      onRemove: () => onFilterChange('especialidades', filters.especialidades.filter((e) => e !== espId)),
    });
  });

  filters.semestres.forEach((sem) => {
    activeChips.push({
      key: `sem-${sem}`,
      label: `Sem: ${sem}`,
      onRemove: () => onFilterChange('semestres', filters.semestres.filter((s) => s !== sem)),
    });
  });

  filters.temas.forEach((temaId) => {
    const tema = availableTemas.find((option) => option.id === temaId);
    activeChips.push({
      key: `tema-${temaId}`,
      label: `Tema: ${tema?.label ?? temaId}`,
      onRemove: () => onFilterChange('temas', filters.temas.filter((value) => value !== temaId)),
    });
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Filtros Globais</p>
        {extraActiveCount > 0 && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {extraActiveCount} refinamento(s)
          </Badge>
        )}
      </div>

      {/* Primary filters row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {usingMock && (
          <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground border-dashed h-6">
            <Database className="h-3 w-3" />
            Dados demo
          </Badge>
        )}

        {iesList.length > 0 && (
          <Select
            value={filters.iesId || 'all'}
            onValueChange={(v) => onFilterChange('iesId', v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs bg-background/80">
              <SelectValue placeholder="Todas as IES" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as IES</SelectItem>
              {iesList.map((ies) => (
                <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filters.simuladoId || 'none'}
          onValueChange={(v) => onFilterChange('simuladoId', v === 'none' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-[210px] h-9 text-xs bg-background/80">
            <SelectValue placeholder="Selecione um simulado" />
          </SelectTrigger>
          <SelectContent>
            {simulados.length === 0 ? (
              <SelectItem value="none" disabled>Nenhum simulado disponível</SelectItem>
            ) : (
              simulados.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Multi-select filters */}
        {availableAreas.length > 0 && (
          <MultiSelectFilter
            label="Áreas"
            options={availableAreas}
            selected={filters.areas}
            onChange={(v) => onFilterChange('areas', v)}
          />
        )}

        {availableEspecialidades.length > 0 && (
          <MultiSelectFilter
            label="Especialidades"
            options={availableEspecialidades}
            selected={filters.especialidades}
            onChange={(v) => onFilterChange('especialidades', v)}
          />
        )}

        {availableSemestres.length > 0 && (
          <MultiSelectFilter
            label="Semestres"
            options={availableSemestres}
            selected={filters.semestres}
            onChange={(v) => onFilterChange('semestres', v)}
          />
        )}

        {availableTemas.length > 0 && (
          <MultiSelectFilter
            label="Temas"
            options={availableTemas}
            selected={filters.temas}
            onChange={(v) => onFilterChange('temas', v)}
          />
        )}

        {/* Clear all button */}
        {extraActiveCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1 border border-transparent hover:border-border"
            onClick={onClearFilters}
          >
            <X className="h-3 w-3" />
            Limpar filtros
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
              {extraActiveCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Active filter chips row */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed bg-muted/20 px-2 py-2">
          <span className="text-[11px] text-muted-foreground mr-1">Recorte ativo:</span>
          {activeChips.map((chip) => (
            <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}
    </div>
  );
};
