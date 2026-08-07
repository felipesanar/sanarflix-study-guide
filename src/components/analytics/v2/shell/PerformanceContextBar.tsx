import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Layers3, SlidersHorizontal, Database } from 'lucide-react';
import type { DesempenhoV2Filters, DesempenhoV2Tab } from '@/types/desempenhoV2';
import { TAB_CONFIG } from '@/types/desempenhoV2';
import { hasActiveSecondaryFilters } from '@/utils/desempenhoV2Filters';

interface PerformanceContextBarProps {
  activeTab: DesempenhoV2Tab;
  filters: DesempenhoV2Filters;
  usingMock: boolean;
}

function getTabLabel(tab: DesempenhoV2Tab): string {
  return TAB_CONFIG.find((item) => item.value === tab)?.label ?? 'Módulo';
}

export const PerformanceContextBar: React.FC<PerformanceContextBarProps> = ({
  activeTab,
  filters,
  usingMock,
}) => {
  const hasSecondary = hasActiveSecondaryFilters(filters);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border bg-card/70 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="h-6 text-[11px] gap-1">
          <Layers3 className="h-3 w-3" />
          {getTabLabel(activeTab)}
        </Badge>
        <Badge variant={filters.simuladoId ? 'default' : 'secondary'} className="h-6 text-[11px]">
          {filters.simuladoId ? 'Simulado definido' : 'Selecione um simulado'}
        </Badge>
        <Badge variant={hasSecondary ? 'secondary' : 'outline'} className="h-6 text-[11px] gap-1">
          <SlidersHorizontal className="h-3 w-3" />
          {hasSecondary ? 'Recorte refinado' : 'Sem refinamentos'}
        </Badge>
      </div>
      {usingMock && (
        <Badge variant="outline" className="h-6 text-[11px] border-dashed gap-1 w-fit">
          <Database className="h-3 w-3" />
          Modo demo ativo
        </Badge>
      )}
    </div>
  );
};
