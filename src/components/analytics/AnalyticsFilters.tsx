import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Search, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AnalyticsFilters as AnalyticsFiltersType } from '@/pages/Analytics';

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersType;
  onFilterChange: (filters: Partial<AnalyticsFiltersType>) => void;
}

const courses = [
  { value: '', label: 'Todos os cursos' },
  { value: 'medicina', label: 'Medicina' },
  { value: 'enfermagem', label: 'Enfermagem' },
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'psicologia', label: 'Psicologia' },
  { value: 'fisioterapia', label: 'Fisioterapia' }
];

const universities = [
  { value: '', label: 'Todas as universidades' },
  { value: 'usp', label: 'USP' },
  { value: 'unifesp', label: 'UNIFESP' },
  { value: 'unicamp', label: 'UNICAMP' },
  { value: 'uscs', label: 'USCS' },
  { value: 'puc', label: 'PUC-SP' }
];

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  filters,
  onFilterChange
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.searchTerm);

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

  const hasActiveFilters = filters.course || filters.university || filters.searchTerm;

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      {!hasActiveFilters && (
        <div className="flex justify-center">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Todos os dados
          </Badge>
        </div>
      )}

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date Range Picker */}
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !filters.dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange ? (
                <span>
                  {format(filters.dateRange.start, "dd/MM", { locale: ptBR })} - {format(filters.dateRange.end, "dd/MM", { locale: ptBR })}
                </span>
              ) : (
                <span>Selecionar período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
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
              <div className="p-3 border-l">
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

        {/* Course Filter */}
        <Select value={filters.course} onValueChange={(value) => onFilterChange({ course: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar curso" />
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.value} value={course.value}>
                {course.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* University Filter */}
        <Select value={filters.university} onValueChange={(value) => onFilterChange({ university: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar universidade" />
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectTrigger>
          <SelectContent>
            {universities.map((university) => (
              <SelectItem key={university.value} value={university.value}>
                {university.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário ou item"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
};