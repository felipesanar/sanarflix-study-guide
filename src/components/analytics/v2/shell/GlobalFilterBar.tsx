import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';
import type { DesempenhoV2Filters, SimuladoOption, IesOption } from '@/types/desempenhoV2';

interface Props {
  filters: DesempenhoV2Filters;
  onFilterChange: <K extends keyof DesempenhoV2Filters>(key: K, value: DesempenhoV2Filters[K]) => void;
  simulados: SimuladoOption[];
  iesList: IesOption[];
  usingMock?: boolean;
}

export const GlobalFilterBar: React.FC<Props> = ({ filters, onFilterChange, simulados, iesList, usingMock }) => (
  <div className="flex flex-wrap items-center gap-2">
    {usingMock && (
      <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground border-dashed">
        <Database className="h-3 w-3" />
        Dados demo
      </Badge>
    )}
    {iesList.length > 0 && (
      <Select
        value={filters.iesId || 'all'}
        onValueChange={(v) => onFilterChange('iesId', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-[180px] h-9 text-xs">
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
      <SelectTrigger className="w-[200px] h-9 text-xs">
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
  </div>
);
