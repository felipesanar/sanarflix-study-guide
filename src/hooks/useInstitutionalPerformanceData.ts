import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { mapInstitutionalRpcToViewModel } from '@/utils/mapInstitutionalData';
import {
  fetchInstitutionalPerformance,
  fetchStudentScores,
  fetchInstitutionalEvolution,
  resolveIesId,
} from '@/services/institutional';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, isB2BPartner, isGestor } from '@/utils/accessRules';
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

  // Determina se o usuário pode ver todas as IES (apenas admin e b2b_partner).
  // Gestores (gestor/gestor_formal) e demais perfis ficam restritos à própria IES.
  const canSeeAllIes = isAdmin(user) || isB2BPartner(user);

  // Fetch IES list — admin/b2b veem todas; gestor/aluno veem somente a sua IES
  useEffect(() => {
    const fetchIes = async () => {
      if (!canSeeAllIes) {
        // Restringe à IES do próprio usuário
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
        return;
      }
      const { data: iesData, error: iesErr } = await supabase
        .from('ies')
        .select('id, nome')
        .order('nome');
      if (!iesErr && iesData) {
        setIesList(iesData.map((i) => ({ id: i.id, nome: i.nome })));
      }
    };
    fetchIes();
  }, [canSeeAllIes, user?.id_ies]);

  // Fetch simulados whenever IES changes
  useEffect(() => {
    const fetchSimulados = async () => {
      console.log('[DesempenhoInstitucional]', 'Fetching simulados');
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.log('[DesempenhoInstitucional]', 'No session, using mock');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      try {
        const requestedIesId = canSeeAllIes ? (filters.iesId || undefined) : (user?.id_ies || undefined);
        const targetIesId = await resolveIesId(requestedIesId);
        const { data: simData, error: simErr } = await supabase.rpc('get_institutional_simulados', {
          p_ies_id: targetIesId,
        });

        if (simErr) {
          console.warn('[DesempenhoInstitucional]', 'Simulados fetch failed:', simErr.message);
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
        console.log('[DesempenhoInstitucional]', 'Simulados carregados', { total: mapped.length });

        // Sem simulados disponíveis para essa IES → exibe mock para que a tela não fique vazia
        if (mapped.length === 0) {
          console.log('[DesempenhoInstitucional]', 'Nenhum simulado para esta IES, usando dados de demonstração');
          setUsingMock(true);
          setData(getMockViewModel());
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[DesempenhoInstitucional]', 'Error resolving IES, falling back to mock:', err);
        setSimulados([]);
        setUsingMock(true);
        setData(getMockViewModel());
        setError(null);
        setLoading(false);
      }
    };
    fetchSimulados();
  }, [filters.iesId, canSeeAllIes, user?.id_ies]);

  const fetchPerformance = useCallback(async () => {
    if (!filters.simuladoId) {
      console.log('[DesempenhoInstitucional]', 'No simulado selected, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);
    setUsingMock(false);
    console.log('[DesempenhoInstitucional]', 'Fetching performance for simulado:', filters.simuladoId);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.log('[DesempenhoInstitucional]', 'No session, falling back to mock');
        setUsingMock(true);
        setData(getMockViewModel());
        setLoading(false);
        return;
      }

      const targetIesId = await resolveIesId(filters.iesId || undefined);

      // Parallel RPC calls with retry + timeout + total IES users count
      const [perfData, scoresData, evoData, iesUsersResult] = await Promise.all([
        fetchInstitutionalPerformance(filters.simuladoId, targetIesId),
        fetchStudentScores(filters.simuladoId, targetIesId),
        fetchInstitutionalEvolution(targetIesId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('id_ies', targetIesId),
      ]);

      if (!perfData?.overallStats || !scoresData?.students) {
        throw new Error('Dados incompletos retornados pelas RPCs');
      }

      const totalIesUsers = iesUsersResult.count ?? 0;
      const viewModel = mapInstitutionalRpcToViewModel(perfData, evoData, scoresData, totalIesUsers);
      setData(viewModel);
      console.log('[DesempenhoInstitucional]', 'Dados reais carregados', {
        totalStudents: viewModel.allStudents.length,
        areas: viewModel.curricular.areas.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado ao carregar dados';
      console.error('[DesempenhoInstitucional]', 'Falha no carregamento, usando dados de demonstração:', message);
      // Quando RPCs falham ou retornam dados incompletos, exibe mock para
      // que a tela permaneça utilizável (ex.: IES sem simulados ou sem respostas).
      setUsingMock(true);
      setData(getMockViewModel());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [filters.simuladoId, filters.iesId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return { data, simulados, iesList, loading, error, usingMock, refetch: fetchPerformance };
}
