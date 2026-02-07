import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';

// ============== TYPES ==============
export interface SimuladoOverview {
  id: string;
  nome: string;
  status: string;
  data_liberacao: string | null;
  data_encerramento: string | null;
  duracao_minutos: number;
  ies_ids: string[];
  total_questoes: number;
  iniciados_unicos: number;
  concluintes_unicos: number;
  taxa_conclusao: number;
  acuracia_media: number;
  tempo_mediano_segundos: number;
  tempo_medio_segundos: number;
  saidas_aba_media: number;
  saidas_fullscreen_media: number;
  tentativas_media: number;
  questoes_anuladas: number;
}

export interface ExecutiveKPIs {
  simuladosAtivos: number;
  alunosIniciaram: number;
  alunosConcluiram: number;
  taxaConclusao: number;
  deltaConclusaoPeriodoAnterior: number | null;
  acuraciaMedia: number;
  tempoMedianoMinutos: number;
  tempoMedioMinutos: number;
  saidasAbaMediana: number;
  saidasFullscreenMediana: number;
  tentativasMedia: number;
  percentLiberadoNovamente: number;
  totalRespostas: number;
}

export interface TemporalData {
  inicioPorDia: { data: string; count: number }[];
  conclusaoPorDia: { data: string; count: number }[];
  acuraciaPorDia: { data: string; acuracia: number; n: number }[];
  tempoPorDia: { data: string; tempoMediano: number; n: number }[];
  heatmapHorario: { hora: number; dia: number; count: number }[];
}

export interface SegmentacaoIES {
  ies_id: string;
  ies_nome: string;
  alunos: number;
  acuracia: number;
  n_respostas: number;
}

export interface SegmentacaoSemestre {
  semestre: string;
  alunos: number;
  acuracia: number;
  n_respostas: number;
}

export interface SegmentacaoDimensao {
  nome: string;
  acuracia: number;
  n_respostas: number;
  delta_periodo_anterior?: number | null;
}

export interface QuestaoProblematica {
  id: string;
  enunciado: string;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  dificuldade: string | null;
  taxa_erro: number;
  n_respostas: number;
  anulada: boolean;
  distribuicao: { alternativa: string; count: number; percent: number }[];
  comentario: string | null;
}

export interface ComportamentoMetrics {
  saidasAbaMedia: number;
  saidasAbaP95: number;
  saidasFullscreenMedia: number;
  saidasFullscreenP95: number;
  tempoMedioPorQuestao: number | null;
  abandono: {
    totalIniciados: number;
    totalFinalizados: number;
    taxaAbandono: number;
  };
  liberadoNovamente: {
    count: number;
    percent: number;
  };
  simuladosComFriccaoAlta: string[];
}

export interface SimuladosAnalyticsData {
  executive: ExecutiveKPIs;
  temporal: TemporalData;
  segmentacaoIES: SegmentacaoIES[];
  segmentacaoSemestre: SegmentacaoSemestre[];
  segmentacaoArea: SegmentacaoDimensao[];
  segmentacaoEspecialidade: SegmentacaoDimensao[];
  segmentacaoTema: SegmentacaoDimensao[];
  segmentacaoDificuldade: SegmentacaoDimensao[];
  simulados: SimuladoOverview[];
  questoesProblematicas: QuestaoProblematica[];
  comportamento: ComportamentoMetrics;
  isLoading: boolean;
  error: string | null;
}

export interface SimuladosFilters {
  dateRange: { start: Date; end: Date };
  iesId: string | null;
  excludedIES: string[];
  simuladoId?: string | null;
  semestre?: number | null;
}

// ============== HELPERS ==============
const percentile = (arr: number[], p: number): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

const median = (arr: number[]): number => percentile(arr, 50);

