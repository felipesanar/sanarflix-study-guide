import * as React from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { useDesempenhoV2State } from '@/hooks/useDesempenhoV2State';
import { useInstitutionalPerformanceData } from '@/hooks/useInstitutionalPerformanceData';
import { applyDesempenhoV2Filters } from '@/utils/desempenhoV2Filters';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';

type V2State = ReturnType<typeof useDesempenhoV2State>;
type PerfData = ReturnType<typeof useInstitutionalPerformanceData>;
type SemestreOption = { id: string; label: string };

interface GestorFiltersContextValue {
  filters: V2State['filters'];
  updateFilter: V2State['updateFilter'];
  clearFilters: V2State['clearFilters'];
  data: PerfData['data'];
  filteredData: InstitutionalViewModel | null;
  simulados: PerfData['simulados'];
  iesList: PerfData['iesList'];
  loading: PerfData['loading'];
  error: PerfData['error'];
  usingMock: PerfData['usingMock'];
  refetch: PerfData['refetch'];
  availableSemestres: SemestreOption[];
  simuladoNome?: string;
}

const GestorFiltersContext = createContext<GestorFiltersContextValue | null>(null);

/** Acessa os filtros globais e os dados institucionais do gestor. */
export const useGestorFilters = (): GestorFiltersContextValue => {
  const ctx = useContext(GestorFiltersContext);
  if (!ctx) {
    throw new Error('useGestorFilters deve ser usado dentro de GestorFiltersProvider');
  }
  return ctx;
};

/**
 * Eleva o estado de filtros globais (useDesempenhoV2State) e os dados
 * institucionais para um contexto que vive no GestorLayout — rota-pai que
 * permanece montada ao alternar entre os módulos (rotas-filhas). Assim os
 * filtros (IES, simulado, semestres, etc.) NÃO resetam ao trocar de módulo.
 */
export const GestorFiltersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { filters, updateFilter, clearFilters, autoSelectSimulado } =
    useDesempenhoV2State();
  const {
    data,
    simulados,
    iesList,
    loading,
    error,
    usingMock,
    refetch,
    availableSemestres: hookAvailableSemestres,
  } = useInstitutionalPerformanceData(filters);

  const filteredData = useMemo(
    () => applyDesempenhoV2Filters(data, filters),
    [data, filters],
  );

  const simuladoNome = simulados.find((s) => s.id === filters.simuladoId)?.nome;

  const FALLBACK_SEMESTRES = useMemo<SemestreOption[]>(
    () => Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), label: `${i + 1}º Semestre` })),
    [],
  );

  // Lista de semestres do dropdown: vem do hook (respondentes do simulado atual,
  // independente do baseMode). Fallback 1–12 apenas enquanto o fetch dos
  // respondentes ainda não respondeu no modo "Por semestre".
  const availableSemestres = useMemo<SemestreOption[]>(() => {
    const fromHook = hookAvailableSemestres
      .slice()
      .sort((a, b) => a - b)
      .map((n) => ({ id: String(n), label: `${n}º Semestre` }));
    if (fromHook.length > 0) return fromHook;
    if (filters.baseMode === 'semestres') return FALLBACK_SEMESTRES;
    return [];
  }, [hookAvailableSemestres, filters.baseMode, FALLBACK_SEMESTRES]);

  useEffect(() => {
    autoSelectSimulado(simulados);
  }, [simulados, autoSelectSimulado]);

  const value = useMemo<GestorFiltersContextValue>(
    () => ({
      filters,
      updateFilter,
      clearFilters,
      data,
      filteredData,
      simulados,
      iesList,
      loading,
      error,
      usingMock,
      refetch,
      availableSemestres,
      simuladoNome,
    }),
    [
      filters,
      updateFilter,
      clearFilters,
      data,
      filteredData,
      simulados,
      iesList,
      loading,
      error,
      usingMock,
      refetch,
      availableSemestres,
      simuladoNome,
    ],
  );

  return (
    <GestorFiltersContext.Provider value={value}>
      {children}
    </GestorFiltersContext.Provider>
  );
};
