import * as React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDesempenhoV2State } from '@/hooks/useDesempenhoV2State';
import { useInstitutionalPerformanceData } from '@/hooks/useInstitutionalPerformanceData';
import { applyDesempenhoV2Filters } from '@/utils/desempenhoV2Filters';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { isGestorGrupo } from '@/utils/accessRules';
import { readPersistedFilters, writePersistedFilters } from '@/experiences/gestor/shell/gestorFiltersStorage';
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
  /** True somente na primeira carga (sem dado algum ainda) — inclui a fase de bootstrap. */
  loading: PerfData['loading'];
  /** True quando já há dado exibível e um refetch roda em segundo plano — telas não devem trocar para skeleton. */
  isRefreshing: PerfData['isRefreshing'];
  error: PerfData['error'];
  usingMock: PerfData['usingMock'];
  refetch: PerfData['refetch'];
  availableSemestres: SemestreOption[];
  simuladoNome?: string;
  /**
   * True enquanto o contexto inicial (IES + simulado) ainda está sendo
   * resolvido: lista de IES/simulados carregando ou auto-seleção pendente.
   * O GestorLayout mostra um skeleton de console inteiro nesta fase — as
   * páginas nunca chegam a renderizar com filtros vazios/transitórios.
   */
  bootstrapping: boolean;
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

function extractSemestresFromData(data: InstitutionalViewModel): SemestreOption[] {
  const sems = new Set<string>();
  data.allStudents.forEach((s) => {
    if (s.semestre) sems.add(String(s.semestre));
  });
  return Array.from(sems)
    .sort((a, b) => Number(a) - Number(b))
    .map((s) => ({ id: s, label: `${s}º Semestre` }));
}

/**
 * Eleva o estado de filtros globais (useDesempenhoV2State) e os dados
 * institucionais para um contexto que vive no GestorLayout — rota-pai que
 * permanece montada ao alternar entre os módulos (rotas-filhas). Assim os
 * filtros (IES, simulado, semestres, etc.) NÃO resetam ao trocar de módulo.
 *
 * Resolve também o contexto inicial (IES + simulado) sem flash de estados
 * transitórios: enquanto a resolução está em curso, expõe `bootstrapping`
 * para o GestorLayout renderizar um skeleton único no lugar do conteúdo.
 * Precedência de defaults: querystring > último recorte salvo em
 * localStorage (por usuário) > default (id_ies / accessibleIes[0] /
 * simulado mais recente).
 */
