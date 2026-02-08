import React from 'react';
import { Filter, X, Check, SortAsc } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export type FilterStatus = 'all' | 'pending' | 'completed';
export type SortOption = 'alphabetical' | 'backlog' | 'percentage' | 'inactive';

export interface ProgressFilters {
  status: FilterStatus;
  materia: string | null;
  tema: string | null;
  sortBy: SortOption;
}

interface FiltersDrawerMobileProps {
  filters: ProgressFilters;
  materias: string[];
  temas?: string[];
  onFiltersChange: (filters: ProgressFilters) => void;
  activeCount: number;
  totalCount?: number;
  filteredCount?: number;
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

export const FiltersDrawerMobile: React.FC<FiltersDrawerMobileProps> = ({
  filters,
  materias,
  temas = [],
  onFiltersChange,
  activeCount,
  totalCount,
  filteredCount,
}) => {
  const [open, setOpen] = React.useState(false);
  const [tempFilters, setTempFilters] = React.useState<ProgressFilters>(filters);

  // Sync temp filters when drawer opens
  React.useEffect(() => {
    if (open) {
      setTempFilters(filters);
    }
  }, [open, filters]);

  const handleApply = () => {
    onFiltersChange(tempFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: ProgressFilters = { status: 'all', materia: null, tema: null, sortBy: 'alphabetical' };
    setTempFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    setOpen(false);
  };

  const hasChanges = 
    tempFilters.status !== filters.status || 
    tempFilters.materia !== filters.materia ||
    tempFilters.tema !== filters.tema ||
    tempFilters.sortBy !== filters.sortBy;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Abrir filtros${activeCount > 0 ? `, ${activeCount} ativos` : ''}`}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center justify-between">
            <span>Filtros</span>
            {activeCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClear}
                className="text-muted-foreground text-sm h-8"
              >
                Limpar
              </Button>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {/* Status filter */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTempFilters(prev => ({ ...prev, status: option.value }))}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tempFilters.status === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  aria-pressed={tempFilters.status === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Materia filter */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Matéria</h4>
            <div className="space-y-2">
              <button
                onClick={() => setTempFilters(prev => ({ ...prev, materia: null, tema: null }))}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tempFilters.materia === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
                aria-pressed={tempFilters.materia === null}
              >
                <span>Todas as matérias</span>
                {tempFilters.materia === null && (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              {materias.map((materia) => (
                <button
                  key={materia}
                  onClick={() => setTempFilters(prev => ({ ...prev, materia, tema: null }))}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tempFilters.materia === materia
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  aria-pressed={tempFilters.materia === materia}
                >
                  <span className="truncate">{materia}</span>
                  {tempFilters.materia === materia && (
                    <Check className="h-4 w-4 flex-shrink-0 ml-2" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tema filter (dependent on materia) */}
          {tempFilters.materia && temas.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Tema</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => setTempFilters(prev => ({ ...prev, tema: null }))}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      tempFilters.tema === null
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    aria-pressed={tempFilters.tema === null}
                  >
                    <span>Todos os temas</span>
                    {tempFilters.tema === null && (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  {temas.map((tema) => (
                    <button
                      key={tema}
                      onClick={() => setTempFilters(prev => ({ ...prev, tema }))}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        tempFilters.tema === tema
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                      aria-pressed={tempFilters.tema === tema}
                    >
                      <span className="truncate">{tema}</span>
                      {tempFilters.tema === tema && (
                        <Check className="h-4 w-4 flex-shrink-0 ml-2" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator className="my-4" />

          {/* Sort options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <SortAsc className="h-4 w-4" />
              Ordenar por
            </h4>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTempFilters(prev => ({ ...prev, sortBy: option.value }))}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tempFilters.sortBy === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  aria-pressed={tempFilters.sortBy === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          {totalCount !== undefined && filteredCount !== undefined && (
            <div className="mt-4 pt-4 border-t text-center">
              <Badge variant="secondary" className="font-normal">
                {filteredCount} de {totalCount} itens
              </Badge>
            </div>
          )}
        </ScrollArea>

        <DrawerFooter className="pt-2">
          <Button 
            onClick={handleApply}
            className="w-full focus-visible:ring-2 focus-visible:ring-ring"
            disabled={!hasChanges}
          >
            Aplicar filtros
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full focus-visible:ring-2 focus-visible:ring-ring">
              Cancelar
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
