import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';

// Tipos para dados de analytics
export interface OverviewMetrics {
  totalUsuarios: number;
  usuariosAtivosHoje: number;
  usuariosAtivos7Dias: number;
  sessoesHoje: number;
  mediaTempoSessao: number;
  pageViewsHoje: number;
  simuladosIniciadosHoje: number;
  simuladosFinalizadosHoje: number;
  sanarclassViewsHoje: number;
  taxaAbandonoSimulados: number;
}

export interface EngagementMetrics {
  sessoesPorDia: { data: string; sessoes: number; duracao_media: number }[];
  pageViewsPorPagina: { pagina: string; views: number }[];
  horariosPico: { hora: number; acessos: number }[];
  dispositivosMobile: number;
  dispositivosDesktop: number;
}

export interface ProgressMetrics {
  progressoMedioPorMateria: { materia: string; progresso: number; total_itens: number }[];
  usuariosPorFaixaProgresso: { faixa: string; quantidade: number }[];
  taxaConclusaoConteudo: number;
}

export interface DemographicsMetrics {
  usuariosPorIES: { ies_nome: string; ies_id: string; quantidade: number }[];
  usuariosPorSemestre: { semestre: string; quantidade: number }[];
}

export interface SimuladoMetrics {
  simuladosDisponiveis: { id: string; nome: string; total_questoes: number; iniciados: number; finalizados: number; taxa_conclusao: number }[];
  desempenhoGeral: { media_acertos: number; total_respostas: number };
  questoesProblematicas: { questao_id: string; enunciado: string; taxa_erro: number }[];
}

export interface TrackingHealth {
  tabela: string;
  ultimos7dias: number;
  status: 'ok' | 'baixo' | 'critico';
}

