import { useState, useCallback } from 'react';
import type { DesempenhoV2Tab, DesempenhoV2Filters } from '@/types/desempenhoV2';
import { DEFAULT_FILTERS } from '@/types/desempenhoV2';

export function useDesempenhoV2State() {
  const [activeTab, setActiveTab] = useState<DesempenhoV2Tab>('visao-institucional');
  const [filters, setFilters] = useState<DesempenhoV2Filters>(DEFAULT_FILTERS);

  const updateFilter = useCallback(<K extends keyof DesempenhoV2Filters>(key: K, value: DesempenhoV2Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  console.log('[DesempenhoV2:Shell]', 'activeTab:', activeTab, 'filters:', filters);

  return { activeTab, setActiveTab, filters, setFilters, updateFilter };
}
