import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapInstitutionalRpcToViewModel } from '@/utils/mapInstitutionalData';
import {
  fetchInstitutionalPerformance,
  fetchStudentScores,
  fetchInstitutionalEvolution,
  fetchInstitutionalTri,
  fetchInstitutionalTriEvolution,
  fetchStudentTriScores,
  fetchIesStudentCount,
  resolveIesId,
} from '@/services/institutional';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isGestor, isGestorGrupo } from '@/utils/accessRules';
import { resolveActiveBase } from '@/utils/activeBase';
import type {
  DesempenhoV2Filters,
  InstitutionalViewModel,
  SimuladoOption,
  IesOption,
} from '@/types/desempenhoV2';
import {
  mockKpis,
  mockFaixas,
  mockMeta,
  mockEvolucao,
  mockDistanciaFaixa,
  mockAlunosAbaixo,
} from '@/mocks/desempenhoInstitucionalV2';
import { Logger } from '@/utils/logger';

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
  const students = mockAlunosAbaixo.map((a) => ({
    nome: a.nome,
    semestre: a.semestre,
    acertos: Math.round(a.percentualAcerto * 100 / 100),
    total: 100,
    percentual: a.percentualAcerto,
    scoresByArea: {},
    totalsByArea: {},
    scoresByTema: {},
    totalsByTema: {},
  }));

  return {
    kpis: mockKpis,
    faixas: mockFaixas,
    meta: mockMeta,
    evolucao: mockEvolucao,
    distanciaFaixa: mockDistanciaFaixa,
    alunosAbaixo: students.filter(s => s.percentual < 60),
    allStudents: students,
    headerSummary: {
      totalAlunos: 100,
      percentProficientes: 35,
      alunosFaltamMeta: 55,
      sancao: 'Redução de 50% das vagas',
      conceitoScoped: 'Conceito 1',
      notaScoped: 1,
      isSemestreScoped: false,
      semestresAtivos: [],
      conceitoMode: 'sixth-year',
      sixthYearFallback: false,
      basePctProficientes: 35,
    },
    curricular: {
      areas: [
        {
          name: 'Clínica Médica', total: 200, acertos: 120, percentual: 60,
          specialties: [
            { name: 'Cardiologia', total: 50, acertos: 35, percentual: 70, areaName: 'Clínica Médica',
              temas: [
                { name: 'Insuficiência Cardíaca', total: 20, acertos: 16, percentual: 80, areaName: 'Clínica Médica', specialtyName: 'Cardiologia' },
                { name: 'Hipertensão Arterial', total: 15, acertos: 9, percentual: 60, areaName: 'Clínica Médica', specialtyName: 'Cardiologia' },
                { name: 'Arritmias', total: 15, acertos: 10, percentual: 66.7, areaName: 'Clínica Médica', specialtyName: 'Cardiologia' },
              ],
            },
            { name: 'Endocrinologia', total: 40, acertos: 20, percentual: 50, areaName: 'Clínica Médica',
              temas: [
                { name: 'Diabetes Mellitus', total: 25, acertos: 12, percentual: 48, areaName: 'Clínica Médica', specialtyName: 'Endocrinologia' },
                { name: 'Tireoide', total: 15, acertos: 8, percentual: 53.3, areaName: 'Clínica Médica', specialtyName: 'Endocrinologia' },
              ],
            },
          ],
        },
        {
          name: 'Cirurgia', total: 150, acertos: 75, percentual: 50,
          specialties: [
            { name: 'Cirurgia Geral', total: 80, acertos: 44, percentual: 55, areaName: 'Cirurgia',
              temas: [
                { name: 'Abdome Agudo', total: 30, acertos: 18, percentual: 60, areaName: 'Cirurgia', specialtyName: 'Cirurgia Geral' },
                { name: 'Hérnias', total: 25, acertos: 10, percentual: 40, areaName: 'Cirurgia', specialtyName: 'Cirurgia Geral' },
                { name: 'Trauma', total: 25, acertos: 16, percentual: 64, areaName: 'Cirurgia', specialtyName: 'Cirurgia Geral' },
              ],
            },
          ],
        },
        {
          name: 'Pediatria', total: 120, acertos: 48, percentual: 40,
          specialties: [
            { name: 'Neonatologia', total: 60, acertos: 21, percentual: 35, areaName: 'Pediatria',
              temas: [
                { name: 'Icterícia Neonatal', total: 20, acertos: 6, percentual: 30, areaName: 'Pediatria', specialtyName: 'Neonatologia' },
                { name: 'Reanimação Neonatal', total: 20, acertos: 8, percentual: 40, areaName: 'Pediatria', specialtyName: 'Neonatologia' },
                { name: 'Prematuridade', total: 20, acertos: 7, percentual: 35, areaName: 'Pediatria', specialtyName: 'Neonatologia' },
              ],
            },
            { name: 'Puericultura', total: 60, acertos: 27, percentual: 45, areaName: 'Pediatria',
              temas: [
                { name: 'Crescimento e Desenvolvimento', total: 30, acertos: 15, percentual: 50, areaName: 'Pediatria', specialtyName: 'Puericultura' },
                { name: 'Vacinação', total: 30, acertos: 12, percentual: 40, areaName: 'Pediatria', specialtyName: 'Puericultura' },
              ],
            },
          ],
        },
        {
          name: 'Ginecologia e Obstetrícia', total: 100, acertos: 65, percentual: 65,
          specialties: [
            { name: 'Obstetrícia', total: 60, acertos: 42, percentual: 70, areaName: 'Ginecologia e Obstetrícia',
              temas: [
                { name: 'Pré-natal', total: 30, acertos: 24, percentual: 80, areaName: 'Ginecologia e Obstetrícia', specialtyName: 'Obstetrícia' },
                { name: 'Parto', total: 30, acertos: 18, percentual: 60, areaName: 'Ginecologia e Obstetrícia', specialtyName: 'Obstetrícia' },
              ],
            },
            { name: 'Ginecologia', total: 40, acertos: 23, percentual: 57.5, areaName: 'Ginecologia e Obstetrícia',
              temas: [
                { name: 'Câncer de Colo', total: 20, acertos: 14, percentual: 70, areaName: 'Ginecologia e Obstetrícia', specialtyName: 'Ginecologia' },
                { name: 'Endometriose', total: 20, acertos: 9, percentual: 45, areaName: 'Ginecologia e Obstetrícia', specialtyName: 'Ginecologia' },
              ],
            },
          ],
        },
      ],
    },
  };
}

