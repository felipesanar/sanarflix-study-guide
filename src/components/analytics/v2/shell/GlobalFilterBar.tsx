import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Filter, RotateCcw } from 'lucide-react';
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

  if (options.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 px-2.5"
        >
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-4 w-4 p-0 text-[10px] rounded-full flex items-center justify-center">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-medium text-foreground">{label}</p>
        </div>
        <div className="h-64 overflow-y-auto overscroll-contain">
          <div className="p-1.5 space-y-0.5">
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selected.includes(opt.id)}
                  onCheckedChange={() => toggle(opt.id)}
                />
                <span className="truncate text-xs">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        {selected.length > 0 && (
          <div className="border-t p-1.5">
            <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => onChange([])}>
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

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
  const extraActiveCount = activeCount - (filters.iesId ? 1 : 0) - (filters.simuladoId ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Primary selects */}
      {iesList.length > 1 && (
        <Select
          value={filters.iesId || 'all'}
          onValueChange={(v) => onFilterChange('iesId', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs bg-background border-border/60">
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
        <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs bg-background border-border/60">
          <SelectValue placeholder="Selecione um simulado" />
        </SelectTrigger>
        <SelectContent>
          {simulados.length === 0 ? (
            <SelectItem value="none" disabled>Nenhum disponível</SelectItem>
          ) : (
            simulados.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Separator */}
      {availableSemestres.length > 0 && (
        <div className="h-5 w-px bg-border/60 hidden sm:block" />
      )}

      {/* Multi-selects as text buttons */}
      <MultiSelectFilter label="Semestres" options={availableSemestres} selected={filters.semestres} onChange={(v) => onFilterChange('semestres', v)} />

      {/* Conceito Geral toggle — força base geral no card de Conceito/Distância/Sanção */}
      <Button
        variant={filters.conceitoGeral ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 text-xs gap-1.5 px-2.5"
        onClick={() => onFilterChange('conceitoGeral', !filters.conceitoGeral)}
        title="Quando ativo, o card de Conceito (e Distância/Sanção) usa o valor geral da IES em vez do 6º ano"
      >
        Conceito Geral
        {filters.conceitoGeral && (
          <Badge variant="default" className="h-4 px-1 text-[10px] rounded-sm">ON</Badge>
        )}
      </Button>

      {extraActiveCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
          onClick={onClearFilters}
        >
          <RotateCcw className="h-3 w-3" />
          Limpar ({extraActiveCount})
        </Button>
      )}

      {usingMock && (
        <Badge variant="outline" className="h-6 text-[10px] border-dashed text-muted-foreground">
          Demo
        </Badge>
      )}
    </div>
  );
};