export const GestorFiltersProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, access } = useAuth();
  const [searchParams] = useSearchParams();
  const { filters, updateFilter, clearFilters, autoSelectSimulado } =
    useDesempenhoV2State();
  const { data, simulados, iesList, loading, isRefreshing, simuladosLoading, error, usingMock, refetch } =
    useInstitutionalPerformanceData(filters);

  const canSeeAllIes = can(access, 'ies.manage');
  const isGroupManager = isGestorGrupo(user);
  const accessibleIes = user?.accessible_ies ?? [];

  // ── Resolução do default de IES (uma única vez, assim que soubermos o
  // usuário e a lista de IES acessíveis) — `useState` (não `useRef`) para
  // garantir que aplicar o flag sempre dispare um re-render e `bootstrapping`
  // nunca fique preso em `true` (ex.: usuário sem nenhuma IES resolvível). ──
  const [iesDefaultApplied, setIesDefaultApplied] = useState(false);
  useEffect(() => {
    if (iesDefaultApplied) return;
    if (!user) return; // aguarda auth resolver
    if (filters.iesId) {
      // Já tem IES (veio da querystring) — nada a fazer.
      setIesDefaultApplied(true);
      return;
    }

    const hasQsIes = searchParams.has('iesId');
    if (hasQsIes) {
      // Querystring explicitamente definiu iesId='' (ex.: admin "Todas as IES") — respeita.
      setIesDefaultApplied(true);
      return;
    }

    const persisted = readPersistedFilters(user.id);
    const persistedValid =
      persisted?.iesId &&
      (canSeeAllIes || accessibleIes.some((ies) => ies.id === persisted.iesId));

    let defaultIesId = '';
    if (persistedValid) {
      defaultIesId = persisted!.iesId;
    } else if (isGroupManager || canSeeAllIes) {
      defaultIesId = accessibleIes[0]?.id ?? user.id_ies ?? '';
    } else {
      defaultIesId = user.id_ies ?? '';
    }

    if (defaultIesId) {
      updateFilter('iesId', defaultIesId);
    }
    setIesDefaultApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canSeeAllIes, isGroupManager, accessibleIes, iesDefaultApplied]);

  // ── Resolução do default de simulado — precedência: querystring (já
  // tratada por useDesempenhoV2State) > localStorage > mais recente ──
  const [simuladoDefaultApplied, setSimuladoDefaultApplied] = useState(false);
  useEffect(() => {
    if (simuladoDefaultApplied) return;
    if (filters.simuladoId) {
      setSimuladoDefaultApplied(true);
      return;
    }
    // Aguarda a busca de simulados terminar (independente do fetch de
    // performance, que só começa depois que um simulado é selecionado).
    // Quando termina com lista vazia (IES sem simulados aplicados), não há
    // o que auto-selecionar — marca como resolvido mesmo assim, para não
    // travar `bootstrapping` para sempre (a tela mostra o aviso "sem
    // simulados", não um skeleton eterno).
    if (simuladosLoading) return;
    if (simulados.length === 0) {
      setSimuladoDefaultApplied(true);
      return;
    }

    const hasQsSimulado = searchParams.has('simuladoId');
    if (hasQsSimulado) {
      setSimuladoDefaultApplied(true);
      return;
    }

    const persisted = readPersistedFilters(user?.id);
    const persistedValid = persisted?.simuladoId && simulados.some((s) => s.id === persisted.simuladoId);

    if (persistedValid) {
      updateFilter('simuladoId', persisted!.simuladoId);
    } else {
      autoSelectSimulado(simulados);
    }
    setSimuladoDefaultApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulados, simuladosLoading, user?.id, simuladoDefaultApplied]);

  // Re-aplica a busca de simulado default sempre que a IES muda (nova lista
  // de simulados chega para um contexto diferente) — sem isso, trocar de
  // IES manualmente deixaria o simulado da IES anterior selecionado até o
  // usuário escolher outro.
  const lastIesIdRef = useRef(filters.iesId);
  useEffect(() => {
    if (lastIesIdRef.current !== filters.iesId) {
      lastIesIdRef.current = filters.iesId;
      setSimuladoDefaultApplied(false);
    }
  }, [filters.iesId]);

  // Persiste o recorte ativo (best-effort) sempre que IES/simulado mudam de
  // forma resolvida (evita persistir strings vazias transitórias do boot).
  useEffect(() => {
    if (!user?.id) return;
    if (!filters.iesId && !filters.simuladoId) return;
    writePersistedFilters(user.id, { iesId: filters.iesId, simuladoId: filters.simuladoId });
  }, [user?.id, filters.iesId, filters.simuladoId]);

  const filteredData = useMemo(
    () => applyDesempenhoV2Filters(data, filters),
    [data, filters],
  );

  const simuladoNome = simulados.find((s) => s.id === filters.simuladoId)?.nome;

  // Preserva a lista de semestres mesmo quando `data` é null (modo "Por semestre").
  const [lastSemestresOptions, setLastSemestresOptions] = useState<SemestreOption[]>([]);
  useEffect(() => {
    if (!data) return;
    const opts = extractSemestresFromData(data);
    if (opts.length > 0) setLastSemestresOptions(opts);
  }, [data]);

  const FALLBACK_SEMESTRES = useMemo<SemestreOption[]>(
    () => Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), label: `${i + 1}º Semestre` })),
    [],
  );

  const availableSemestres = useMemo<SemestreOption[]>(() => {
    const fromData = data ? extractSemestresFromData(data) : [];
    if (fromData.length > 0) return fromData;
    if (lastSemestresOptions.length > 0) return lastSemestresOptions;
    if (filters.baseMode === 'semestres') return FALLBACK_SEMESTRES;
    return [];
  }, [data, lastSemestresOptions, filters.baseMode, FALLBACK_SEMESTRES]);

  // ── Bootstrapping: true enquanto o contexto inicial ainda não está
  // resolvido — IES pendente, lista de simulados carregando/vazia-ainda, ou
  // auto-seleção de simulado pendente. Enquanto true, o GestorLayout troca o
  // conteúdo por um skeleton único (nenhuma página renderiza com filtros
  // vazios/transitórios).
  const iesResolved = !user || Boolean(filters.iesId) || iesDefaultApplied;
  const simuladoResolved = Boolean(filters.simuladoId) || simuladoDefaultApplied;
  const bootstrapping = !iesResolved || !simuladoResolved || (loading && !data);

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
      isRefreshing,
      error,
      usingMock,
      refetch,
      availableSemestres,
      simuladoNome,
      bootstrapping,
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
      isRefreshing,
      error,
      usingMock,
      refetch,
      availableSemestres,
      simuladoNome,
      bootstrapping,
    ],
  );

  return (
    <GestorFiltersContext.Provider value={value}>
      {children}
    </GestorFiltersContext.Provider>
  );
};
