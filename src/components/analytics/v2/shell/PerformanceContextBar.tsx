import React from 'react';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <Badge variant="outline" className="text-[11px]">
        Módulo: {getTabLabel(activeTab)}
      </Badge>
      <Badge variant={filters.simuladoId ? 'default' : 'secondary'} className="text-[11px]">
        {filters.simuladoId ? 'Simulado selecionado' : 'Selecione um simulado'}
      </Badge>
      <Badge variant={hasSecondary ? 'secondary' : 'outline'} className="text-[11px]">
        {hasSecondary ? 'Filtros refinando a análise' : 'Sem filtros secundários'}
      </Badge>
      {usingMock && (
        <Badge variant="outline" className="text-[11px] border-dashed">
          Modo demo ativo
        </Badge>
      )}
    </div>
  );
};
