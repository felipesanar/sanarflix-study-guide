import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Search, Building2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyticsFilters as AnalyticsFiltersType } from '@/pages/Analytics';

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
  const [searchValue, setSearchValue] = useState(filters.searchTerm);
  const [iesList, setIesList] = useState<IESOption[]>([]);
  const [isLoadingIES, setIsLoadingIES] = useState(true);

  // Carregar IES dinamicamente do Supabase
  useEffect(() => {
    const fetchIES = async () => {
      setIsLoadingIES(true);
      console.log('[AnalyticsFilters] Carregando lista de IES...');
      
      try {
        const { data, error } = await supabase
          .from('ies')
          .select('id, nome')
          .order('nome');

        if (error) {
          console.error('[AnalyticsFilters] Erro ao carregar IES:', error);
          return;
        }

        console.log('[AnalyticsFilters] IES carregadas:', data?.length);
        setIesList(data || []);
      } catch (err) {
        console.error('[AnalyticsFilters] Erro inesperado:', err);
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
    // Debounce search
    setTimeout(() => {
      onFilterChange({ searchTerm: value });
    }, 500);
  };

  const handleIESChange = (value: string) => {
    console.log('[AnalyticsFilters] IES selecionada:', value);
    onFilterChange({ university: value });
  };

  const clearFilters = () => {
    setSearchValue('');
    onFilterChange({
      university: 'all',
      searchTerm: '',
    });
  };

  const hasActiveFilters = (filters.university && filters.university !== 'all') || filters.searchTerm;
  const selectedIES = iesList.find(ies => ies.id === filters.university);

  return (
    <div className="space-y-4">
      {/* Status Badge */}
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

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Range Picker */}
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

        {/* IES Filter - Carregado dinamicamente */}
        {isLoadingIES ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select value={filters.university || 'all'} onValueChange={handleIESChange}>
            <SelectTrigger className="h-10">
              <div className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecionar IES">
                  {selectedIES ? selectedIES.nome : 'Todas as IES'}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-medium">Todas as IES</span>
              </SelectItem>
              {iesList.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  Nenhuma IES encontrada
                </div>
              ) : (
                iesList.map((ies) => (
                  <SelectItem key={ies.id} value={ies.id}>
                    {ies.nome}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {/* Search */}
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

      {/* Active Filters Summary */}
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
