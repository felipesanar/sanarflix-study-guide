import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DesempenhoV2Filters } from '@/types/desempenhoV2';

interface Props {
  filters: DesempenhoV2Filters;
  onFilterChange: <K extends keyof DesempenhoV2Filters>(key: K, value: DesempenhoV2Filters[K]) => void;
}

export const GlobalFilterBar: React.FC<Props> = ({ filters, onFilterChange }) => (
  <div className="flex flex-wrap items-center gap-2">
    <Select value={filters.iesId} onValueChange={(v) => onFilterChange('iesId', v)}>
      <SelectTrigger className="w-[120px] h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="b2b">B2B</SelectItem>
      </SelectContent>
    </Select>
    <Select value={filters.simuladoId} onValueChange={(v) => onFilterChange('simuladoId', v)}>
      <SelectTrigger className="w-[160px] h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="simulado-teste">Simulado Teste</SelectItem>
      </SelectContent>
    </Select>
    <Select value={filters.periodo} onValueChange={(v) => onFilterChange('periodo', v)}>
      <SelectTrigger className="w-[120px] h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="2024.2">2024.2</SelectItem>
        <SelectItem value="2024.1">2024.1</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
