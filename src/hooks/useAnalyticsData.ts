import { useState, useEffect, useCallback } from 'react';
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

export function useAnalyticsData(filters: AnalyticsFiltersState) {
  const [data, setData] = useState<AnalyticsData>(defaultMetrics);

  const fetchOverviewMetrics = useCallback(async (): Promise<OverviewMetrics> => {
    const hoje = getTodayBrazilISO();
    const seteDiasAtras = getDaysAgoBrazilISO(7);
    const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;
    const startDate = filters.dateRange.start.toISOString();
    const endDate = filters.dateRange.end.toISOString();

    console.log('[useAnalyticsData] fetchOverviewMetrics - filters:', { hoje, seteDiasAtras, iesFilter, startDate, endDate });

    // Total de usuários (com filtro de IES se aplicável)
    let usersQuery = supabase.from('users').select('*', { count: 'exact', head: true });
    if (iesFilter) usersQuery = usersQuery.eq('id_ies', iesFilter);
    const { count: totalUsuarios } = await usersQuery;

    // Sessões de hoje (com filtro de IES)
    let sessoesHojeQuery = supabase.from('user_sessions').select('*', { count: 'exact' }).gte('started_at', hoje);
    if (iesFilter) sessoesHojeQuery = sessoesHojeQuery.eq('ies_id', iesFilter);
    const { count: countSessoes } = await sessoesHojeQuery;

    // Usuários únicos ativos hoje (por sessões)
    let usuariosAtivosHojeQuery = supabase.from('user_sessions').select('user_id').gte('started_at', hoje);
    if (iesFilter) usuariosAtivosHojeQuery = usuariosAtivosHojeQuery.eq('ies_id', iesFilter);
    const { data: usuariosAtivosHojeData } = await usuariosAtivosHojeQuery;
    const usuariosAtivosHoje = new Set(usuariosAtivosHojeData?.map(s => s.user_id) || []).size;

    // Usuários únicos ativos últimos 7 dias
    let usuariosAtivos7DiasQuery = supabase.from('user_sessions').select('user_id').gte('started_at', seteDiasAtras);
    if (iesFilter) usuariosAtivos7DiasQuery = usuariosAtivos7DiasQuery.eq('ies_id', iesFilter);
    const { data: usuariosAtivos7DiasData } = await usuariosAtivos7DiasQuery;
    const usuariosAtivos7Dias = new Set(usuariosAtivos7DiasData?.map(s => s.user_id) || []).size;

    // Média de tempo de sessão (segundos) - dentro do dateRange
    let sessoesDuracaoQuery = supabase
      .from('user_sessions')
      .select('duration_seconds')
      .not('duration_seconds', 'is', null)
      .gte('started_at', startDate)
      .lte('started_at', endDate);
    if (iesFilter) sessoesDuracaoQuery = sessoesDuracaoQuery.eq('ies_id', iesFilter);
    const { data: sessoesDuracao } = await sessoesDuracaoQuery;
    const mediaTempoSessao = sessoesDuracao?.length
      ? sessoesDuracao.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / sessoesDuracao.length / 60
      : 0;

    // Page views de hoje
    let pageViewsHojeQuery = supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje);
    if (iesFilter) pageViewsHojeQuery = pageViewsHojeQuery.eq('ies_id', iesFilter);
    const { count: pageViewsHoje } = await pageViewsHojeQuery;

    // Simulados iniciados hoje - JOIN com users para filtrar por IES
    let simuladosIniciadosHojeCount = 0;
    if (iesFilter) {
      const { data: simIniciados } = await supabase
        .from('simulados_iniciados')
        .select('user_id')
        .gte('started_at', hoje);
      
      if (simIniciados && simIniciados.length > 0) {
        const userIds = simIniciados.map(s => s.user_id);
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('id_ies', iesFilter)
          .in('id', userIds);
        simuladosIniciadosHojeCount = count || 0;
      }
    } else {
      const { count } = await supabase
        .from('simulados_iniciados')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', hoje);
      simuladosIniciadosHojeCount = count || 0;
    }

    // Simulados finalizados hoje
    let simuladosFinalizadosHojeCount = 0;
    if (iesFilter) {
      const { data: simFinalizados } = await supabase
        .from('simulados_finalizados')
        .select('user_id')
        .gte('finalizado_em', hoje);
      
      if (simFinalizados && simFinalizados.length > 0) {
        const userIds = simFinalizados.map(s => s.user_id);
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('id_ies', iesFilter)
          .in('id', userIds);
        simuladosFinalizadosHojeCount = count || 0;
      }
    } else {
      const { count } = await supabase
        .from('simulados_finalizados')
        .select('*', { count: 'exact', head: true })
        .gte('finalizado_em', hoje);
      simuladosFinalizadosHojeCount = count || 0;
    }

    // SanarClass views hoje
    const { count: sanarclassViewsHoje } = await supabase
      .from('sanarclass_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoje);

    // Taxa de abandono de simulados (no dateRange)
    let totalIniciadosQuery = supabase
      .from('simulados_iniciados')
      .select('user_id', { count: 'exact' })
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    let totalFinalizadosQuery = supabase
      .from('simulados_finalizados')
      .select('user_id', { count: 'exact' })
      .gte('finalizado_em', startDate)
      .lte('finalizado_em', endDate);

    const [{ count: totalIniciados }, { count: totalFinalizados }] = await Promise.all([
      totalIniciadosQuery,
      totalFinalizadosQuery
    ]);

    const taxaAbandonoSimulados = totalIniciados && totalIniciados > 0
      ? Math.round(((totalIniciados - (totalFinalizados || 0)) / totalIniciados) * 100)
      : 0;

    return {
      totalUsuarios: totalUsuarios || 0,
      usuariosAtivosHoje,
      usuariosAtivos7Dias,
      sessoesHoje: countSessoes || 0,
      mediaTempoSessao: Math.round(mediaTempoSessao * 10) / 10,
      pageViewsHoje: pageViewsHoje || 0,
      simuladosIniciadosHoje: simuladosIniciadosHojeCount,
      simuladosFinalizadosHoje: simuladosFinalizadosHojeCount,
      sanarclassViewsHoje: sanarclassViewsHoje || 0,
      taxaAbandonoSimulados,
    };
  }, [filters.dateRange, filters.iesId]);

  const fetchEngagementMetrics = useCallback(async (): Promise<EngagementMetrics> => {
    const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;
    const startDate = filters.dateRange.start.toISOString();
    const endDate = filters.dateRange.end.toISOString();

    console.log('[useAnalyticsData] fetchEngagementMetrics - filters:', { iesFilter, startDate, endDate });

    // Sessões por dia (dentro do dateRange)
    let sessoesQuery = supabase
      .from('user_sessions')
      .select('started_at, duration_seconds, is_mobile')
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .order('started_at', { ascending: true });
    if (iesFilter) sessoesQuery = sessoesQuery.eq('ies_id', iesFilter);
    const { data: sessoesBrutas } = await sessoesQuery;

    // Agrupar sessões por dia (usando timezone Brasil)
    const sessoesPorDiaMap = new Map<string, { count: number; totalDuration: number }>();
    sessoesBrutas?.forEach((s) => {
      const brazilDate = toBrazilDate(s.started_at);
      const dia = `${brazilDate.getFullYear()}-${String(brazilDate.getMonth() + 1).padStart(2, '0')}-${String(brazilDate.getDate()).padStart(2, '0')}`;
      const existing = sessoesPorDiaMap.get(dia) || { count: 0, totalDuration: 0 };
      sessoesPorDiaMap.set(dia, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + (s.duration_seconds || 0),
      });
    });

    const sessoesPorDia = Array.from(sessoesPorDiaMap.entries()).map(([data, vals]) => ({
      data,
      sessoes: vals.count,
      duracao_media: vals.count > 0 ? Math.round(vals.totalDuration / vals.count / 60) : 0,
    }));

    // Page views por página (dentro do dateRange)
    let pageViewsQuery = supabase
      .from('page_views')
      .select('page_path')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    if (iesFilter) pageViewsQuery = pageViewsQuery.eq('ies_id', iesFilter);
    const { data: pageViewsBrutas } = await pageViewsQuery;

    const pageViewsMap = new Map<string, number>();
    pageViewsBrutas?.forEach((pv) => {
      const count = pageViewsMap.get(pv.page_path) || 0;
      pageViewsMap.set(pv.page_path, count + 1);
    });

    const pageViewsPorPagina = Array.from(pageViewsMap.entries())
      .map(([pagina, views]) => ({ pagina, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Horários de pico (usando timezone Brasil)
    const horarioMap = new Map<number, number>();
    sessoesBrutas?.forEach((s) => {
      const brazilDate = toBrazilDate(s.started_at);
      const hora = brazilDate.getHours();
      const count = horarioMap.get(hora) || 0;
      horarioMap.set(hora, count + 1);
    });

    const horariosPico = Array.from(horarioMap.entries())
      .map(([hora, acessos]) => ({ hora, acessos }))
      .sort((a, b) => a.hora - b.hora);

    // Dispositivos
    const dispositivosMobile = sessoesBrutas?.filter(s => s.is_mobile).length || 0;
    const dispositivosDesktop = (sessoesBrutas?.length || 0) - dispositivosMobile;

    return {
      sessoesPorDia,
      pageViewsPorPagina,
      horariosPico,
      dispositivosMobile,
      dispositivosDesktop,
    };
  }, [filters.dateRange, filters.iesId]);

  const fetchProgressMetrics = useCallback(async (): Promise<ProgressMetrics> => {
    const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;

    console.log('[useAnalyticsData] fetchProgressMetrics - filters:', { iesFilter });

    // Buscar IES nome se tiver filtro
    let iesNome: string | null = null;
    if (iesFilter) {
      const { data: iesData } = await supabase.from('ies').select('nome').eq('id', iesFilter).single();
      iesNome = iesData?.nome || null;
    }

    // Progresso por matéria (com filtro de IES pelo ies_nome em study_progress)
    let progressoQuery = supabase.from('study_progress').select('materia_id, completed, ies_nome');
    if (iesNome) progressoQuery = progressoQuery.eq('ies_nome', iesNome);
    const { data: progressoBruto } = await progressoQuery;

    const materiaMap = new Map<string, { completed: number; total: number }>();
    progressoBruto?.forEach((p) => {
      const existing = materiaMap.get(p.materia_id) || { completed: 0, total: 0 };
      materiaMap.set(p.materia_id, {
        completed: existing.completed + (p.completed ? 1 : 0),
        total: existing.total + 1,
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

    // Usuários por faixa de progresso
    let userProgressQuery = supabase.from('study_progress').select('user_id, completed, ies_nome');
    if (iesNome) userProgressQuery = userProgressQuery.eq('ies_nome', iesNome);
    const { data: usuarioProgressos } = await userProgressQuery;

    const userProgressMap = new Map<string, { completed: number; total: number }>();
    usuarioProgressos?.forEach((p) => {
      const existing = userProgressMap.get(p.user_id) || { completed: 0, total: 0 };
      userProgressMap.set(p.user_id, {
        completed: existing.completed + (p.completed ? 1 : 0),
        total: existing.total + 1,
      });
    });

    const faixas = {
      '0-25%': 0,
      '25-50%': 0,
      '50-75%': 0,
      '75-100%': 0,
    };

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
  }, [filters.iesId]);

  const fetchDemographicsMetrics = useCallback(async (): Promise<DemographicsMetrics> => {
    const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;

    console.log('[useAnalyticsData] fetchDemographicsMetrics - filters:', { iesFilter });

    // Usuários por IES (com filtro se aplicável)
    let usuariosQuery = supabase.from('users').select('id_ies, semestre');
    if (iesFilter) usuariosQuery = usuariosQuery.eq('id_ies', iesFilter);
    const { data: usuariosData } = await usuariosQuery;

    // Buscar nomes das IES
    const { data: iesData } = await supabase.from('ies').select('id, nome');
    const iesMap = new Map(iesData?.map(i => [i.id, i.nome]) || []);

    const usuariosPorIESMap = new Map<string, number>();
    const usuariosPorSemestreMap = new Map<number, number>();

    usuariosData?.forEach((u) => {
      if (u.id_ies) {
        const count = usuariosPorIESMap.get(u.id_ies) || 0;
        usuariosPorIESMap.set(u.id_ies, count + 1);
      }
      // Tratar semestre 0 ou null como "Não informado"
      const semestre = u.semestre ?? 0;
      const count = usuariosPorSemestreMap.get(semestre) || 0;
      usuariosPorSemestreMap.set(semestre, count + 1);
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
        // Colocar "Não informado" no final
        if (a.semestre === 'Não informado') return 1;
        if (b.semestre === 'Não informado') return -1;
        return parseInt(a.semestre) - parseInt(b.semestre);
      });

    return {
      usuariosPorIES,
      usuariosPorSemestre,
    };
  }, [filters.iesId]);

  const fetchSimuladoMetrics = useCallback(async (): Promise<SimuladoMetrics> => {
    const iesFilter = filters.iesId && filters.iesId !== 'all' ? filters.iesId : null;
    const startDate = filters.dateRange.start.toISOString();
    const endDate = filters.dateRange.end.toISOString();

    console.log('[useAnalyticsData] fetchSimuladoMetrics - filters:', { iesFilter, startDate, endDate });

    // Simulados disponíveis
    const { data: simuladosData } = await supabase
      .from('simulados_admin')
      .select('id, nome');

    // Contagem de questões por simulado
    const { data: questoesData } = await supabase
      .from('questoes_simulado')
      .select('simulado_id');

    const questoesPorSimulado = new Map<string, number>();
    questoesData?.forEach((q) => {
      const count = questoesPorSimulado.get(q.simulado_id) || 0;
      questoesPorSimulado.set(q.simulado_id, count + 1);
    });

    // Iniciados por simulado (dentro do dateRange)
    const { data: iniciadosData } = await supabase
      .from('simulados_iniciados')
      .select('simulado_id')
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    const iniciadosPorSimulado = new Map<string, number>();
    iniciadosData?.forEach((i) => {
      const count = iniciadosPorSimulado.get(i.simulado_id) || 0;
      iniciadosPorSimulado.set(i.simulado_id, count + 1);
    });

    // Finalizados por simulado (dentro do dateRange)
    const { data: finalizadosData } = await supabase
      .from('simulados_finalizados')
      .select('simulado_id')
      .gte('finalizado_em', startDate)
      .lte('finalizado_em', endDate);

    const finalizadosPorSimulado = new Map<string, number>();
    finalizadosData?.forEach((f) => {
      const count = finalizadosPorSimulado.get(f.simulado_id) || 0;
      finalizadosPorSimulado.set(f.simulado_id, count + 1);
    });

    const simuladosDisponiveis = simuladosData?.map((s) => {
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
    const { data: respostasData } = await supabase
      .from('answer_progress')
      .select('correct');

    const totalRespostas = respostasData?.length || 0;
    const totalCorretas = respostasData?.filter(r => r.correct).length || 0;
    const mediaAcertos = totalRespostas > 0 ? Math.round((totalCorretas / totalRespostas) * 100) : 0;

    // Questões problemáticas (maior taxa de erro) - com JOIN para enunciado real
    const { data: respostasDetalhadas } = await supabase
      .from('answer_progress')
      .select('question_id, correct');

    const questaoStats = new Map<string, { corretas: number; total: number }>();
    respostasDetalhadas?.forEach((r) => {
      const existing = questaoStats.get(r.question_id) || { corretas: 0, total: 0 };
      questaoStats.set(r.question_id, {
        corretas: existing.corretas + (r.correct ? 1 : 0),
        total: existing.total + 1,
      });
    });

    // Buscar enunciados reais das questões problemáticas
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
  }, [filters.dateRange, filters.iesId]);

  const fetchTrackingHealth = useCallback(async (): Promise<TrackingHealth[]> => {
    const seteDiasAtras = getDaysAgoBrazilISO(7);

    console.log('[useAnalyticsData] fetchTrackingHealth - desde:', seteDiasAtras);

    const results: TrackingHealth[] = [];

    // user_sessions
    const { count: sessionsCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', seteDiasAtras);
    results.push({ 
      tabela: 'user_sessions', 
      ultimos7dias: sessionsCount || 0, 
      status: (sessionsCount || 0) < 5 ? 'critico' : (sessionsCount || 0) < 50 ? 'baixo' : 'ok' 
    });

    // page_views
    const { count: pageViewsCount } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras);
    results.push({ 
      tabela: 'page_views', 
      ultimos7dias: pageViewsCount || 0, 
      status: (pageViewsCount || 0) < 5 ? 'critico' : (pageViewsCount || 0) < 50 ? 'baixo' : 'ok' 
    });

    // analytics_events
    const { count: eventsCount } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras);
    results.push({ 
      tabela: 'analytics_events', 
      ultimos7dias: eventsCount || 0, 
      status: (eventsCount || 0) < 5 ? 'critico' : (eventsCount || 0) < 50 ? 'baixo' : 'ok' 
    });

    // study_progress
    const { count: studyCount } = await supabase
      .from('study_progress')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras);
    results.push({ 
      tabela: 'study_progress', 
      ultimos7dias: studyCount || 0, 
      status: (studyCount || 0) < 5 ? 'critico' : (studyCount || 0) < 50 ? 'baixo' : 'ok' 
    });

    // aula_views
    const { count: aulaCount } = await supabase
      .from('aula_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras);
    results.push({ 
      tabela: 'aula_views', 
      ultimos7dias: aulaCount || 0, 
      status: (aulaCount || 0) < 5 ? 'critico' : (aulaCount || 0) < 50 ? 'baixo' : 'ok' 
    });

    // sanarclass_views
    const { count: sanarCount } = await supabase
      .from('sanarclass_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', seteDiasAtras);
    results.push({ 
      tabela: 'sanarclass_views', 
      ultimos7dias: sanarCount || 0, 
      status: (sanarCount || 0) < 5 ? 'critico' : (sanarCount || 0) < 50 ? 'baixo' : 'ok' 
    });
    return results;
  }, []);

  const fetchAllData = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[useAnalyticsData] Iniciando fetch de todos os dados com filtros:', filters);

      const [overview, engagement, progress, demographics, simulados, trackingHealth] = await Promise.all([
        fetchOverviewMetrics(),
        fetchEngagementMetrics(),
        fetchProgressMetrics(),
        fetchDemographicsMetrics(),
        fetchSimuladoMetrics(),
        fetchTrackingHealth(),
      ]);

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

      console.log('[useAnalyticsData] Dados carregados com sucesso');
    } catch (error) {
      console.error('[useAnalyticsData] Erro ao carregar dados:', error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar dados',
      }));
    }
  }, [fetchOverviewMetrics, fetchEngagementMetrics, fetchProgressMetrics, fetchDemographicsMetrics, fetchSimuladoMetrics, fetchTrackingHealth]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refetch = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { ...data, refetch };
}
