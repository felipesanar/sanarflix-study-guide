import { useState, useCallback, useEffect } from 'react';
import type { DesempenhoV2Tab, DesempenhoV2Filters, SimuladoOption } from '@/types/desempenhoV2';
import { DEFAULT_FILTERS } from '@/types/desempenhoV2';

export function useDesempenhoV2State() {
  const [activeTab, setActiveTab] = useState<DesempenhoV2Tab>('visao-institucional');
  const [filters, setFilters] = useState<DesempenhoV2Filters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(<K extends keyof DesempenhoV2Filters>(key: K, value: DesempenhoV2Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Auto-select first simulado when list arrives
  const autoSelectSimulado = useCallback((simulados: SimuladoOption[]) => {
    if (!filters.simuladoId && simulados.length > 0) {
      console.log('[DesempenhoV2:Shell]', 'Auto-selecting simulado:', simulados[0].nome);
      setFilters(prev => ({ ...prev, simuladoId: simulados[0].id }));
    }
  }, [filters.simuladoId]);

  return { activeTab, setActiveTab, filters, setFilters, updateFilter, autoSelectSimulado };
}
