import React, { useMemo } from 'react';
import { Check, ChevronsUpDown, Search, SortAsc, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ProgressFilters, FilterStatus, SortOption } from './FiltersDrawerMobile';

interface FiltersDesktopProps {
  filters: ProgressFilters;
  materias: string[];
  temas: string[];
  onFiltersChange: (filters: ProgressFilters) => void;
  totalCount: number;
  filteredCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'completed', label: 'Concluídos' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'alphabetical', label: 'A-Z' },
  { value: 'backlog', label: 'Maior backlog' },
  { value: 'percentage', label: 'Menor %' },
  { value: 'inactive', label: 'Mais atrasado' },
];

export const FiltersDesktop: React.FC<FiltersDesktopProps> = ({
  filters,
  materias,
  temas,
  onFiltersChange,
  totalCount,
  filteredCount,
  searchQuery = '',
  onSearchChange,
}) => {
  const [materiaOpen, setMateriaOpen] = React.useState(false);
  const [temaOpen, setTemaOpen] = React.useState(false);

  const hasActiveFilters = useMemo(() => 
    filters.status !== 'all' || 
    filters.materia !== null || 
    filters.tema !== null ||
    filters.sortBy !== 'alphabetical',
    [filters]
  );

  const handleMateriaChange = (value: string | null) => {
    onFiltersChange({
      ...filters,
      materia: value,
      tema: null, // Reset tema when materia changes
    });
    setMateriaOpen(false);
  };

  const handleTemaChange = (value: string | null) => {
    onFiltersChange({
      ...filters,
      tema: value,
    });
    setTemaOpen(false);
  };

  const handleStatusChange = (value: FilterStatus) => {
    onFiltersChange({
      ...filters,
      status: value,
    });
  };

  const handleSortChange = (value: SortOption) => {
    onFiltersChange({
      ...filters,
      sortBy: value,
    });
  };

  const handleClearAll = () => {
    onFiltersChange({
      status: 'all',
      materia: null,
      tema: null,
      sortBy: 'alphabetical',
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Matéria Combobox */}
        <Popover open={materiaOpen} onOpenChange={setMateriaOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={materiaOpen}
              aria-label="Selecionar matéria"
              className="justify-between min-w-[180px] max-w-[240px]"
            >
              <span className="truncate">
                {filters.materia || 'Matéria'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar matéria..." />
              <CommandList>
                <CommandEmpty>Nenhuma matéria encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => handleMateriaChange(null)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        filters.materia === null ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Todas as matérias
                  </CommandItem>
                  {materias.map((materia) => (
                    <CommandItem
                      key={materia}
                      value={materia}
                      onSelect={() => handleMateriaChange(materia)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          filters.materia === materia ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{materia}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Tema Combobox (dependente de matéria) */}
        <Popover open={temaOpen} onOpenChange={setTemaOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={temaOpen}
              aria-label="Selecionar tema"
              disabled={!filters.materia}
              className={cn(
                "justify-between min-w-[160px] max-w-[220px]",
                !filters.materia && "opacity-50"
              )}
            >
              <span className="truncate">
                {filters.tema || 'Tema'}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar tema..." />
              <CommandList>
                <CommandEmpty>Nenhum tema encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => handleTemaChange(null)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        filters.tema === null ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Todos os temas
                  </CommandItem>
                  {temas.map((tema) => (
                    <CommandItem
                      key={tema}
                      value={tema}
                      onSelect={() => handleTemaChange(tema)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          filters.tema === tema ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{tema}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Status Select */}
        <Select value={filters.status} onValueChange={handleStatusChange}>
          <SelectTrigger 
            className="w-[130px]" 
            aria-label="Filtrar por status"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort Select */}
        <Select value={filters.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger 
            className="w-[150px]" 
            aria-label="Ordenar por"
          >
            <SortAsc className="h-4 w-4 mr-2 opacity-50" />
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-muted-foreground hover:text-foreground h-9"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}

        {/* Search Input */}
        {onSearchChange && (
          <div className="ml-auto relative">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" 
              aria-hidden="true" 
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar matéria ou tema..."
              className="pl-9 pr-9 h-9 text-sm w-64"
              aria-label="Buscar no mapa do semestre"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