export interface AnalyticsData {
  overview: OverviewMetrics;
  engagement: EngagementMetrics;
  progress: ProgressMetrics;
  demographics: DemographicsMetrics;
  simulados: SimuladoMetrics;
  trackingHealth: TrackingHealth[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsFiltersState {
  dateRange: DateRange;
  iesId: string;
}

const defaultMetrics: AnalyticsData = {
  overview: {
    totalUsuarios: 0,
    usuariosAtivosHoje: 0,
    usuariosAtivos7Dias: 0,
    sessoesHoje: 0,
    mediaTempoSessao: 0,
    pageViewsHoje: 0,
    simuladosIniciadosHoje: 0,
    simuladosFinalizadosHoje: 0,
    sanarclassViewsHoje: 0,
    taxaAbandonoSimulados: 0,
  },
  engagement: {
    sessoesPorDia: [],
    pageViewsPorPagina: [],
    horariosPico: [],
    dispositivosMobile: 0,
    dispositivosDesktop: 0,
  },
  progress: {
    progressoMedioPorMateria: [],
    usuariosPorFaixaProgresso: [],
    taxaConclusaoConteudo: 0,
  },
  demographics: {
    usuariosPorIES: [],
    usuariosPorSemestre: [],
  },
  simulados: {
    simuladosDisponiveis: [],
    desempenhoGeral: { media_acertos: 0, total_respostas: 0 },
    questoesProblematicas: [],
  },
  trackingHealth: [],
  isLoading: true,
  error: null,
  lastUpdated: null,
};

// Helper para obter data de hoje em formato ISO (Brazil timezone)
const getTodayBrazilISO = (): string => {
  const brazilDate = getBrazilDate();
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para obter data de N dias atrás em formato ISO (Brazil timezone)
const getDaysAgoBrazilISO = (days: number): string => {
  const brazilDate = getBrazilDate();
  brazilDate.setDate(brazilDate.getDate() - days);
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para determinar status de saúde
const getHealthStatus = (count: number): 'ok' | 'baixo' | 'critico' => {
  if (count < 5) return 'critico';
  if (count < 50) return 'baixo';
  return 'ok';
};

export function useAnalyticsData(filters: AnalyticsFiltersState) {
  const [data, setData] = useState<AnalyticsData>(defaultMetrics);

  // Memoizar valores derivados dos filtros para evitar recálculos
  const filterParams = useMemo(() => {
    const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;
    const startDate = filters.dateRange.start.toISOString();
    const endDate = filters.dateRange.end.toISOString();
    const hoje = getTodayBrazilISO();
    const seteDiasAtras = getDaysAgoBrazilISO(7);
    
    return { iesFilter, startDate, endDate, hoje, seteDiasAtras };
  }, [filters.iesId, filters.dateRange.start, filters.dateRange.end]);

  // Cache de user IDs por IES para reutilizar entre queries
  const fetchUserIdsByIES = useCallback(async (iesId: string): Promise<string[]> => {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('id_ies', iesId);
    return users?.map(u => u.id) || [];
  }, []);

  const fetchOverviewMetrics = useCallback(async (): Promise<OverviewMetrics> => {
    const { iesFilter, startDate, endDate, hoje, seteDiasAtras } = filterParams;

    console.log('[Analytics] fetchOverviewMetrics:', { iesFilter, startDate, endDate });

    // Buscar user IDs da IES filtrada (se aplicável)
    let userIdsFromIES: string[] | null = null;
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter);
      if (userIdsFromIES.length === 0) {
        // IES sem usuários - retornar zeros
        return {
          totalUsuarios: 0,
          usuariosAtivosHoje: 0,
          usuariosAtivos7Dias: 0,
          sessoesHoje: 0,
          mediaTempoSessao: 0,
          pageViewsHoje: 0,
          simuladosIniciadosHoje: 0,
          simuladosFinalizadosHoje: 0,
          sanarclassViewsHoje: 0,
          taxaAbandonoSimulados: 0,
        };
      }
    }

    // PARALLEL: Executar todas as queries em paralelo
    const [
      totalUsuariosResult,
      sessoesHojeResult,
      usuariosAtivosHojeResult,
      usuariosAtivos7DiasResult,
      sessoesDuracaoResult,
      pageViewsHojeResult,
      simuladosIniciadosHojeResult,
      simuladosFinalizadosHojeResult,
      sanarclassViewsHojeResult,
      taxaAbandonoResult
    ] = await Promise.all([
      // 1. Total de usuários
      iesFilter
        ? supabase.from('users').select('*', { count: 'exact', head: true }).eq('id_ies', iesFilter)
        : supabase.from('users').select('*', { count: 'exact', head: true }),

      // 2. Sessões de hoje
      iesFilter
        ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', hoje).eq('ies_id', iesFilter)
        : supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', hoje),

      // 3. Usuários ativos hoje
      iesFilter
        ? supabase.from('user_sessions').select('user_id').gte('started_at', hoje).eq('ies_id', iesFilter)
        : supabase.from('user_sessions').select('user_id').gte('started_at', hoje),

      // 4. Usuários ativos 7 dias
      iesFilter
        ? supabase.from('user_sessions').select('user_id').gte('started_at', seteDiasAtras).eq('ies_id', iesFilter)
        : supabase.from('user_sessions').select('user_id').gte('started_at', seteDiasAtras),

      // 5. Duração média de sessão (no dateRange)
      iesFilter
        ? supabase.from('user_sessions').select('duration_seconds').not('duration_seconds', 'is', null).gte('started_at', startDate).lte('started_at', endDate).eq('ies_id', iesFilter)
        : supabase.from('user_sessions').select('duration_seconds').not('duration_seconds', 'is', null).gte('started_at', startDate).lte('started_at', endDate),

      // 6. Page views de hoje
      iesFilter
        ? supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje).eq('ies_id', iesFilter)
        : supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje),

      // 7. Simulados iniciados hoje (filtrar por user_id se IES)
      iesFilter && userIdsFromIES
        ? supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', hoje).in('user_id', userIdsFromIES)
        : supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', hoje),

      // 8. Simulados finalizados hoje
      iesFilter && userIdsFromIES
        ? supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', hoje).in('user_id', userIdsFromIES)
        : supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', hoje),

      // 9. SanarClass views hoje (não tem ies_id, usar join via user_id)
      iesFilter && userIdsFromIES
        ? supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje).in('user_id', userIdsFromIES)
        : supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje),

      // 10. Taxa de abandono (no dateRange)
      Promise.all([
        iesFilter && userIdsFromIES
          ? supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
          : supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate),
        iesFilter && userIdsFromIES
          ? supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', startDate).lte('finalizado_em', endDate).in('user_id', userIdsFromIES)
          : supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', startDate).lte('finalizado_em', endDate)
      ])
    ]);

    // Processar resultados
    const totalUsuarios = totalUsuariosResult.count || 0;
    const sessoesHoje = sessoesHojeResult.count || 0;
    const usuariosAtivosHoje = new Set(usuariosAtivosHojeResult.data?.map(s => s.user_id) || []).size;
    const usuariosAtivos7Dias = new Set(usuariosAtivos7DiasResult.data?.map(s => s.user_id) || []).size;
    
    const sessoesDuracao = sessoesDuracaoResult.data || [];
    const mediaTempoSessao = sessoesDuracao.length
      ? Math.round((sessoesDuracao.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / sessoesDuracao.length / 60) * 10) / 10
      : 0;

    const pageViewsHoje = pageViewsHojeResult.count || 0;
    const simuladosIniciadosHoje = simuladosIniciadosHojeResult.count || 0;
    const simuladosFinalizadosHoje = simuladosFinalizadosHojeResult.count || 0;
    const sanarclassViewsHoje = sanarclassViewsHojeResult.count || 0;

    const [iniciadosRangeResult, finalizadosRangeResult] = taxaAbandonoResult;
    const totalIniciados = iniciadosRangeResult.count || 0;
    const totalFinalizados = finalizadosRangeResult.count || 0;
    const taxaAbandonoSimulados = totalIniciados > 0
      ? Math.round(((totalIniciados - totalFinalizados) / totalIniciados) * 100)
      : 0;

    return {
      totalUsuarios,
      usuariosAtivosHoje,
      usuariosAtivos7Dias,
      sessoesHoje,
      mediaTempoSessao,
      pageViewsHoje,
      simuladosIniciadosHoje,
      simuladosFinalizadosHoje,
      sanarclassViewsHoje,
      taxaAbandonoSimulados,
    };
  }, [filterParams, fetchUserIdsByIES]);

  const fetchEngagementMetrics = useCallback(async (): Promise<EngagementMetrics> => {
    const { iesFilter, startDate, endDate } = filterParams;

    console.log('[Analytics] fetchEngagementMetrics:', { iesFilter, startDate, endDate });

    // PARALLEL: Buscar sessões e page views em paralelo
    const [sessoesResult, pageViewsResult] = await Promise.all([
      iesFilter
        ? supabase.from('user_sessions').select('started_at, duration_seconds, is_mobile').gte('started_at', startDate).lte('started_at', endDate).eq('ies_id', iesFilter).order('started_at', { ascending: true })
        : supabase.from('user_sessions').select('started_at, duration_seconds, is_mobile').gte('started_at', startDate).lte('started_at', endDate).order('started_at', { ascending: true }),
      
      iesFilter
        ? supabase.from('page_views').select('page_path').gte('created_at', startDate).lte('created_at', endDate).eq('ies_id', iesFilter)
        : supabase.from('page_views').select('page_path').gte('created_at', startDate).lte('created_at', endDate)
    ]);

    const sessoesBrutas = sessoesResult.data || [];
    const pageViewsBrutas = pageViewsResult.data || [];

    // Processar sessões por dia (timezone Brasil)
    const sessoesPorDiaMap = new Map<string, { count: number; totalDuration: number }>();
    const horarioMap = new Map<number, number>();
    let dispositivosMobile = 0;
    let dispositivosDesktop = 0;

    sessoesBrutas.forEach((s) => {
      const brazilDate = toBrazilDate(s.started_at);
      const dia = `${brazilDate.getFullYear()}-${String(brazilDate.getMonth() + 1).padStart(2, '0')}-${String(brazilDate.getDate()).padStart(2, '0')}`;
      const hora = brazilDate.getHours();

      // Por dia
      const existing = sessoesPorDiaMap.get(dia) || { count: 0, totalDuration: 0 };
      sessoesPorDiaMap.set(dia, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + (s.duration_seconds || 0),
      });

      // Por hora
      horarioMap.set(hora, (horarioMap.get(hora) || 0) + 1);

      // Dispositivos
      if (s.is_mobile) {
        dispositivosMobile++;
      } else {
        dispositivosDesktop++;
      }
    });

    const sessoesPorDia = Array.from(sessoesPorDiaMap.entries()).map(([data, vals]) => ({
      data,
      sessoes: vals.count,
      duracao_media: vals.count > 0 ? Math.round(vals.totalDuration / vals.count / 60) : 0,
    }));

    // Processar page views
    const pageViewsMap = new Map<string, number>();
    pageViewsBrutas.forEach((pv) => {
      pageViewsMap.set(pv.page_path, (pageViewsMap.get(pv.page_path) || 0) + 1);
    });

    const pageViewsPorPagina = Array.from(pageViewsMap.entries())
      .map(([pagina, views]) => ({ pagina, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const horariosPico = Array.from(horarioMap.entries())
      .map(([hora, acessos]) => ({ hora, acessos }))
      .sort((a, b) => a.hora - b.hora);

    return {
      sessoesPorDia,
      pageViewsPorPagina,
      horariosPico,
      dispositivosMobile,
      dispositivosDesktop,
    };
  }, [filterParams]);

  const fetchProgressMetrics = useCallback(async (): Promise<ProgressMetrics> => {
    const { iesFilter } = filterParams;

    console.log('[Analytics] fetchProgressMetrics:', { iesFilter });

    // Se tiver filtro de IES, buscar nome para filtrar study_progress
    let iesNome: string | null = null;
    if (iesFilter) {
      const { data: iesData } = await supabase.from('ies').select('nome').eq('id', iesFilter).maybeSingle();
      iesNome = iesData?.nome || null;
    }

    // Buscar progresso (com filtro de IES pelo ies_nome)
    const progressoQuery = iesNome
      ? supabase.from('study_progress').select('materia_id, completed, user_id, ies_nome').eq('ies_nome', iesNome)
      : supabase.from('study_progress').select('materia_id, completed, user_id, ies_nome');

    const { data: progressoBruto } = await progressoQuery;

    // Processar por matéria
    const materiaMap = new Map<string, { completed: number; total: number }>();
    const userProgressMap = new Map<string, { completed: number; total: number }>();

    progressoBruto?.forEach((p) => {
      // Por matéria
      const materiaStats = materiaMap.get(p.materia_id) || { completed: 0, total: 0 };
      materiaMap.set(p.materia_id, {
        completed: materiaStats.completed + (p.completed ? 1 : 0),
        total: materiaStats.total + 1,
      });

      // Por usuário
      const userStats = userProgressMap.get(p.user_id) || { completed: 0, total: 0 };
      userProgressMap.set(p.user_id, {
        completed: userStats.completed + (p.completed ? 1 : 0),
        total: userStats.total + 1,
      });
    });

    const progressoMedioPorMateria = Array.from(materiaMap.entries())
      .map(([materia, vals]) => ({
        materia,
        progresso: vals.total > 0 ? Math.round((vals.completed / vals.total) * 100) : 0,
        total_itens: vals.total,
      }))
      .sort((a, b) => b.progresso - a.progresso)
      .slice(0, 10);

    // Faixas de progresso
    const faixas = { '0-25%': 0, '25-50%': 0, '50-75%': 0, '75-100%': 0 };
    userProgressMap.forEach((vals) => {
      const pct = vals.total > 0 ? (vals.completed / vals.total) * 100 : 0;
      if (pct <= 25) faixas['0-25%']++;
      else if (pct <= 50) faixas['25-50%']++;
      else if (pct <= 75) faixas['50-75%']++;
      else faixas['75-100%']++;
    });

    const usuariosPorFaixaProgresso = Object.entries(faixas).map(([faixa, quantidade]) => ({
      faixa,
      quantidade,
    }));

    // Taxa de conclusão geral
    const totalItens = progressoBruto?.length || 0;
    const totalConcluidos = progressoBruto?.filter(p => p.completed).length || 0;
    const taxaConclusaoConteudo = totalItens > 0 ? Math.round((totalConcluidos / totalItens) * 100) : 0;

    return {
      progressoMedioPorMateria,
      usuariosPorFaixaProgresso,
      taxaConclusaoConteudo,
    };
  }, [filterParams]);

  const fetchDemographicsMetrics = useCallback(async (): Promise<DemographicsMetrics> => {
    const { iesFilter } = filterParams;

    console.log('[Analytics] fetchDemographicsMetrics:', { iesFilter });

    // PARALLEL: Buscar usuários e IES em paralelo
    const [usuariosResult, iesResult] = await Promise.all([
      iesFilter
        ? supabase.from('users').select('id_ies, semestre').eq('id_ies', iesFilter)
        : supabase.from('users').select('id_ies, semestre'),
      supabase.from('ies').select('id, nome')
    ]);

    const usuariosData = usuariosResult.data || [];
    const iesData = iesResult.data || [];
    const iesMap = new Map(iesData.map(i => [i.id, i.nome]));

    const usuariosPorIESMap = new Map<string, number>();
    const usuariosPorSemestreMap = new Map<number, number>();

    usuariosData.forEach((u) => {
      if (u.id_ies) {
        usuariosPorIESMap.set(u.id_ies, (usuariosPorIESMap.get(u.id_ies) || 0) + 1);
      }
      const semestre = u.semestre ?? 0;
      usuariosPorSemestreMap.set(semestre, (usuariosPorSemestreMap.get(semestre) || 0) + 1);
    });

    const usuariosPorIES = Array.from(usuariosPorIESMap.entries())
      .map(([ies_id, quantidade]) => ({
        ies_id,
        ies_nome: iesMap.get(ies_id) || 'Desconhecida',
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // Tratar semestre 0 como "Não informado"
    const usuariosPorSemestre = Array.from(usuariosPorSemestreMap.entries())
      .map(([semestre, quantidade]) => ({ 
        semestre: semestre === 0 ? 'Não informado' : `${semestre}º`,
        quantidade 
      }))
      .sort((a, b) => {
        if (a.semestre === 'Não informado') return 1;
        if (b.semestre === 'Não informado') return -1;
        return parseInt(a.semestre) - parseInt(b.semestre);
      });

    return {
      usuariosPorIES,
      usuariosPorSemestre,
    };
  }, [filterParams]);

  const fetchSimuladoMetrics = useCallback(async (): Promise<SimuladoMetrics> => {
    const { iesFilter, startDate, endDate } = filterParams;

    console.log('[Analytics] fetchSimuladoMetrics:', { iesFilter, startDate, endDate });

    // Buscar user IDs da IES filtrada (se aplicável)
    let userIdsFromIES: string[] | null = null;
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter);
    }

    // PARALLEL: Buscar dados base
    // Simulados filtrados por IES (ies_ids é um array de UUIDs)
    const simuladosQuery = iesFilter
      ? supabase.from('simulados_admin').select('id, nome').contains('ies_ids', [iesFilter])
      : supabase.from('simulados_admin').select('id, nome');

    const [simuladosResult, iniciadosResult, finalizadosResult, respostasResult] = await Promise.all([
      simuladosQuery,
      // Iniciados no dateRange (com filtro IES)
      userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('simulados_iniciados').select('simulado_id').gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
        : supabase.from('simulados_iniciados').select('simulado_id').gte('started_at', startDate).lte('started_at', endDate),
      // Finalizados no dateRange (com filtro IES)
      userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('simulados_finalizados').select('simulado_id').gte('finalizado_em', startDate).lte('finalizado_em', endDate).in('user_id', userIdsFromIES)
        : supabase.from('simulados_finalizados').select('simulado_id').gte('finalizado_em', startDate).lte('finalizado_em', endDate),
      // Respostas (com filtro IES)
      userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('answer_progress').select('question_id, correct, user_id').in('user_id', userIdsFromIES)
        : supabase.from('answer_progress').select('question_id, correct, user_id')
    ]);

    // Buscar questões apenas dos simulados filtrados
    const simuladoIds = simuladosResult.data?.map(s => s.id) || [];
    const questoesResult = simuladoIds.length > 0
      ? await supabase.from('questoes_simulado').select('simulado_id').in('simulado_id', simuladoIds)
      : { data: [] };

    // Processar contagens
    const questoesPorSimulado = new Map<string, number>();
    questoesResult.data?.forEach((q) => {
      questoesPorSimulado.set(q.simulado_id, (questoesPorSimulado.get(q.simulado_id) || 0) + 1);
    });

    const iniciadosPorSimulado = new Map<string, number>();
    iniciadosResult.data?.forEach((i) => {
      iniciadosPorSimulado.set(i.simulado_id, (iniciadosPorSimulado.get(i.simulado_id) || 0) + 1);
    });

    const finalizadosPorSimulado = new Map<string, number>();
    finalizadosResult.data?.forEach((f) => {
      finalizadosPorSimulado.set(f.simulado_id, (finalizadosPorSimulado.get(f.simulado_id) || 0) + 1);
    });

    const simuladosDisponiveis = simuladosResult.data?.map((s) => {
      const iniciados = iniciadosPorSimulado.get(s.id) || 0;
      const finalizados = finalizadosPorSimulado.get(s.id) || 0;
      return {
        id: s.id,
        nome: s.nome,
        total_questoes: questoesPorSimulado.get(s.id) || 0,
        iniciados,
        finalizados,
        taxa_conclusao: iniciados > 0 ? Math.round((finalizados / iniciados) * 100) : 0,
      };
    }) || [];

    // Desempenho geral
    const respostasData = respostasResult.data || [];
    const totalRespostas = respostasData.length;
    const totalCorretas = respostasData.filter(r => r.correct).length;
    const mediaAcertos = totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0;

    // Questões problemáticas
    const questaoStats = new Map<string, { corretas: number; total: number }>();
    respostasData.forEach((r) => {
      const existing = questaoStats.get(r.question_id) || { corretas: 0, total: 0 };
      questaoStats.set(r.question_id, {
        corretas: existing.corretas + (r.correct ? 1 : 0),
        total: existing.total + 1,
      });
    });

    // Filtrar questões com taxa de erro >= 50%
    const questoesProblematicasIds = Array.from(questaoStats.entries())
      .filter(([_, stats]) => stats.total > 0 && ((stats.total - stats.corretas) / stats.total) >= 0.5)
      .sort((a, b) => {
        const taxaA = (a[1].total - a[1].corretas) / a[1].total;
        const taxaB = (b[1].total - b[1].corretas) / b[1].total;
        return taxaB - taxaA;
      })
      .slice(0, 10)
      .map(([id]) => id);

    let questoesProblematicas: { questao_id: string; enunciado: string; taxa_erro: number }[] = [];

    if (questoesProblematicasIds.length > 0) {
      const { data: questoesEnunciados } = await supabase
        .from('questoes_simulado')
        .select('id, enunciado')
        .in('id', questoesProblematicasIds);

      const enunciadoMap = new Map(questoesEnunciados?.map(q => [q.id, q.enunciado]) || []);

      questoesProblematicas = questoesProblematicasIds.map(id => {
        const stats = questaoStats.get(id)!;
        const enunciadoCompleto = enunciadoMap.get(id) || 'Enunciado indisponível';
        const enunciadoTruncado = enunciadoCompleto.length > 80 
          ? enunciadoCompleto.slice(0, 80) + '...' 
          : enunciadoCompleto;
        
        return {
          questao_id: id,
          enunciado: enunciadoTruncado,
          taxa_erro: stats.total > 0 ? Math.round(((stats.total - stats.corretas) / stats.total) * 100) : 0,
        };
      });
    }

    return {
      simuladosDisponiveis,
      desempenhoGeral: {
        media_acertos: mediaAcertos,
        total_respostas: totalRespostas,
      },
      questoesProblematicas,
    };
  }, [filterParams, fetchUserIdsByIES]);

  const fetchTrackingHealth = useCallback(async (): Promise<TrackingHealth[]> => {
    const { seteDiasAtras, iesFilter } = filterParams;

    console.log('[Analytics] fetchTrackingHealth:', { seteDiasAtras, iesFilter });

    // Buscar user IDs da IES se filtrado
    let userIdsFromIES: string[] | null = null;
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter);
    }

    // PARALLEL: Todas as contagens em paralelo
    const [
      sessionsResult,
      pageViewsResult,
      eventsResult,
      studyResult,
      aulaResult,
      sanarResult
    ] = await Promise.all([
      // user_sessions
      iesFilter
        ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', seteDiasAtras).eq('ies_id', iesFilter)
        : supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', seteDiasAtras),
      
      // page_views
      iesFilter
        ? supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).eq('ies_id', iesFilter)
        : supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // analytics_events
      iesFilter
        ? supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).eq('ies_id', iesFilter)
        : supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // study_progress (filtra por user_id)
      userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('study_progress').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
        : supabase.from('study_progress').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // aula_views (filtra por user_id)
      userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('aula_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
        : supabase.from('aula_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // sanarclass_views (filtra por user_id)
      userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
        : supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras)
    ]);

    return [
      { tabela: 'user_sessions', ultimos7dias: sessionsResult.count || 0, status: getHealthStatus(sessionsResult.count || 0) },
      { tabela: 'page_views', ultimos7dias: pageViewsResult.count || 0, status: getHealthStatus(pageViewsResult.count || 0) },
      { tabela: 'analytics_events', ultimos7dias: eventsResult.count || 0, status: getHealthStatus(eventsResult.count || 0) },
      { tabela: 'study_progress', ultimos7dias: studyResult.count || 0, status: getHealthStatus(studyResult.count || 0) },
      { tabela: 'aula_views', ultimos7dias: aulaResult.count || 0, status: getHealthStatus(aulaResult.count || 0) },
      { tabela: 'sanarclass_views', ultimos7dias: sanarResult.count || 0, status: getHealthStatus(sanarResult.count || 0) },
    ];
  }, [filterParams, fetchUserIdsByIES]);

  const fetchAllData = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[Analytics] Iniciando fetch com filtros:', filterParams);
      const startTime = performance.now();

      // PARALLEL: Todas as métricas em paralelo
      const [overview, engagement, progress, demographics, simulados, trackingHealth] = await Promise.all([
        fetchOverviewMetrics(),
        fetchEngagementMetrics(),
        fetchProgressMetrics(),
        fetchDemographicsMetrics(),
        fetchSimuladoMetrics(),
        fetchTrackingHealth(),
      ]);

      const endTime = performance.now();
      console.log(`[Analytics] Dados carregados em ${Math.round(endTime - startTime)}ms`);

      setData({
        overview,
        engagement,
        progress,
        demographics,
        simulados,
        trackingHealth,
        isLoading: false,
        error: null,
        lastUpdated: getBrazilDate(),
      });
    } catch (error) {
      console.error('[Analytics] Erro ao carregar dados:', error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar dados',
      }));
    }
  }, [fetchOverviewMetrics, fetchEngagementMetrics, fetchProgressMetrics, fetchDemographicsMetrics, fetchSimuladoMetrics, fetchTrackingHealth, filterParams]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refetch = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { ...data, refetch };
}
