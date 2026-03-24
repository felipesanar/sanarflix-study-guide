import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapInstitutionalRpcToViewModel } from '@/utils/mapInstitutionalData';
import type {
  DesempenhoV2Filters,
  InstitutionalViewModel,
  SimuladoOption,
  IesOption,
  RpcPerformanceResponse,
  RpcEvolutionEntry,
  RpcStudentScoresResponse,
} from '@/types/desempenhoV2';
import {
  mockKpis,
  mockFaixas,
  mockMeta,
  mockEvolucao,
  mockDistanciaFaixa,
  mockAlunosAbaixo,
} from '@/mocks/desempenhoInstitucionalV2';

interface UseInstitutionalPerformanceResult {
  data: InstitutionalViewModel | null;
  simulados: SimuladoOption[];
  iesList: IesOption[];
  loading: boolean;
  error: string | null;
  usingMock: boolean;
  refetch: () => void;
}

function getMockViewModel(): InstitutionalViewModel {
  return {
    kpis: mockKpis,
    faixas: mockFaixas,
    meta: mockMeta,
    evolucao: mockEvolucao,
    distanciaFaixa: mockDistanciaFaixa,
    alunosAbaixo: mockAlunosAbaixo.map((a) => ({
      nome: a.nome,
      semestre: a.semestre,
      acertos: Math.round(a.percentualAcerto * 100 / 100),
      total: 100,
      percentual: a.percentualAcerto,
      scoresByArea: {},
    })),
    headerSummary: {
      totalAlunos: 100,
      percentProficientes: 35,
      alunosFaltamMeta: 55,
      sancao: 'Redução de 50% das vagas',
    },
  };
}

export function useInstitutionalPerformanceData(
  filters: DesempenhoV2Filters,
): UseInstitutionalPerformanceResult {
  const [data, setData] = useState<InstitutionalViewModel | null>(null);
  const [simulados, setSimulados] = useState<SimuladoOption[]>([]);
  const [iesList, setIesList] = useState<IesOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  // Fetch IES list for admin/b2b
  useEffect(() => {
    const fetchIes = async () => {
      const { data: iesData, error: iesErr } = await supabase
        .from('ies')
        .select('id, nome')
        .order('nome');
      if (!iesErr && iesData) {
        setIesList(iesData.map((i) => ({ id: i.id, nome: i.nome })));
      }
    };
    fetchIes();
  }, []);

  // Fetch simulados whenever IES changes
  useEffect(() => {
    const fetchSimulados = async () => {
      console.log('[DesempenhoV2:Data]', 'Fetching simulados, iesId:', filters.iesId || 'own');
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.log('[DesempenhoV2:Data]', 'No session, using mock');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      const rpcArgs: { p_ies_id?: string } = {};
      if (filters.iesId) rpcArgs.p_ies_id = filters.iesId;

      const { data: simData, error: simErr } = await supabase.rpc(
        'get_institutional_simulados',
        rpcArgs,
      );

      if (simErr) {
        console.warn('[DesempenhoV2:Data]', 'Simulados fetch failed:', simErr.message);
        setSimulados([]);
        return;
      }

      const mapped = (simData ?? []).map((s: any) => ({ id: s.id, nome: s.nome }));
      setSimulados(mapped);
      console.log('[DesempenhoV2:Data]', 'Simulados loaded:', mapped.length);
    };
    fetchSimulados();
  }, [filters.iesId]);

  const fetchPerformance = useCallback(async () => {
    if (!filters.simuladoId) {
      console.log('[DesempenhoV2:Data]', 'No simulado selected, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);
    setUsingMock(false);
    console.log('[DesempenhoV2:Data]', 'Fetching performance for simulado:', filters.simuladoId);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.log('[DesempenhoV2:Data]', 'No session, falling back to mock');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      const rpcBaseArgs: { p_simulado_id: string; p_ies_id?: string } = {
        p_simulado_id: filters.simuladoId,
      };
      if (filters.iesId) rpcBaseArgs.p_ies_id = filters.iesId;

      const evoArgs: { p_ies_id?: string } = {};
      if (filters.iesId) evoArgs.p_ies_id = filters.iesId;

      // Parallel RPC calls
      const [perfResult, evoResult, scoresResult] = await Promise.all([
        supabase.rpc('get_institutional_performance', rpcBaseArgs),
        supabase.rpc('get_institutional_evolution', evoArgs),
        supabase.rpc('get_institutional_student_scores', rpcBaseArgs),
      ]);

      if (perfResult.error) throw new Error(`Performance: ${perfResult.error.message}`);
      if (evoResult.error) throw new Error(`Evolution: ${evoResult.error.message}`);
      if (scoresResult.error) throw new Error(`Scores: ${scoresResult.error.message}`);

      const perfData = perfResult.data as unknown as RpcPerformanceResponse;
      const evoData = (evoResult.data ?? []) as unknown as RpcEvolutionEntry[];
      const scoresData = scoresResult.data as unknown as RpcStudentScoresResponse;

      if (!perfData?.overallStats || !scoresData?.students) {
        console.warn('[DesempenhoV2:Data]', 'Incomplete data, using mock fallback');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      const viewModel = mapInstitutionalRpcToViewModel(perfData, evoData, scoresData);
      setData(viewModel);
      console.log('[DesempenhoV2:Data]', 'Real data loaded successfully');
    } catch (err: any) {
      console.error('[DesempenhoV2:Data]', 'Error fetching data:', err.message);
      setError(err.message);
      // Fallback to mock on error
      setUsingMock(true);
      setData(getMockViewModel());
    } finally {
      setLoading(false);
    }
  }, [filters.simuladoId, filters.iesId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // If no simulado selected yet but simulados are available, auto-select the first one
  // This is handled by the parent component via filter updates

  return { data, simulados, iesList, loading, error, usingMock, refetch: fetchPerformance };
}