export function useInstitutionalPerformanceData(
  filters: DesempenhoV2Filters,
): UseInstitutionalPerformanceResult {
  const { user } = useAuth();
  const [data, setData] = useState<InstitutionalViewModel | null>(null);
  const [simulados, setSimulados] = useState<SimuladoOption[]>([]);
  const [iesList, setIesList] = useState<IesOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  // Determina se o usuário pode ver todas as IES (apenas admin).
  // Gestores (gestor) e demais perfis ficam restritos à própria IES,
  // EXCETO gestor_grupo, que pode acessar as IES vinculadas ao(s) grupo(s) dele.
  const canSeeAllIes = isAdmin(user);
  const isGroupManager = isGestorGrupo(user);
  const accessibleIes = user?.accessible_ies ?? [];

  // IES "padrão" usada quando o gestor de grupo não tem `id_ies` próprio.
  const defaultGroupIesId = accessibleIes[0]?.id;

  // Fetch IES list — admin vê todas; gestor_grupo vê IES do grupo; demais veem só a sua.
  useEffect(() => {
    const fetchIes = async () => {
      if (canSeeAllIes) {
        const { data: iesData, error: iesErr } = await supabase
          .from('ies')
          .select('id, nome')
          .order('nome');
        if (!iesErr && iesData) {
          setIesList(iesData.map((i) => ({ id: i.id, nome: i.nome })));
        }
        return;
      }

      // gestor_grupo: usa a lista de IES acessíveis vinda do AuthContext
      if (isGroupManager && accessibleIes.length > 0) {
        setIesList(accessibleIes.map((i) => ({ id: i.id, nome: i.nome })));
        return;
      }

      // Outros perfis: restringe à própria IES
      if (user?.id_ies) {
        const { data: iesRow } = await supabase
          .from('ies')
          .select('id, nome')
          .eq('id', user.id_ies)
          .maybeSingle();
        if (iesRow) {
          setIesList([{ id: iesRow.id, nome: iesRow.nome }]);
        } else {
          setIesList([]);
        }
      } else {
        setIesList([]);
      }
    };
    fetchIes();
  }, [canSeeAllIes, isGroupManager, accessibleIes, user?.id_ies]);

  // Fetch simulados whenever IES changes
  useEffect(() => {
    const fetchSimulados = async () => {
      Logger.info('[DesempenhoInstitucional]', 'Fetching simulados');
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        Logger.info('[DesempenhoInstitucional]', 'No session, using mock');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      try {
        const requestedIesId = canSeeAllIes
          ? (filters.iesId || undefined)
          : isGroupManager
            ? (filters.iesId || defaultGroupIesId || user?.id_ies || undefined)
            : (user?.id_ies || undefined);
        const targetIesId = await resolveIesId(requestedIesId);
        const { data: simData, error: simErr } = await supabase.rpc('get_institutional_simulados', {
          p_ies_id: targetIesId,
        });

        if (simErr) {
          Logger.warn('[DesempenhoInstitucional]', 'Simulados fetch failed:', simErr.message);
          setSimulados([]);
          setError(`Erro ao carregar simulados: ${simErr.message}`);
          setLoading(false);
          return;
        }

        const mapped = (simData ?? []).map((item: unknown) => {
          const simulado = item as { id: string; nome: string };
          return { id: simulado.id, nome: simulado.nome };
        });
        setSimulados(mapped);
        Logger.info('[DesempenhoInstitucional]', 'Simulados carregados', { total: mapped.length });

        // Sem simulados disponíveis para essa IES → exibe mock para que a tela não fique vazia
        if (mapped.length === 0) {
          Logger.info('[DesempenhoInstitucional]', 'Nenhum simulado para esta IES, usando dados de demonstração');
          setUsingMock(true);
          setData(getMockViewModel());
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        Logger.warn('[DesempenhoInstitucional]', 'Error resolving IES, falling back to mock:', err);
        setSimulados([]);
        setUsingMock(true);
        setData(getMockViewModel());
        setError(null);
        setLoading(false);
      }
    };
    fetchSimulados();
  }, [filters.iesId, canSeeAllIes, isGroupManager, defaultGroupIesId, user?.id_ies]);

  // Resolve a base ativa (precedência: semestres > Conceito Geral > 6º ano)
  const activeBase = resolveActiveBase(filters);
  const baseKey = activeBase.mode + ':' + (activeBase.semestres?.join(',') ?? 'null');

  const fetchPerformance = useCallback(async () => {
    if (!filters.simuladoId) {
      Logger.info('[DesempenhoInstitucional]', 'No simulado selected, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);
    setUsingMock(false);
    Logger.info('[DesempenhoInstitucional]', 'Fetching with active base:', activeBase);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        Logger.info('[DesempenhoInstitucional]', 'No session, falling back to mock');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      const requestedIesId = canSeeAllIes
        ? (filters.iesId || undefined)
        : isGroupManager
          ? (filters.iesId || defaultGroupIesId || user?.id_ies || undefined)
          : (user?.id_ies || undefined);
      const targetIesId = await resolveIesId(requestedIesId);

      // Chamadas em paralelo — TRI/Adesão usam a base ativa.
      const [perfData, scoresData, evoData, triEvoData, studentTriData] = await Promise.all([
        fetchInstitutionalPerformance(filters.simuladoId, targetIesId),
        fetchStudentScores(filters.simuladoId, targetIesId),
        fetchInstitutionalEvolution(targetIesId),
        fetchInstitutionalTriEvolution(targetIesId),
        fetchStudentTriScores(filters.simuladoId, targetIesId),
      ]);

      let triScopedData = await fetchInstitutionalTri(filters.simuladoId, targetIesId, activeBase.semestres);
      let totalIesUsers = await fetchIesStudentCount(targetIesId, activeBase.semestres);
      let effectiveBase = activeBase;
      let sixthYearFallback = false;

      // Fallback: 6º ano sem alunos → cai para base geral
      if (activeBase.mode === 'sixth-year' && (!triScopedData || (triScopedData.num_students ?? 0) === 0)) {
        Logger.info('[DesempenhoInstitucional]', '6º ano sem alunos — fallback para base geral');
        sixthYearFallback = true;
        effectiveBase = { semestres: null, mode: 'general', label: 'IES inteira' };
        triScopedData = await fetchInstitutionalTri(filters.simuladoId, targetIesId, null);
        totalIesUsers = await fetchIesStudentCount(targetIesId, null);
      }

      if (!perfData?.overallStats || !scoresData?.students) {
        throw new Error('Dados incompletos retornados pelas RPCs');
      }

      const viewModel = mapInstitutionalRpcToViewModel(
        perfData,
        evoData,
        scoresData,
        totalIesUsers,
        triScopedData,
        triEvoData,
        studentTriData,
        effectiveBase,
        sixthYearFallback,
      );
      setData(viewModel);
      Logger.info('[DesempenhoInstitucional]', 'Dados reais carregados', {
        totalStudents: viewModel.allStudents.length,
        areas: viewModel.curricular.areas.length,
        triScoped: !!triScopedData,
        effectiveBase,
        sixthYearFallback,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado ao carregar dados';
      Logger.error('[DesempenhoInstitucional]', 'Falha no carregamento, usando dados de demonstração:', message);
      setUsingMock(true);
      setData(getMockViewModel());
      setError(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.simuladoId, filters.iesId, baseKey, canSeeAllIes, isGroupManager, defaultGroupIesId, user?.id_ies]);


  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return { data, simulados, iesList, loading, error, usingMock, refetch: fetchPerformance };
}
