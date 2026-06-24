import * as React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  DesempenhoV2Filters,
  InstitutionalViewModel,
} from '@/types/desempenhoV2';
import { DEFAULT_FILTERS } from '@/types/desempenhoV2';
import { useInstitutionalPerformanceData } from '@/hooks/useInstitutionalPerformanceData';
import { applyDesempenhoV2Filters } from '@/utils/desempenhoV2Filters';
import { Logger } from '@/utils/logger';

interface Option {
  id: string;
  label: string;
}

type PerformanceData = ReturnType<typeof useInstitutionalPerformanceData>;

interface GestorFiltersContextValue extends PerformanceData {
  filters: DesempenhoV2Filters;
  updateFilter: <K extends keyof DesempenhoV2Filters>(
    key: K,
    value: DesempenhoV2Filters[K],
  ) => void;
  clearFilters: () => void;
  filteredData: InstitutionalViewModel | null;
  availableAreas: Option[];
  availableEspecialidades: Option[];
  availableSemestres: Option[];
  availableTemas: Option[];
}

const GestorFiltersContext = createContext<GestorFiltersContextValue | null>(
  null,
);

/** Acessa os filtros globais e os dados de desempenho da experiência do gestor. */
export const useGestorFilters = (): GestorFiltersContextValue => {
  const ctx = useContext(GestorFiltersContext);
  if (!ctx) {
    throw new Error(
      'useGestorFilters deve ser usado dentro de GestorFiltersProvider',
    );
  }
  return ctx;
};

function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFiltersFromParams(
  searchParams: URLSearchParams,
): DesempenhoV2Filters {
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

function extractAreas(data: InstitutionalViewModel): Option[] {
  const areas = new Set<string>();
  data.allStudents.forEach((s) => {
    Object.keys(s.scoresByArea).forEach((a) => areas.add(a));
  });
  return Array.from(areas)
    .sort()
    .map((a) => ({ id: a, label: a }));
}

function extractSemestres(data: InstitutionalViewModel): Option[] {
  const sems = new Set<string>();
  data.allStudents.forEach((s) => {
    if (s.semestre) sems.add(String(s.semestre));
  });
  return Array.from(sems)
    .sort((a, b) => Number(a) - Number(b))
    .map((s) => ({ id: s, label: `${s}º Semestre` }));
}

function extractEspecialidades(data: InstitutionalViewModel): Option[] {
  const especialidades = new Set<string>();
  data.curricular.areas.forEach((area) => {
    area.specialties.forEach((specialty) => especialidades.add(specialty.name));
  });
  return Array.from(especialidades)
    .sort()
    .map((value) => ({ id: value, label: value }));
}

function extractTemas(data: InstitutionalViewModel): Option[] {
  const temas = new Set<string>();
  data.curricular.areas.forEach((area) => {
    area.specialties.forEach((specialty) => {
      specialty.temas.forEach((tema) => temas.add(tema.name));
    });
  });
  return Array.from(temas)
    .sort()
    .map((value) => ({ id: value, label: value }));
}

/**
 * Mantém os filtros globais e os dados de desempenho do gestor num único
 * contexto, montado no GestorLayout (acima do Outlet). Como o provider não
 * desmonta ao trocar de módulo, os filtros e o cache de dados são preservados
 * entre as rotas; também são espelhados na querystring para deep-link/refresh.
 */
export const GestorFiltersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState<DesempenhoV2Filters>(() =>
    parseFiltersFromParams(searchParams),
  );

  const setFilters = useCallback(
    (
      next:
        | DesempenhoV2Filters
        | ((prev: DesempenhoV2Filters) => DesempenhoV2Filters),
    ) => {
      setFiltersState((prev) =>
        typeof next === 'function' ? next(prev) : next,
      );
    },
    [],
  );

  const updateFilter = useCallback(
    <K extends keyof DesempenhoV2Filters>(
      key: K,
      value: DesempenhoV2Filters[K],
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      Logger.info('[GestorFilters]', 'Filtro atualizado', { key, value });
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      iesId: prev.iesId,
      simuladoId: prev.simuladoId,
    }));
    Logger.info('[GestorFilters]', 'Filtros secundários limpos');
  }, [setFilters]);

  const performance = useInstitutionalPerformanceData(filters);
  const { data, simulados } = performance;

  const filteredData = useMemo(
    () => applyDesempenhoV2Filters(data, filters),
    [data, filters],
  );

  // Auto-seleção do primeiro simulado quando a lista chega.
  useEffect(() => {
    if (!filters.simuladoId && simulados.length > 0) {
      setFilters((prev) => ({ ...prev, simuladoId: simulados[0].id }));
    }
  }, [simulados, filters.simuladoId, setFilters]);

  // Espelha os filtros na querystring (preserva outros params, ex.: debug).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    setOrDelete('iesId', filters.iesId);
    setOrDelete('simuladoId', filters.simuladoId);
    setOrDelete('periodo', filters.periodo);
    setOrDelete('turmas', filters.turmas.join(','));
    setOrDelete('semestres', filters.semestres.join(','));
    setOrDelete('areas', filters.areas.join(','));
    setOrDelete('especialidades', filters.especialidades.join(','));
    setOrDelete('temas', filters.temas.join(','));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  const value = useMemo<GestorFiltersContextValue>(
    () => ({
      ...performance,
      filters,
      updateFilter,
      clearFilters,
      filteredData,
      availableAreas: data ? extractAreas(data) : [],
      availableEspecialidades: data ? extractEspecialidades(data) : [],
      availableSemestres: data ? extractSemestres(data) : [],
      availableTemas: data ? extractTemas(data) : [],
    }),
    [performance, filters, updateFilter, clearFilters, filteredData, data],
  );

  return (
    <GestorFiltersContext.Provider value={value}>
      {children}
    </GestorFiltersContext.Provider>
  );
};
