import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Search, Building2, X, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyticsFilters as AnalyticsFiltersType } from '@/pages/Analytics';
import { Logger } from '@/utils/logger';

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersType;
  onFilterChange: (filters: Partial<AnalyticsFiltersType>) => void;
}

interface IESOption {
  id: string;
  nome: string;
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  filters,
  onFilterChange
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isIESPopoverOpen, setIsIESPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.searchTerm);
  const [iesList, setIesList] = useState<IESOption[]>([]);
  const [isLoadingIES, setIsLoadingIES] = useState(true);

  useEffect(() => {
    const fetchIES = async () => {
      setIsLoadingIES(true);
      try {
        const { data, error } = await supabase
          .from('ies')
          .select('id, nome')
          .order('nome');

        if (error) {
          Logger.error('[AnalyticsFilters] Erro ao carregar IES:', error);
          return;
        }
        setIesList(data || []);
      } catch (err) {
        Logger.error('[AnalyticsFilters] Erro inesperado:', err);
      } finally {
        setIsLoadingIES(false);
      }
    };

    fetchIES();
  }, []);

  const handleDateRangeChange = (date: Date | undefined, type: 'start' | 'end') => {
    if (date) {
      onFilterChange({
        dateRange: {
          ...filters.dateRange,
          [type]: date
        }
      });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setTimeout(() => {
      onFilterChange({ searchTerm: value });
    }, 500);
  };

  const handleIESSelect = (iesId: string) => {
    onFilterChange({ 
      university: iesId,
      excludedIES: [] 
    });
    setIsIESPopoverOpen(false);
  };

  const handleExclusionToggle = (iesId: string, isChecked: boolean) => {
    const currentExclusions = filters.excludedIES || [];
    let newExclusions: string[];
    
    if (isChecked) {
      newExclusions = [...currentExclusions, iesId];
    } else {
      newExclusions = currentExclusions.filter(id => id !== iesId);
    }
    
    onFilterChange({ 
      excludedIES: newExclusions,
      university: 'all'
    });
  };

  const removeExclusion = (iesId: string) => {
    const newExclusions = (filters.excludedIES || []).filter(id => id !== iesId);
    onFilterChange({ excludedIES: newExclusions });
  };

  const clearFilters = () => {
    setSearchValue('');
    onFilterChange({
      university: 'all',
      excludedIES: [],
      searchTerm: '',
    });
  };

  const isAllIES = !filters.university || filters.university === 'all';
  const hasExclusions = (filters.excludedIES || []).length > 0;
  const hasActiveFilters = (!isAllIES) || hasExclusions || filters.searchTerm;
  const selectedIES = iesList.find(ies => ies.id === filters.university);

  const getIESButtonText = () => {
    if (!isAllIES && selectedIES) {
      return selectedIES.nome;
    }
    if (hasExclusions) {
      return `Todas exceto ${filters.excludedIES!.length}`;
    }
    return 'Todas as IES';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!hasActiveFilters ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
              Todos os dados
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              Filtros ativos
            </Badge>
          )}
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="w-3 h-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal h-10",
                !filters.dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange ? (
                <span className="truncate">
                  {format(filters.dateRange.start, "dd/MM/yy", { locale: ptBR })} - {format(filters.dateRange.end, "dd/MM/yy", { locale: ptBR })}
                </span>
              ) : (
                <span>Selecionar período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col sm:flex-row">
              <div className="p-3">
                <p className="text-sm font-medium mb-2">Data inicial</p>
                <Calendar
                  mode="single"
                  selected={filters.dateRange.start}
                  onSelect={(date) => handleDateRangeChange(date, 'start')}
                  initialFocus
                  className="pointer-events-auto"
                />
              </div>
              <div className="p-3 border-t sm:border-t-0 sm:border-l">
                <p className="text-sm font-medium mb-2">Data final</p>
                <Calendar
                  mode="single"
                  selected={filters.dateRange.end}
                  onSelect={(date) => handleDateRangeChange(date, 'end')}
                  className="pointer-events-auto"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {isLoadingIES ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Popover open={isIESPopoverOpen} onOpenChange={setIsIESPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal h-10",
                  hasExclusions && "border-destructive/50"
                )}
              >
                <Building2 className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{getIESButtonText()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-3 border-b">
                <p className="text-sm font-medium text-muted-foreground">Selecionar IES</p>
              </div>
              
              <ScrollArea className="h-64">
                <div className="p-2">
                  <button
                    onClick={() => handleIESSelect('all')}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      isAllIES && !hasExclusions
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      isAllIES && !hasExclusions ? "border-primary-foreground" : "border-muted-foreground"
                    )}>
                      {isAllIES && !hasExclusions && (
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <span className="font-medium">Todas as IES</span>
                  </button>

                  <Separator className="my-2" />
                  
                  <p className="px-3 py-1 text-xs text-muted-foreground font-medium">Filtrar por IES específica</p>
                  {iesList.map((ies) => (
                    <button
                      key={ies.id}
                      onClick={() => handleIESSelect(ies.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                        filters.university === ies.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        filters.university === ies.id ? "border-primary-foreground" : "border-muted-foreground"
                      )}>
                        {filters.university === ies.id && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <span className="truncate">{ies.nome}</span>
                    </button>
                  ))}

                  <Separator className="my-2" />
                  
                  <div className="px-3 py-1 flex items-center gap-1">
                    <MinusCircle className="w-3 h-3 text-destructive" />
                    <p className="text-xs text-muted-foreground font-medium">Excluir IES da análise</p>
                  </div>
                  <p className="px-3 pb-2 text-xs text-muted-foreground">
                    Marque para ver "Todas EXCETO" as selecionadas
                  </p>
                  
                  {iesList.map((ies) => {
                    const isExcluded = (filters.excludedIES || []).includes(ies.id);
                    return (
                      <label
                        key={`exclude-${ies.id}`}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer",
                          isExcluded 
                            ? "bg-destructive/10 text-destructive" 
                            : "hover:bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={isExcluded}
                          onCheckedChange={(checked) => handleExclusionToggle(ies.id, checked as boolean)}
                          className={cn(
                            isExcluded && "border-destructive data-[state=checked]:bg-destructive"
                          )}
                        />
                        <span className="truncate">{ies.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedIES && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="w-3 h-3" />
              {selectedIES.nome}
              <button 
                onClick={() => onFilterChange({ university: 'all' })}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          
          {(filters.excludedIES || []).map((iesId) => {
            const ies = iesList.find(i => i.id === iesId);
            if (!ies) return null;
            return (
              <Badge 
                key={iesId} 
                variant="outline" 
                className="gap-1 border-destructive/50 bg-destructive/10 text-destructive"
              >
                <MinusCircle className="w-3 h-3" />
                Exceto: {ies.nome}
                <button 
                  onClick={() => removeExclusion(iesId)}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
          
          {filters.searchTerm && (
            <Badge variant="secondary" className="gap-1">
              <Search className="w-3 h-3" />
              "{filters.searchTerm}"
              <button 
                onClick={() => {
                  setSearchValue('');
                  onFilterChange({ searchTerm: '' });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
