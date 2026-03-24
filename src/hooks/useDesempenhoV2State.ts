import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DesempenhoV2Tab, DesempenhoV2Filters, SimuladoOption } from '@/types/desempenhoV2';
import { DEFAULT_FILTERS, TAB_CONFIG } from '@/types/desempenhoV2';

const TAB_QUERY_KEY = 'modulo';

function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTab(value: string | null): DesempenhoV2Tab {
  const validTabs = new Set(TAB_CONFIG.map((tab) => tab.value));
  if (value && validTabs.has(value as DesempenhoV2Tab)) return value as DesempenhoV2Tab;
  return 'visao-institucional';
}

function parseFiltersFromParams(searchParams: URLSearchParams): DesempenhoV2Filters {
  return {
    iesId: searchParams.get('iesId') ?? '',
    simuladoId: searchParams.get('simuladoId') ?? '',
    periodo: searchParams.get('periodo') ?? '',
    turmas: parseListParam(searchParams.get('turmas')),
    semestres: parseListParam(searchParams.get('semestres')),
    areas: parseListParam(searchParams.get('areas')),
    especialidades: parseListParam(searchParams.get('especialidades')),
    temas: parseListParam(searchParams.get('temas')),
  };
}

export function useDesempenhoV2State() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = useMemo(() => parseTab(searchParams.get(TAB_QUERY_KEY)), [searchParams]);
  const initialFilters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);

  const [activeTab, setActiveTabState] = useState<DesempenhoV2Tab>(initialTab);
  const [filters, setFiltersState] = useState<DesempenhoV2Filters>(initialFilters);

  const setActiveTab = useCallback((tab: DesempenhoV2Tab) => {
    setActiveTabState(tab);
    console.log('[DesempenhoInstitucionalV2]', 'Tab alterada', { tab });
  }, []);

  const setFilters = useCallback((nextFilters: DesempenhoV2Filters | ((prev: DesempenhoV2Filters) => DesempenhoV2Filters)) => {
    setFiltersState((prev) => {
      const resolved = typeof nextFilters === 'function' ? nextFilters(prev) : nextFilters;
      return resolved;
    });
  }, []);

  const updateFilter = useCallback(<K extends keyof DesempenhoV2Filters>(key: K, value: DesempenhoV2Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    console.log('[GlobalFilterBar]', 'Filtro atualizado', { key, value });
  }, [setFilters]);

  const clearFilters = useCallback(() => {
    // Preserve simuladoId and iesId (primary selects), clear all multi-selects
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      iesId: prev.iesId,
      simuladoId: prev.simuladoId,
    }));
    console.log('[GlobalFilterBar]', 'Filtros secundários limpos');
  }, [setFilters]);

  // Auto-select first simulado when list arrives
  const autoSelectSimulado = useCallback((simulados: SimuladoOption[]) => {
    if (!filters.simuladoId && simulados.length > 0) {
      console.log('[DesempenhoInstitucionalV2]', 'Auto-seleção de simulado', { nome: simulados[0].nome });
      setFilters((prev) => ({ ...prev, simuladoId: simulados[0].id }));
    }
  }, [filters.simuladoId, setFilters]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set(TAB_QUERY_KEY, activeTab);

    if (filters.iesId) next.set('iesId', filters.iesId);
    if (filters.simuladoId) next.set('simuladoId', filters.simuladoId);
    if (filters.periodo) next.set('periodo', filters.periodo);
    if (filters.turmas.length) next.set('turmas', filters.turmas.join(','));
    if (filters.semestres.length) next.set('semestres', filters.semestres.join(','));
    if (filters.areas.length) next.set('areas', filters.areas.join(','));
    if (filters.especialidades.length) next.set('especialidades', filters.especialidades.join(','));
    if (filters.temas.length) next.set('temas', filters.temas.join(','));

    const currentString = searchParams.toString();
    const nextString = next.toString();
    if (currentString !== nextString) {
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, filters, searchParams, setSearchParams]);

  return { activeTab, setActiveTab, filters, setFilters, updateFilter, clearFilters, autoSelectSimulado };
}
