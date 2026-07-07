import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { X, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
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
  availableSemestres?: FilterOption[];
  usingMock?: boolean;
  /** True quando os dados estão sendo atualizados em segundo plano (refetch com dado presente). */
  isRefreshing?: boolean;
}

const MultiSelectFilter: React.FC<{
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  alwaysShow?: boolean;
}> = ({ label, options, selected, onChange, alwaysShow }) => {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  if (options.length === 0 && !alwaysShow) return null;

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
          {options.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma opção disponível.
            </div>
          ) : (
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
          )}
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

const BASE_MODE_OPTIONS = [
  { id: 'sixth-year', label: 'Padrão (6º ano)' },
  { id: 'general', label: 'Geral' },
  { id: 'semestres', label: 'Por semestre' },
] as const;

export const GlobalFilterBar: React.FC<Props> = ({
  filters,
  onFilterChange,
  onClearFilters,
  simulados,
  iesList,
  availableSemestres = [],
  usingMock,
  isRefreshing,
}) => {
  const activeCount = countActiveFilters(filters);
  const extraActiveCount = activeCount - (filters.iesId ? 1 : 0) - (filters.simuladoId ? 1 : 0);
  const noSimuladosAvailable = simulados.length === 0;

  const semestreLabel = (id: string) =>
    availableSemestres.find((s) => s.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        {/* Simulado */}
        <Select
          value={filters.simuladoId || 'none'}
          onValueChange={(v) => onFilterChange('simuladoId', v === 'none' ? '' : v)}
          disabled={noSimuladosAvailable}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-8 text-xs bg-background border-border/60">
            <SelectValue placeholder="Selecione um simulado" />
          </SelectTrigger>
          <SelectContent>
            {simulados.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Separator */}
        <div className="h-5 w-px bg-border/60 hidden sm:block" />

        {/* Modo de base — 3 modos mutuamente exclusivos */}
        <div className="inline-flex items-center rounded-md border border-border/60 bg-background p-0.5">
          {BASE_MODE_OPTIONS.map((opt) => {
            const active = (filters.baseMode ?? 'sixth-year') === opt.id;
            const showSpinner = active && isRefreshing;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFilterChange('baseMode', opt.id)}
                className={`h-7 px-2.5 text-xs rounded-[4px] transition-colors inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
                {showSpinner && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </button>
            );
          })}
        </div>

        {/* Multi-select de semestres — visível só no modo "Por semestre" */}
        {filters.baseMode === 'semestres' && (
          <MultiSelectFilter
            label={filters.semestres.length === 0 ? 'Selecionar semestres' : 'Semestres'}
            options={availableSemestres}
            selected={filters.semestres}
            onChange={(v) => onFilterChange('semestres', v)}
            alwaysShow
          />
        )}

        {extraActiveCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                onClick={onClearFilters}
              >
                <RotateCcw className="h-3 w-3" />
                Limpar filtros ({extraActiveCount})
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Não altera IES e simulado
            </TooltipContent>
          </Tooltip>
        )}

        {usingMock && (
          <Badge variant="outline" className="h-6 text-[10px] border-dashed text-muted-foreground">
            Demo
          </Badge>
        )}
      </div>

      {/* Aviso fora do combo quando a IES ativa não tem simulados */}
      {noSimuladosAvailable && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>Esta IES ainda não tem simulados aplicados.</span>
          {iesList.length > 1 && <span className="text-muted-foreground/70">Tente trocar de IES na sidebar.</span>}
        </div>
      )}

      {/* Chips dos filtros secundários ativos — só quando houver algum */}
      {filters.baseMode === 'semestres' && filters.semestres.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.semestres.map((sem) => (
            <Badge
              key={sem}
              variant="secondary"
              className="h-6 gap-1 pl-2 pr-1 text-[11px] font-normal"
            >
              {semestreLabel(sem)}
              <button
                type="button"
                onClick={() => onFilterChange('semestres', filters.semestres.filter((s) => s !== sem))}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                aria-label={`Remover filtro ${semestreLabel(sem)}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