// ============== HOOK ==============
export function useSimuladosAnalytics(filters: SimuladosFilters) {
  const [data, setData] = useState<SimuladosAnalyticsData>({
    executive: {
      simuladosAtivos: 0,
      alunosIniciaram: 0,
      alunosConcluiram: 0,
      taxaConclusao: 0,
      deltaConclusaoPeriodoAnterior: null,
      acuraciaMedia: 0,
      tempoMedianoMinutos: 0,
      tempoMedioMinutos: 0,
      saidasAbaMediana: 0,
      saidasFullscreenMediana: 0,
      tentativasMedia: 0,
      percentLiberadoNovamente: 0,
      totalRespostas: 0,
    },
    temporal: {
      inicioPorDia: [],
      conclusaoPorDia: [],
      acuraciaPorDia: [],
      tempoPorDia: [],
      heatmapHorario: [],
    },
    segmentacaoIES: [],
    segmentacaoSemestre: [],
    segmentacaoArea: [],
    segmentacaoEspecialidade: [],
    segmentacaoTema: [],
    segmentacaoDificuldade: [],
    simulados: [],
    questoesProblematicas: [],
    comportamento: {
      saidasAbaMedia: 0,
      saidasAbaP95: 0,
      saidasFullscreenMedia: 0,
      saidasFullscreenP95: 0,
      tempoMedioPorQuestao: null,
      abandono: { totalIniciados: 0, totalFinalizados: 0, taxaAbandono: 0 },
      liberadoNovamente: { count: 0, percent: 0 },
      simuladosComFriccaoAlta: [],
    },
    isLoading: true,
    error: null,
  });

  const filterParams = useMemo(() => ({
    startDate: filters.dateRange.start.toISOString(),
    endDate: filters.dateRange.end.toISOString(),
    iesId: filters.iesId && filters.iesId !== 'all' ? filters.iesId : null,
    excludedIES: filters.excludedIES || [],
    simuladoId: filters.simuladoId || null,
    semestre: filters.semestre || null,
  }), [filters]);

  const fetchUserIdsByIES = useCallback(async (iesId: string): Promise<string[]> => {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('id_ies', iesId);
    return users?.map(u => u.id) || [];
  }, []);

  const fetchUserIdsExcludingIES = useCallback(async (excludedIds: string[]): Promise<string[]> => {
    if (excludedIds.length === 0) return [];
    const { data: allUsers } = await supabase.from('users').select('id, id_ies');
    if (!allUsers) return [];
    return allUsers.filter(u => u.id_ies && !excludedIds.includes(u.id_ies)).map(u => u.id);
  }, []);

  const fetchData = useCallback(async () => {
    console.log('[useSimuladosAnalytics] Fetching with filters:', filterParams);
    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { startDate, endDate, iesId, excludedIES, simuladoId, semestre } = filterParams;

      // Resolve user IDs for IES filtering
      let userIds: string[] | null = null;
      if (iesId) {
        userIds = await fetchUserIdsByIES(iesId);
        if (userIds.length === 0) {
          setData(prev => ({ ...prev, isLoading: false }));
          return;
        }
      } else if (excludedIES.length > 0) {
        userIds = await fetchUserIdsExcludingIES(excludedIES);
      }

      // Fetch base data in parallel
      const [
        simuladosAdminRes,
        iniciadosRes,
        finalizadosRes,
        respostasRes,
        questoesRes,
        usersRes,
        iesRes,
      ] = await Promise.all([
        // Simulados config
        iesId
          ? supabase.from('simulados_admin').select('*').contains('ies_ids', [iesId])
          : supabase.from('simulados_admin').select('*'),
        // Iniciados in date range
        supabase.from('simulados_iniciados')
          .select('simulado_id, user_id, started_at')
          .gte('started_at', startDate)
          .lte('started_at', endDate),
        // Finalizados in date range
        supabase.from('simulados_finalizados')
          .select('id, simulado_id, user_id, finalizado_em, tempo_total_segundos, saidas_de_aba, saidas_de_fullscreen, tentativa_numero, liberado_novamente')
          .gte('finalizado_em', startDate)
          .lte('finalizado_em', endDate),
        // Respostas (will filter by simulado_id if needed)
        supabase.from('answer_progress')
          .select('question_id, correct, user_id, simulado'),
        // Questões
        supabase.from('questoes_simulado')
          .select('id, simulado_id, enunciado, grande_area, especialidade, tema, grau_dificuldade, anulada, comentario, alternativa_a, alternativa_b, alternativa_c, alternativa_d'),
        // Users for segmentation
        supabase.from('users').select('id, id_ies, semestre'),
        // IES names
        supabase.from('ies').select('id, nome'),
      ]);

      const simuladosAdmin = simuladosAdminRes.data || [];
      let iniciados = iniciadosRes.data || [];
      let finalizados = finalizadosRes.data || [];
      let respostas = respostasRes.data || [];
      const questoes = questoesRes.data || [];
      const users = usersRes.data || [];
      const iesList = iesRes.data || [];

      // Apply user filter if needed
      if (userIds) {
        iniciados = iniciados.filter(i => userIds!.includes(i.user_id));
        finalizados = finalizados.filter(f => userIds!.includes(f.user_id));
        respostas = respostas.filter(r => userIds!.includes(r.user_id));
      }

      // Apply semestre filter
      if (semestre) {
        const semestreUserIds = users.filter(u => u.semestre === semestre).map(u => u.id);
        iniciados = iniciados.filter(i => semestreUserIds.includes(i.user_id));
        finalizados = finalizados.filter(f => semestreUserIds.includes(f.user_id));
        respostas = respostas.filter(r => semestreUserIds.includes(r.user_id));
      }

      // Apply simulado filter
      if (simuladoId) {
        iniciados = iniciados.filter(i => i.simulado_id === simuladoId);
        finalizados = finalizados.filter(f => f.simulado_id === simuladoId);
        respostas = respostas.filter(r => r.simulado === simuladoId);
      }

      // Build lookup maps
      const iesMap = new Map(iesList.map(i => [i.id, i.nome]));
      const userIesMap = new Map(users.map(u => [u.id, u.id_ies]));
      const userSemestreMap = new Map(users.map(u => [u.id, u.semestre]));
      const questaoMap = new Map(questoes.map(q => [q.id, q]));

      // Filter simulados by IES
      const relevantSimulados = iesId
        ? simuladosAdmin.filter(s => s.ies_ids?.includes(iesId))
        : simuladosAdmin;
      const simuladoIds = new Set(relevantSimulados.map(s => s.id));

      // Filter data by relevant simulados
      iniciados = iniciados.filter(i => simuladoIds.has(i.simulado_id));
      finalizados = finalizados.filter(f => simuladoIds.has(f.simulado_id));
      respostas = respostas.filter(r => simuladoIds.has(r.simulado));

      // ============== EXECUTIVE KPIs ==============
      const uniqueIniciados = new Set(iniciados.map(i => i.user_id));
      const uniqueFinalizados = new Set(finalizados.map(f => f.user_id));
      const taxaConclusao = uniqueIniciados.size > 0 
        ? Math.round((uniqueFinalizados.size / uniqueIniciados.size) * 100) 
        : 0;

      const totalRespostas = respostas.length;
      const totalCorretas = respostas.filter(r => r.correct).length;
      const acuraciaMedia = totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0;

      const tempos = finalizados.map(f => f.tempo_total_segundos).filter(t => t > 0);
      const tempoMediano = median(tempos);
      const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

      const saidasAba = finalizados.map(f => f.saidas_de_aba || 0);
      const saidasFullscreen = finalizados.map(f => f.saidas_de_fullscreen || 0);

      const tentativas = finalizados.map(f => f.tentativa_numero || 1);
      const liberadosNovamente = finalizados.filter(f => f.liberado_novamente).length;

      // ============== TEMPORAL DATA ==============
      const inicioPorDiaMap = new Map<string, number>();
      iniciados.forEach(i => {
        const d = toBrazilDate(i.started_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        inicioPorDiaMap.set(key, (inicioPorDiaMap.get(key) || 0) + 1);
      });

      const conclusaoPorDiaMap = new Map<string, number>();
      finalizados.forEach(f => {
        const d = toBrazilDate(f.finalizado_em);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        conclusaoPorDiaMap.set(key, (conclusaoPorDiaMap.get(key) || 0) + 1);
      });

      // Heatmap: hora x dia da semana
      const heatmapMap = new Map<string, number>();
      iniciados.forEach(i => {
        const d = toBrazilDate(i.started_at);
        const hora = d.getHours();
        const dia = d.getDay(); // 0-6
        const key = `${hora}-${dia}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
      });

      // ============== SEGMENTATION BY IES ==============
      const iesPerfMap = new Map<string, { corretas: number; total: number; users: Set<string> }>();
      respostas.forEach(r => {
        const userIes = userIesMap.get(r.user_id);
        if (!userIes) return;
        const existing = iesPerfMap.get(userIes) || { corretas: 0, total: 0, users: new Set() };
        iesPerfMap.set(userIes, {
          corretas: existing.corretas + (r.correct ? 1 : 0),
          total: existing.total + 1,
          users: existing.users.add(r.user_id),
        });
      });

      const segmentacaoIES: SegmentacaoIES[] = Array.from(iesPerfMap.entries())
        .map(([ies_id, stats]) => ({
          ies_id,
          ies_nome: iesMap.get(ies_id) || 'Desconhecida',
          alunos: stats.users.size,
          acuracia: stats.total > 0 ? Math.round((stats.corretas / stats.total) * 100) : 0,
          n_respostas: stats.total,
        }))
        .sort((a, b) => b.acuracia - a.acuracia);

      // ============== SEGMENTATION BY SEMESTER ==============
      const semestrePerfMap = new Map<number, { corretas: number; total: number; users: Set<string> }>();
      respostas.forEach(r => {
        const userSem = userSemestreMap.get(r.user_id) ?? 0;
        const existing = semestrePerfMap.get(userSem) || { corretas: 0, total: 0, users: new Set() };
        semestrePerfMap.set(userSem, {
          corretas: existing.corretas + (r.correct ? 1 : 0),
          total: existing.total + 1,
          users: existing.users.add(r.user_id),
        });
      });

      const segmentacaoSemestre: SegmentacaoSemestre[] = Array.from(semestrePerfMap.entries())
        .map(([sem, stats]) => ({
          semestre: sem === 0 ? 'Não informado' : `${sem}º`,
          alunos: stats.users.size,
          acuracia: stats.total > 0 ? Math.round((stats.corretas / stats.total) * 100) : 0,
          n_respostas: stats.total,
        }))
        .sort((a, b) => {
          if (a.semestre === 'Não informado') return 1;
          if (b.semestre === 'Não informado') return -1;
          return parseInt(a.semestre) - parseInt(b.semestre);
        });

      // ============== SEGMENTATION BY CONTENT DIMENSIONS ==============
      const buildDimensaoMap = (field: 'grande_area' | 'especialidade' | 'tema' | 'grau_dificuldade') => {
        const map = new Map<string, { corretas: number; total: number }>();
        respostas.forEach(r => {
          const questao = questaoMap.get(r.question_id);
          if (!questao) return;
          const val = questao[field];
          if (!val) return;
          const existing = map.get(val) || { corretas: 0, total: 0 };
          map.set(val, {
            corretas: existing.corretas + (r.correct ? 1 : 0),
            total: existing.total + 1,
          });
        });
        return Array.from(map.entries())
          .map(([nome, stats]) => ({
            nome,
            acuracia: stats.total > 0 ? Math.round((stats.corretas / stats.total) * 100) : 0,
            n_respostas: stats.total,
          }))
          .sort((a, b) => a.acuracia - b.acuracia); // worst first
      };

      const segmentacaoArea = buildDimensaoMap('grande_area');
      const segmentacaoEspecialidade = buildDimensaoMap('especialidade');
      const segmentacaoTema = buildDimensaoMap('tema');
      const segmentacaoDificuldade = buildDimensaoMap('grau_dificuldade');

      // ============== SIMULADOS OVERVIEW ==============
      const simuladosOverview: SimuladoOverview[] = relevantSimulados.map(s => {
        const simIniciados = iniciados.filter(i => i.simulado_id === s.id);
        const simFinalizados = finalizados.filter(f => f.simulado_id === s.id);
        const simRespostas = respostas.filter(r => r.simulado === s.id);
        const simQuestoes = questoes.filter(q => q.simulado_id === s.id);

        const uniqueInic = new Set(simIniciados.map(i => i.user_id));
        const uniqueFin = new Set(simFinalizados.map(f => f.user_id));
        const simTempos = simFinalizados.map(f => f.tempo_total_segundos).filter(t => t > 0);
        const simSaidasAba = simFinalizados.map(f => f.saidas_de_aba || 0);
        const simSaidasFs = simFinalizados.map(f => f.saidas_de_fullscreen || 0);
        const simTentativas = simFinalizados.map(f => f.tentativa_numero || 1);
        const totalCorr = simRespostas.filter(r => r.correct).length;

        return {
          id: s.id,
          nome: s.nome,
          status: s.status,
          data_liberacao: s.data_liberacao,
          data_encerramento: s.data_encerramento,
          duracao_minutos: s.duracao_minutos,
          ies_ids: s.ies_ids || [],
          total_questoes: simQuestoes.length,
          iniciados_unicos: uniqueInic.size,
          concluintes_unicos: uniqueFin.size,
          taxa_conclusao: uniqueInic.size > 0 ? Math.round((uniqueFin.size / uniqueInic.size) * 100) : 0,
          acuracia_media: simRespostas.length > 0 ? Math.round((totalCorr / simRespostas.length) * 100) : 0,
          tempo_mediano_segundos: median(simTempos),
          tempo_medio_segundos: simTempos.length > 0 ? simTempos.reduce((a, b) => a + b, 0) / simTempos.length : 0,
          saidas_aba_media: simSaidasAba.length > 0 ? simSaidasAba.reduce((a, b) => a + b, 0) / simSaidasAba.length : 0,
          saidas_fullscreen_media: simSaidasFs.length > 0 ? simSaidasFs.reduce((a, b) => a + b, 0) / simSaidasFs.length : 0,
          tentativas_media: simTentativas.length > 0 ? simTentativas.reduce((a, b) => a + b, 0) / simTentativas.length : 0,
          questoes_anuladas: simQuestoes.filter(q => q.anulada).length,
        };
      });

      // ============== PROBLEMATIC QUESTIONS ==============
      const questaoStats = new Map<string, { corretas: number; total: number; respostasAlternativa: Map<string, number> }>();
      respostas.forEach(r => {
        const existing = questaoStats.get(r.question_id) || { 
          corretas: 0, 
          total: 0, 
          respostasAlternativa: new Map() 
        };
        questaoStats.set(r.question_id, {
          corretas: existing.corretas + (r.correct ? 1 : 0),
          total: existing.total + 1,
          respostasAlternativa: existing.respostasAlternativa,
        });
      });

      const questoesProblematicas: QuestaoProblematica[] = Array.from(questaoStats.entries())
        .filter(([_, stats]) => stats.total >= 5 && ((stats.total - stats.corretas) / stats.total) >= 0.5)
        .sort((a, b) => {
          const taxaA = (a[1].total - a[1].corretas) / a[1].total;
          const taxaB = (b[1].total - b[1].corretas) / b[1].total;
          return taxaB - taxaA;
        })
        .slice(0, 20)
        .map(([id, stats]) => {
          const q = questaoMap.get(id);
          return {
            id,
            enunciado: q?.enunciado || 'Enunciado indisponível',
            grande_area: q?.grande_area || null,
            especialidade: q?.especialidade || null,
            tema: q?.tema || null,
            dificuldade: q?.grau_dificuldade || null,
            taxa_erro: Math.round(((stats.total - stats.corretas) / stats.total) * 100),
            n_respostas: stats.total,
            anulada: q?.anulada || false,
            distribuicao: [], // TODO: fetch detailed distribution
            comentario: q?.comentario || null,
          };
        });

      // ============== BEHAVIOR METRICS ==============
      const simuladosComFriccaoAlta = simuladosOverview
        .filter(s => s.saidas_aba_media > 2 || s.saidas_fullscreen_media > 1)
        .map(s => s.nome);

      const comportamento: ComportamentoMetrics = {
        saidasAbaMedia: saidasAba.length > 0 ? saidasAba.reduce((a, b) => a + b, 0) / saidasAba.length : 0,
        saidasAbaP95: percentile(saidasAba, 95),
        saidasFullscreenMedia: saidasFullscreen.length > 0 ? saidasFullscreen.reduce((a, b) => a + b, 0) / saidasFullscreen.length : 0,
        saidasFullscreenP95: percentile(saidasFullscreen, 95),
        tempoMedioPorQuestao: null, // Would need totalQuestoes per finalized
        abandono: {
          totalIniciados: uniqueIniciados.size,
          totalFinalizados: uniqueFinalizados.size,
          taxaAbandono: uniqueIniciados.size > 0 
            ? Math.round(((uniqueIniciados.size - uniqueFinalizados.size) / uniqueIniciados.size) * 100)
            : 0,
        },
        liberadoNovamente: {
          count: liberadosNovamente,
          percent: finalizados.length > 0 ? Math.round((liberadosNovamente / finalizados.length) * 100) : 0,
        },
        simuladosComFriccaoAlta,
      };

      // ============== SET DATA ==============
      setData({
        executive: {
          simuladosAtivos: relevantSimulados.filter(s => s.status === 'ativo').length,
          alunosIniciaram: uniqueIniciados.size,
          alunosConcluiram: uniqueFinalizados.size,
          taxaConclusao,
          deltaConclusaoPeriodoAnterior: null, // TODO: compare with previous period
          acuraciaMedia,
          tempoMedianoMinutos: Math.round(tempoMediano / 60),
          tempoMedioMinutos: Math.round(tempoMedio / 60),
          saidasAbaMediana: median(saidasAba),
          saidasFullscreenMediana: median(saidasFullscreen),
          tentativasMedia: tentativas.length > 0 ? tentativas.reduce((a, b) => a + b, 0) / tentativas.length : 0,
          percentLiberadoNovamente: finalizados.length > 0 ? Math.round((liberadosNovamente / finalizados.length) * 100) : 0,
          totalRespostas,
        },
        temporal: {
          inicioPorDia: Array.from(inicioPorDiaMap.entries())
            .map(([data, count]) => ({ data, count }))
            .sort((a, b) => a.data.localeCompare(b.data)),
          conclusaoPorDia: Array.from(conclusaoPorDiaMap.entries())
            .map(([data, count]) => ({ data, count }))
            .sort((a, b) => a.data.localeCompare(b.data)),
          acuraciaPorDia: [], // TODO: implement if needed
          tempoPorDia: [], // TODO: implement if needed
          heatmapHorario: Array.from(heatmapMap.entries())
            .map(([key, count]) => {
              const [hora, dia] = key.split('-').map(Number);
              return { hora, dia, count };
            }),
        },
        segmentacaoIES,
        segmentacaoSemestre,
        segmentacaoArea,
        segmentacaoEspecialidade,
        segmentacaoTema,
        segmentacaoDificuldade,
        simulados: simuladosOverview,
        questoesProblematicas,
        comportamento,
        isLoading: false,
        error: null,
      });

    } catch (err) {
      console.error('[useSimuladosAnalytics] Error:', err);
      setData(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: err instanceof Error ? err.message : 'Erro ao carregar dados' 
      }));
    }
  }, [filterParams, fetchUserIdsByIES, fetchUserIdsExcludingIES]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    refetch: fetchData,
  };
}
