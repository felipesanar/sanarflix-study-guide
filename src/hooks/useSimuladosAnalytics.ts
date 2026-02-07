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

  const fetchData = useCallback(async () => {
    console.log('[useSimuladosAnalytics][Simulados] Fetching with filters:', filterParams);
    setData(prev => ({ ...prev, isLoading: true, error: null }));

    const chunk = <T,>(arr: T[], size: number) => {
      const res: T[][] = [];
      for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
      return res;
    };

    const fetchUsersByIds = async (ids: string[]) => {
      if (ids.length === 0) return [] as { id: string; id_ies: string | null; semestre: number | null }[];
      const parts = chunk(ids, 500);
      const results = await Promise.all(
        parts.map(async (p) => {
          const { data, error } = await supabase
            .from('users')
            .select('id, id_ies, semestre')
            .in('id', p);
          if (error) throw error;
          return data || [];
        })
      );
      return results.flat();
    };

    const fetchAllAnswerProgress = async (params: {
      userIds: string[];
      simuladoIds: string[];
    }) => {
      const { userIds, simuladoIds } = params;
      if (userIds.length === 0 || simuladoIds.length === 0) {
        return [] as { question_id: string; correct: boolean; user_id: string; simulado: string }[];
      }

      const PAGE_SIZE = 1000;
      const all: { question_id: string; correct: boolean; user_id: string; simulado: string }[] = [];
      let from = 0;

      while (true) {
        const { data: page, error } = await supabase
          .from('answer_progress')
          .select('question_id, correct, user_id, simulado')
          .in('user_id', userIds)
          .in('simulado', simuladoIds)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const rows = page || [];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return all;
    };

    const fetchHistoricoByFinalizacoes = async (finalizacaoIds: string[]) => {
      if (finalizacaoIds.length === 0) {
        return [] as { question_id: string; correct: boolean; user_id: string; simulado: string }[];
      }

      // historico is typically small, but still paginate for safety
      const PAGE_SIZE = 1000;
      const all: { question_id: string; correct: boolean; user_id: string; simulado: string }[] = [];
      let from = 0;

      while (true) {
        const { data: page, error } = await supabase
          .from('answer_progress_historico')
          .select('question_id, correct, user_id, simulado, finalizacao_original_id')
          .in('finalizacao_original_id', finalizacaoIds)
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        const rows = (page || []).map(r => ({
          question_id: r.question_id,
          correct: r.correct,
          user_id: r.user_id,
          simulado: r.simulado,
        }));
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return all;
    };

    try {
      const { startDate, endDate, iesId, excludedIES, simuladoId, semestre } = filterParams;

      // Fetch base data in parallel (all under 1000 rows)
      const [simuladosAdminRes, iniciadosRes, finalizadosRes, questoesRes, iesRes] = await Promise.all([
        iesId
          ? supabase.from('simulados_admin').select('*').contains('ies_ids', [iesId])
          : supabase.from('simulados_admin').select('*'),
        supabase
          .from('simulados_iniciados')
          .select('simulado_id, user_id, started_at')
          .gte('started_at', startDate)
          .lte('started_at', endDate),
        supabase
          .from('simulados_finalizados')
          .select('id, simulado_id, user_id, finalizado_em, tempo_total_segundos, saidas_de_aba, saidas_de_fullscreen, tentativa_numero, liberado_novamente')
          .gte('finalizado_em', startDate)
          .lte('finalizado_em', endDate),
        supabase
          .from('questoes_simulado')
          .select('id, simulado_id, enunciado, grande_area, especialidade, tema, grau_dificuldade, anulada, comentario, alternativa_a, alternativa_b, alternativa_c, alternativa_d'),
        supabase.from('ies').select('id, nome'),
      ]);

      const simuladosAdmin = simuladosAdminRes.data || [];
      let iniciados = iniciadosRes.data || [];
      let finalizados = finalizadosRes.data || [];
      const questoes = questoesRes.data || [];
      const iesList = iesRes.data || [];

      // Apply simulado filter early
      if (simuladoId) {
        iniciados = iniciados.filter(i => i.simulado_id === simuladoId);
        finalizados = finalizados.filter(f => f.simulado_id === simuladoId);
      }

      // Filter simulados by IES (config)
      const relevantSimulados = iesId
        ? simuladosAdmin.filter(s => s.ies_ids?.includes(iesId))
        : simuladosAdmin;
      const simuladoIds = new Set(relevantSimulados.map(s => s.id));

      iniciados = iniciados.filter(i => simuladoIds.has(i.simulado_id));
      finalizados = finalizados.filter(f => simuladoIds.has(f.simulado_id));

      // Fetch only users involved in this period (avoid 1000 row limit)
      const eventUserIds = Array.from(
        new Set([...iniciados.map(i => i.user_id), ...finalizados.map(f => f.user_id)])
      );
      const users = await fetchUsersByIds(eventUserIds);

      const iesMap = new Map(iesList.map(i => [i.id, i.nome] as const));
      const userById = new Map(users.map(u => [u.id, u] as const));
      const userIesMap = new Map(users.map(u => [u.id, u.id_ies] as const));
      const userSemestreMap = new Map(users.map(u => [u.id, u.semestre] as const));
      const questaoMap = new Map(questoes.map(q => [q.id, q] as const));

      // Apply user-based filters (IES, excludedIES, semestre)
      const allowedUserIds = new Set(
        eventUserIds.filter(uid => {
          const u = userById.get(uid);
          if (!u) return false;
          if (iesId && u.id_ies !== iesId) return false;
          if (excludedIES?.length > 0 && u.id_ies && excludedIES.includes(u.id_ies)) return false;
          if (semestre && u.semestre !== semestre) return false;
          return true;
        })
      );

      iniciados = iniciados.filter(i => allowedUserIds.has(i.user_id));
      finalizados = finalizados.filter(f => allowedUserIds.has(f.user_id));

      // CRITICAL: answer_progress has no timestamp. We scope respostas to (user_id, simulado_id) pairs that finalized in the selected period.
      const finalizadosNoPeriodo = new Set(finalizados.map(f => `${f.user_id}_${f.simulado_id}`));
      const finalizadoUserIds = Array.from(new Set(finalizados.map(f => f.user_id)));
      const simuladoIdsArray = Array.from(simuladoIds);

      // Fetch ALL respostas for the in-scope users/simulados (paginate to bypass Supabase 1000 limit)
      const respostasRaw = await fetchAllAnswerProgress({
        userIds: finalizadoUserIds,
        simuladoIds: simuladoIdsArray,
      });

      let respostas = respostasRaw.filter(r => finalizadosNoPeriodo.has(`${r.user_id}_${r.simulado}`));

      // Include historical attempts that were archived but whose finalization is inside the selected period
      const historico = await fetchHistoricoByFinalizacoes(finalizados.map(f => f.id));
      const historicoFiltrado = historico.filter(r => finalizadosNoPeriodo.has(`${r.user_id}_${r.simulado}`));
      respostas = [...respostas, ...historicoFiltrado];

      console.log('[useSimuladosAnalytics][Simulados] counts', {
        relevantSimulados: relevantSimulados.length,
        iniciados: iniciados.length,
        finalizados: finalizados.length,
        eventUsers: eventUserIds.length,
        allowedUsers: allowedUserIds.size,
        respostasRaw: respostasRaw.length,
        respostasInScope: respostas.length,
        historicoInScope: historicoFiltrado.length,
      });

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
          respostasAlternativa: new Map(),
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
            distribuicao: [],
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
        tempoMedioPorQuestao: null,
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
          deltaConclusaoPeriodoAnterior: null,
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
          acuraciaPorDia: [],
          tempoPorDia: [],
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
      console.error('[useSimuladosAnalytics][Simulados] Error:', err);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erro ao carregar dados',
      }));
    }
  }, [filterParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    refetch: fetchData,
  };
}
