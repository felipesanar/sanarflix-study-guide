import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';
import { Logger } from '@/utils/logger';

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
  totalSessoesPeriodo: number; // Contagem real via count: 'exact'
}

export interface ProgressMetrics {
  // Métricas corrigidas (comparando com conteúdo disponível)
  progressoMedioPorMateria: { 
    materia: string; 
    progresso: number; 
    aulasDisponiveis: number;
    aulasConcluidas: number;
  }[];
  usuariosPorFaixaProgresso: { faixa: string; quantidade: number }[];
  taxaConclusaoConteudo: number;
  
  // Métricas de engajamento
  velocidadeEstudo: {
    aulasUltimaSemana: number;
    aulasSemanaAnterior: number;
    tendencia: 'up' | 'down' | 'stable';
    porDia: { data: string; conclusoes: number }[];
    mediaMovel7Dias: number;
  };
  materiasPopulares: {
    materia: string;
    usuariosUnicos: number;
    totalConclusoes: number;
  }[];
  coberturaConteudo: {
    aulasAcessadas: number;
    totalAulas: number;
    percentual: number;
    materiasAcessadas: number;
    totalMaterias: number;
  };
  usuariosComProgresso: number;
  totalUsuariosElegiveis: number;
  
  // Novas métricas avançadas
  taxaAtivacao: number; // % usuarios que têm pelo menos 1 progresso
  profundidadeMedia: number; // aulas por usuário ativo
  materiasNuncaAcessadas: string[]; // Matérias sem nenhum acesso
  diasComAtividade: number; // Dias distintos com conclusões no período
  concentracaoTop3: number; // % de conclusões nas top 3 matérias
}

export interface DemographicsMetrics {
  usuariosPorIES: { ies_nome: string; ies_id: string; quantidade: number; percentual: number }[];
  usuariosPorSemestre: { semestre: string; quantidade: number; percentual: number }[];
  
  // Novas métricas
  totalUsuarios: number; // Total real excluindo admins
  usuariosComIES: number;
  usuariosSemIES: number;
  usuariosComSemestre: number;
  usuariosSemSemestre: number;
  cadastrosCompletos: number; // Com IES E semestre
  taxaCompletude: number; // % com cadastro completo
  indiceHHI: number; // Índice Herfindahl-Hirschman (concentração)
  concentracaoTop3: number; // % nas top 3 IES
  semestresPorGrupo: {
    iniciais: number; // 1-4
    intermediarios: number; // 5-8
    avancados: number; // 9-12+
    naoInformado: number; // 0 ou null
  };
  
  // Semester editing metrics
  semesterEditing: {
    totalUpdates: number;
    firstDefinitions: number;
    bannerShown: number;
    bannerClicked: number;
    conversionRate: number;
    updatesPerDay: { data: string; total: number; firstDef: number }[];
  };
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
  excludedIES?: string[];
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
    totalSessoesPeriodo: 0,
  },
  progress: {
    progressoMedioPorMateria: [],
    usuariosPorFaixaProgresso: [],
    taxaConclusaoConteudo: 0,
    velocidadeEstudo: {
      aulasUltimaSemana: 0,
      aulasSemanaAnterior: 0,
      tendencia: 'stable',
      porDia: [],
      mediaMovel7Dias: 0,
    },
    materiasPopulares: [],
    coberturaConteudo: {
      aulasAcessadas: 0,
      totalAulas: 0,
      percentual: 0,
      materiasAcessadas: 0,
      totalMaterias: 0,
    },
    usuariosComProgresso: 0,
    totalUsuariosElegiveis: 0,
    taxaAtivacao: 0,
    profundidadeMedia: 0,
    materiasNuncaAcessadas: [],
    diasComAtividade: 0,
    concentracaoTop3: 0,
  },
  demographics: {
    usuariosPorIES: [],
    usuariosPorSemestre: [],
    totalUsuarios: 0,
    usuariosComIES: 0,
    usuariosSemIES: 0,
    usuariosComSemestre: 0,
    usuariosSemSemestre: 0,
    cadastrosCompletos: 0,
    taxaCompletude: 0,
    indiceHHI: 0,
    concentracaoTop3: 0,
    semestresPorGrupo: {
      iniciais: 0,
      intermediarios: 0,
      avancados: 0,
      naoInformado: 0,
    },
    semesterEditing: {
      totalUpdates: 0,
      firstDefinitions: 0,
      bannerShown: 0,
      bannerClicked: 0,
      conversionRate: 0,
      updatesPerDay: [],
    },
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
    const excludedIESIds = filters.excludedIES || [];
    const startDate = filters.dateRange.start.toISOString();
    const endDate = filters.dateRange.end.toISOString();
    const hoje = getTodayBrazilISO();
    const seteDiasAtras = getDaysAgoBrazilISO(7);
    
    return { iesFilter, excludedIESIds, startDate, endDate, hoje, seteDiasAtras };
  }, [filters.iesId, filters.excludedIES, filters.dateRange.start, filters.dateRange.end]);

  // Helper para buscar user IDs de admins (para exclusão global)
  const fetchAdminUserIds = useCallback(async (): Promise<Set<string>> => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    return new Set(data?.map(r => r.user_id) || []);
  }, []);

  // Cache de user IDs por IES para reutilizar entre queries (exclui admins)
  const fetchUserIdsByIES = useCallback(async (iesId: string, adminIds: Set<string>): Promise<string[]> => {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('id_ies', iesId);
    return (users?.map(u => u.id) || []).filter(id => !adminIds.has(id));
  }, []);

  // Buscar user IDs excluindo IES específicas (exclui admins)
  const fetchUserIdsExcludingIES = useCallback(async (excludedIds: string[], adminIds: Set<string>): Promise<string[]> => {
    if (excludedIds.length === 0) return [];
    
    // Supabase não suporta .not('in', array) diretamente, então buscamos todos e filtramos
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, id_ies');
    
    if (!allUsers) return [];
    
    // Filtrar usuários cujo id_ies NÃO está na lista de exclusão E não são admins
    return allUsers
      .filter(u => u.id_ies && !excludedIds.includes(u.id_ies) && !adminIds.has(u.id))
      .map(u => u.id);
  }, []);

  // Helper para buscar TODAS as respostas com paginação (sem limite de 1000)
  const fetchAllAnswerProgress = useCallback(async (
    userFilter: string[] | null,
    adminIds: Set<string>
  ): Promise<{ question_id: string; correct: boolean; user_id: string }[]> => {
    const PAGE_SIZE = 1000;
    const all: { question_id: string; correct: boolean; user_id: string }[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('answer_progress')
        .select('question_id, correct, user_id')
        .order('answer_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (userFilter && userFilter.length > 0) {
        query = query.in('user_id', userFilter);
      }

      const { data: page, error } = await query;
      if (error) throw error;
      
      // Filtrar admins dos resultados
      const rows = (page || []).filter(r => r.user_id && !adminIds.has(r.user_id));
      all.push(...rows);
      
      if ((page || []).length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    return all;
  }, []);

  const fetchOverviewMetrics = useCallback(async (): Promise<OverviewMetrics> => {
    const { iesFilter, excludedIESIds, startDate, endDate, hoje, seteDiasAtras } = filterParams;

    Logger.info('[Analytics] fetchOverviewMetrics:', { iesFilter, excludedIESIds, startDate, endDate });

    // CRÍTICO: Buscar admin IDs primeiro para exclusão global
    const adminIds = await fetchAdminUserIds();
    Logger.info('[Analytics] Excluding', adminIds.size, 'admin users from overview metrics');

    // Buscar user IDs da IES filtrada OU usuários excluindo IES (já exclui admins)
    let userIdsFromIES: string[] | null = null;
    let hasExclusions = false;
    
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter, adminIds);
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
    } else if (excludedIESIds.length > 0) {
      userIdsFromIES = await fetchUserIdsExcludingIES(excludedIESIds, adminIds);
      hasExclusions = true;
      if (userIdsFromIES.length === 0) {
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
        : hasExclusions && userIdsFromIES
          ? supabase.from('users').select('*', { count: 'exact', head: true }).in('id', userIdsFromIES)
          : supabase.from('users').select('*', { count: 'exact', head: true }),

      // 2. Sessões de hoje
      iesFilter
        ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', hoje).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', hoje).in('user_id', userIdsFromIES)
          : supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', hoje),

      // 3. Usuários ativos hoje
      iesFilter
        ? supabase.from('user_sessions').select('user_id').gte('started_at', hoje).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('user_id').gte('started_at', hoje).in('user_id', userIdsFromIES)
          : supabase.from('user_sessions').select('user_id').gte('started_at', hoje),

      // 4. Usuários ativos 7 dias
      iesFilter
        ? supabase.from('user_sessions').select('user_id').gte('started_at', seteDiasAtras).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('user_id').gte('started_at', seteDiasAtras).in('user_id', userIdsFromIES)
          : supabase.from('user_sessions').select('user_id').gte('started_at', seteDiasAtras),

      // 5. Duração média de sessão (no dateRange)
      iesFilter
        ? supabase.from('user_sessions').select('duration_seconds').not('duration_seconds', 'is', null).gte('started_at', startDate).lte('started_at', endDate).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('duration_seconds').not('duration_seconds', 'is', null).gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
          : supabase.from('user_sessions').select('duration_seconds').not('duration_seconds', 'is', null).gte('started_at', startDate).lte('started_at', endDate),

      // 6. Page views de hoje
      iesFilter
        ? supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje).in('user_id', userIdsFromIES)
          : supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje),

      // 7. Simulados iniciados hoje (filtrar por user_id se IES)
      iesFilter && userIdsFromIES
        ? supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', hoje).in('user_id', userIdsFromIES)
        : hasExclusions && userIdsFromIES
          ? supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', hoje).in('user_id', userIdsFromIES)
          : supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', hoje),

      // 8. Simulados finalizados hoje
      iesFilter && userIdsFromIES
        ? supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', hoje).in('user_id', userIdsFromIES)
        : hasExclusions && userIdsFromIES
          ? supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', hoje).in('user_id', userIdsFromIES)
          : supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', hoje),

      // 9. SanarClass views hoje
      iesFilter && userIdsFromIES
        ? supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje).in('user_id', userIdsFromIES)
        : hasExclusions && userIdsFromIES
          ? supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje).in('user_id', userIdsFromIES)
          : supabase.from('sanarclass_views').select('*', { count: 'exact', head: true }).gte('created_at', hoje),

      // 10. Taxa de abandono (no dateRange)
      Promise.all([
        iesFilter && userIdsFromIES
          ? supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
          : hasExclusions && userIdsFromIES
            ? supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
            : supabase.from('simulados_iniciados').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate),
        iesFilter && userIdsFromIES
          ? supabase.from('simulados_finalizados').select('*', { count: 'exact', head: true }).gte('finalizado_em', startDate).lte('finalizado_em', endDate).in('user_id', userIdsFromIES)
          : hasExclusions && userIdsFromIES
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
  }, [filterParams, fetchAdminUserIds, fetchUserIdsByIES, fetchUserIdsExcludingIES]);

  const fetchEngagementMetrics = useCallback(async (): Promise<EngagementMetrics> => {
    const { iesFilter, excludedIESIds, startDate, endDate } = filterParams;

    Logger.info('[Analytics] fetchEngagementMetrics:', { iesFilter, excludedIESIds, startDate, endDate });

    // CRÍTICO: Buscar admin IDs primeiro para exclusão global
    const adminIds = await fetchAdminUserIds();

    // Buscar user IDs para filtrar (já exclui admins)
    let userIdsFromIES: string[] | null = null;
    let hasExclusions = false;
    
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter, adminIds);
    } else if (excludedIESIds.length > 0) {
      userIdsFromIES = await fetchUserIdsExcludingIES(excludedIESIds, adminIds);
      hasExclusions = true;
    }

    // PARALLEL: Buscar sessões, page views e contagem total em paralelo
    const [sessoesResult, pageViewsResult, totalSessoesCountResult] = await Promise.all([
      iesFilter
        ? supabase.from('user_sessions').select('started_at, duration_seconds, is_mobile').gte('started_at', startDate).lte('started_at', endDate).eq('ies_id', iesFilter).order('started_at', { ascending: true })
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('started_at, duration_seconds, is_mobile').gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES).order('started_at', { ascending: true })
          : supabase.from('user_sessions').select('started_at, duration_seconds, is_mobile').gte('started_at', startDate).lte('started_at', endDate).order('started_at', { ascending: true }),
      
      iesFilter
        ? supabase.from('page_views').select('page_path').gte('created_at', startDate).lte('created_at', endDate).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('page_views').select('page_path').gte('created_at', startDate).lte('created_at', endDate).in('user_id', userIdsFromIES)
          : supabase.from('page_views').select('page_path').gte('created_at', startDate).lte('created_at', endDate),
      
      // Query separada para contagem REAL de sessões (sem limite de 1000 linhas)
      iesFilter
        ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
          : supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', startDate).lte('started_at', endDate)
    ]);

    const totalSessoesPeriodo = totalSessoesCountResult.count || 0;

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
      totalSessoesPeriodo,
    };
  }, [filterParams, fetchAdminUserIds, fetchUserIdsByIES, fetchUserIdsExcludingIES]);

  const fetchProgressMetrics = useCallback(async (): Promise<ProgressMetrics> => {
    const { iesFilter, excludedIESIds, startDate, endDate } = filterParams;

    Logger.info('[Analytics] fetchProgressMetrics (NOVO):', { iesFilter, excludedIESIds, startDate, endDate });

    // 1. Buscar admin IDs para exclusão
    const adminIds = await fetchAdminUserIds();
    Logger.info('[Analytics Progress] Excluding', adminIds.size, 'admin users');

    // 2. Buscar usuários elegíveis (não-admins, filtrados por IES se aplicável)
    let userIdsFromIES: string[] | null = null;
    let hasExclusions = false;
    
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter, adminIds);
    } else if (excludedIESIds.length > 0) {
      userIdsFromIES = await fetchUserIdsExcludingIES(excludedIESIds, adminIds);
      hasExclusions = true;
    }

    // 3. Buscar usuários com seus semestres e IES para calcular conteúdo disponível
    const usersQuery = iesFilter
      ? supabase.from('users').select('id, semestre, id_ies').eq('id_ies', iesFilter)
      : hasExclusions && userIdsFromIES && userIdsFromIES.length > 0
        ? supabase.from('users').select('id, semestre, id_ies').in('id', userIdsFromIES)
        : supabase.from('users').select('id, semestre, id_ies');

    // 4. Buscar conteúdos disponíveis (agrupado por IES + semestre + matéria)
    const conteudosQuery = iesFilter
      ? supabase.from('conteudos').select('id, id_ies, semestre, materia')
        .eq('id_ies', iesFilter)
      : supabase.from('conteudos').select('id, id_ies, semestre, materia');

    // 5. Buscar study_progress com filtro de período
    const progressQuery = supabase
      .from('study_progress')
      .select('id, user_id, materia_id, completed, completed_at, content_id, semestre')
      .eq('completed', true)
      .gte('completed_at', startDate)
      .lte('completed_at', endDate);

    // Executar queries em paralelo
    const [usersResult, conteudosResult, progressResult] = await Promise.all([
      usersQuery,
      conteudosQuery,
      progressQuery,
    ]);

    const usersData = (usersResult.data || []).filter(u => !adminIds.has(u.id));
    const conteudosData = conteudosResult.data || [];
    let progressData = (progressResult.data || []).filter(p => !adminIds.has(p.user_id));

    // Filtrar progresso por IES se necessário
    if (userIdsFromIES && userIdsFromIES.length > 0) {
      const userIdSet = new Set(userIdsFromIES);
      progressData = progressData.filter(p => userIdSet.has(p.user_id));
    }

    Logger.info('[Analytics Progress] Users:', usersData.length, 'Conteudos:', conteudosData.length, 'Progress:', progressData.length);

    // 6. Criar mapas para cálculos eficientes
    // Contar aulas por IES + semestre + matéria
    const conteudosPorChave = new Map<string, number>();
    const conteudosPorMateria = new Map<string, number>();
    const totalAulasGlobal = conteudosData.length;

    conteudosData.forEach(c => {
      const chave = `${c.id_ies}|${c.semestre}|${c.materia}`;
      conteudosPorChave.set(chave, (conteudosPorChave.get(chave) || 0) + 1);
      conteudosPorMateria.set(c.materia, (conteudosPorMateria.get(c.materia) || 0) + 1);
    });

    // Criar mapa de usuários para semestre/IES
    const userInfoMap = new Map<string, { semestre: number | null; id_ies: string | null }>();
    usersData.forEach(u => {
      userInfoMap.set(u.id, { semestre: u.semestre, id_ies: u.id_ies });
    });

    // 7. Calcular progresso por matéria (comparando com total disponível)
    const materiaStats = new Map<string, { concluidas: number; disponiveis: number }>();
    const userConclusoes = new Map<string, Set<string>>(); // user_id -> Set<content_id>
    const materiasAcessadas = new Set<string>(); // content_ids acessados

    progressData.forEach(p => {
      const materia = p.materia_id;
      const stats = materiaStats.get(materia) || { concluidas: 0, disponiveis: 0 };
      stats.concluidas++;
      materiaStats.set(materia, stats);

      // Track por usuário
      if (!userConclusoes.has(p.user_id)) {
        userConclusoes.set(p.user_id, new Set());
      }
      userConclusoes.get(p.user_id)!.add(p.content_id);
      materiasAcessadas.add(p.content_id);
    });

    // Adicionar contagem de aulas disponíveis por matéria
    conteudosPorMateria.forEach((count, materia) => {
      const stats = materiaStats.get(materia) || { concluidas: 0, disponiveis: 0 };
      stats.disponiveis = count;
      materiaStats.set(materia, stats);
    });

    // 8. Montar progressoMedioPorMateria
    const progressoMedioPorMateria = Array.from(materiaStats.entries())
      .map(([materia, stats]) => ({
        materia,
        progresso: stats.disponiveis > 0 ? Math.round((stats.concluidas / stats.disponiveis) * 100) : 0,
        aulasDisponiveis: stats.disponiveis,
        aulasConcluidas: stats.concluidas,
      }))
      .filter(m => m.aulasDisponiveis > 0 || m.aulasConcluidas > 0)
      .sort((a, b) => b.progresso - a.progresso)
      .slice(0, 15);

    // 9. Calcular progresso real por usuário (vs conteúdo disponível para seu semestre)
    const userProgressReal = new Map<string, number>(); // user_id -> % real
    
    usersData.forEach(u => {
      const userInfo = userInfoMap.get(u.id);
      if (!userInfo || !userInfo.id_ies || !userInfo.semestre) return;

      // Contar aulas disponíveis para este usuário (seu IES + semestre)
      let aulasDisponiveis = 0;
      conteudosData.forEach(c => {
        if (c.id_ies === userInfo.id_ies && String(c.semestre) === String(userInfo.semestre)) {
          aulasDisponiveis++;
        }
      });

      const aulasConcluidas = userConclusoes.get(u.id)?.size || 0;
      const progressoReal = aulasDisponiveis > 0 ? (aulasConcluidas / aulasDisponiveis) * 100 : 0;
      userProgressReal.set(u.id, progressoReal);
    });

    // 10. Faixas de progresso (baseado em progresso REAL)
    const faixas = { '0-25%': 0, '25-50%': 0, '50-75%': 0, '75-100%': 0 };
    userProgressReal.forEach((pct) => {
      if (pct <= 25) faixas['0-25%']++;
      else if (pct <= 50) faixas['25-50%']++;
      else if (pct <= 75) faixas['50-75%']++;
      else faixas['75-100%']++;
    });

    const usuariosPorFaixaProgresso = Object.entries(faixas).map(([faixa, quantidade]) => ({
      faixa,
      quantidade,
    }));

    // 11. Taxa de conclusão geral (total de conclusões / total de conteúdo * usuários)
    const totalConclusoes = progressData.length;
    const totalPossivel = usersData.length > 0 && totalAulasGlobal > 0
      ? usersData.reduce((acc, u) => {
          const info = userInfoMap.get(u.id);
          if (!info?.id_ies || !info.semestre) return acc;
          let count = 0;
          conteudosData.forEach(c => {
            if (c.id_ies === info.id_ies && String(c.semestre) === String(info.semestre)) {
              count++;
            }
          });
          return acc + count;
        }, 0)
      : 0;
    
    const taxaConclusaoConteudo = totalPossivel > 0 
      ? Math.round((totalConclusoes / totalPossivel) * 100) 
      : 0;

    // 12. Velocidade de estudo (conclusões por dia no período)
    const hoje = getBrazilDate();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const quatorzeDiasAtras = new Date(hoje);
    quatorzeDiasAtras.setDate(quatorzeDiasAtras.getDate() - 14);

    const conclusoesPorDia = new Map<string, number>();
    let aulasUltimaSemana = 0;
    let aulasSemanaAnterior = 0;

    progressData.forEach(p => {
      if (!p.completed_at) return;
      const dataConc = toBrazilDate(new Date(p.completed_at));
      const diaKey = dataConc.toISOString().split('T')[0];
      conclusoesPorDia.set(diaKey, (conclusoesPorDia.get(diaKey) || 0) + 1);

      if (dataConc >= seteDiasAtras) {
        aulasUltimaSemana++;
      } else if (dataConc >= quatorzeDiasAtras) {
        aulasSemanaAnterior++;
      }
    });

    const tendencia: 'up' | 'down' | 'stable' = 
      aulasUltimaSemana > aulasSemanaAnterior * 1.2 ? 'up' :
      aulasUltimaSemana < aulasSemanaAnterior * 0.8 ? 'down' : 'stable';

    const porDia = Array.from(conclusoesPorDia.entries())
      .map(([data, conclusoes]) => ({ data, conclusoes }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-30); // Últimos 30 dias

    // Calcular média móvel de 7 dias
    const mediaMovel7Dias = porDia.length >= 7 
      ? Math.round(porDia.slice(-7).reduce((sum, d) => sum + d.conclusoes, 0) / 7 * 10) / 10
      : porDia.length > 0 
        ? Math.round(porDia.reduce((sum, d) => sum + d.conclusoes, 0) / porDia.length * 10) / 10
        : 0;

    // 13. Matérias mais populares (por usuários únicos)
    const materiaUserCount = new Map<string, Set<string>>();
    progressData.forEach(p => {
      if (!materiaUserCount.has(p.materia_id)) {
        materiaUserCount.set(p.materia_id, new Set());
      }
      materiaUserCount.get(p.materia_id)!.add(p.user_id);
    });

    const materiasPopulares = Array.from(materiaUserCount.entries())
      .map(([materia, users]) => ({
        materia,
        usuariosUnicos: users.size,
        totalConclusoes: progressData.filter(p => p.materia_id === materia).length,
      }))
      .sort((a, b) => b.usuariosUnicos - a.usuariosUnicos)
      .slice(0, 10);

    // 14. Cobertura de conteúdo (CORRIGIDA: usar materia_id para cruzar corretamente)
    const materiasComProgresso = new Set(progressData.map(p => p.materia_id));
    const materiasDisponiveisSet = new Set(conteudosData.map(c => c.materia));
    const aulasAcessadas = materiasAcessadas.size;
    
    const coberturaConteudo = {
      aulasAcessadas,
      totalAulas: totalAulasGlobal,
      percentual: totalAulasGlobal > 0 ? Math.round((aulasAcessadas / totalAulasGlobal) * 100) : 0,
      materiasAcessadas: [...materiasComProgresso].filter(m => materiasDisponiveisSet.has(m)).length,
      totalMaterias: materiasDisponiveisSet.size,
    };

    // 15. Contagem de usuários com progresso
    const usuariosComProgresso = userConclusoes.size;

    // 16. Novas métricas avançadas
    // Taxa de ativação: % de usuários que têm pelo menos 1 progresso
    const taxaAtivacao = usersData.length > 0 
      ? Math.round((usuariosComProgresso / usersData.length) * 100 * 10) / 10
      : 0;

    // Profundidade média: aulas por usuário ativo
    const profundidadeMedia = usuariosComProgresso > 0
      ? Math.round((progressData.length / usuariosComProgresso) * 10) / 10
      : 0;

    // Matérias nunca acessadas
    const materiasNuncaAcessadas = [...materiasDisponiveisSet]
      .filter(m => !materiasComProgresso.has(m))
      .slice(0, 10);

    // Dias com atividade no período
    const diasComAtividade = conclusoesPorDia.size;

    // Concentração nas top 3 matérias
    const top3Conclusoes = materiasPopulares.slice(0, 3).reduce((sum, m) => sum + m.totalConclusoes, 0);
    const concentracaoTop3 = progressData.length > 0 
      ? Math.round((top3Conclusoes / progressData.length) * 100)
      : 0;

    return {
      progressoMedioPorMateria,
      usuariosPorFaixaProgresso,
      taxaConclusaoConteudo,
      velocidadeEstudo: {
        aulasUltimaSemana,
        aulasSemanaAnterior,
        tendencia,
        porDia,
        mediaMovel7Dias,
      },
      materiasPopulares,
      coberturaConteudo,
      usuariosComProgresso,
      totalUsuariosElegiveis: usersData.length,
      taxaAtivacao,
      profundidadeMedia,
      materiasNuncaAcessadas,
      diasComAtividade,
      concentracaoTop3,
    };
  }, [filterParams, fetchAdminUserIds, fetchUserIdsByIES, fetchUserIdsExcludingIES]);

  const fetchDemographicsMetrics = useCallback(async (): Promise<DemographicsMetrics> => {
    const { iesFilter, excludedIESIds } = filterParams;

    Logger.info('[Analytics] fetchDemographicsMetrics:', { iesFilter, excludedIESIds });

    // CRÍTICO: Excluir admins (alinhamento com outras abas)
    const adminIds = await fetchAdminUserIds();
    Logger.info('[Analytics] Excluding', adminIds.size, 'admin users from demographics');

    // PAGINAÇÃO: Buscar TODOS os usuários (Supabase limita a 1000 por padrão)
    const fetchAllUsers = async () => {
      const allUsers: { id: string; id_ies: string | null; semestre: number | null }[] = [];
      const PAGE_SIZE = 1000;
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('users')
          .select('id, id_ies, semestre')
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (iesFilter) {
          query = query.eq('id_ies', iesFilter);
        }
        
        const { data, error } = await query;
        
        if (error) {
          Logger.error('[Analytics] Error fetching users page', page, error);
          break;
        }
        
        if (data && data.length > 0) {
          allUsers.push(...data);
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      Logger.info('[Analytics] Total users fetched with pagination:', allUsers.length);
      return allUsers;
    };

    const [allUsersData, iesResult] = await Promise.all([
      fetchAllUsers(),
      supabase.from('ies').select('id, nome')
    ]);

    let usuariosData = allUsersData;
    
    // Filtrar admins primeiro
    usuariosData = usuariosData.filter(u => !adminIds.has(u.id));
    
    // Aplicar filtro de exclusão no cliente se necessário
    if (!iesFilter && excludedIESIds.length > 0) {
      usuariosData = usuariosData.filter(u => !u.id_ies || !excludedIESIds.includes(u.id_ies));
    }
    
    const iesData = iesResult.data || [];
    const iesMap = new Map(iesData.map(i => [i.id, i.nome]));

    // Contadores para novas métricas
    const totalUsuarios = usuariosData.length;
    let usuariosComIES = 0;
    let usuariosComSemestre = 0;
    let cadastrosCompletos = 0;
    
    const usuariosPorIESMap = new Map<string, number>();
    const usuariosPorSemestreMap = new Map<number, number>();
    
    // Grupos de semestre
    const semestresPorGrupo = { iniciais: 0, intermediarios: 0, avancados: 0, naoInformado: 0 };

    usuariosData.forEach((u) => {
      const temIES = !!u.id_ies;
      const temSemestre = u.semestre !== null && u.semestre !== undefined && u.semestre !== 0;
      
      if (temIES) usuariosComIES++;
      if (temSemestre) usuariosComSemestre++;
      if (temIES && temSemestre) cadastrosCompletos++;
      
      // Contagem por IES
      if (u.id_ies) {
        usuariosPorIESMap.set(u.id_ies, (usuariosPorIESMap.get(u.id_ies) || 0) + 1);
      }
      
      // Contagem por semestre
      const semestre = u.semestre ?? 0;
      usuariosPorSemestreMap.set(semestre, (usuariosPorSemestreMap.get(semestre) || 0) + 1);
      
      // Agrupamento de semestres
      if (semestre === 0) {
        semestresPorGrupo.naoInformado++;
      } else if (semestre >= 1 && semestre <= 4) {
        semestresPorGrupo.iniciais++;
      } else if (semestre >= 5 && semestre <= 8) {
        semestresPorGrupo.intermediarios++;
      } else {
        semestresPorGrupo.avancados++;
      }
    });

    // Construir array de IES com percentual
    const usuariosPorIES = Array.from(usuariosPorIESMap.entries())
      .map(([ies_id, quantidade]) => ({
        ies_id,
        ies_nome: iesMap.get(ies_id) || 'Desconhecida',
        quantidade,
        percentual: totalUsuarios > 0 ? Math.round((quantidade / totalUsuarios) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // Calcular HHI (Índice Herfindahl-Hirschman)
    const indiceHHI = totalUsuarios > 0 
      ? Math.round(usuariosPorIES.reduce((sum, ies) => {
          const marketShare = (ies.quantidade / totalUsuarios) * 100;
          return sum + (marketShare * marketShare);
        }, 0))
      : 0;
    
    // Concentração nas top 3 IES
    const top3Total = usuariosPorIES.slice(0, 3).reduce((sum, ies) => sum + ies.quantidade, 0);
    const concentracaoTop3 = totalUsuarios > 0 ? Math.round((top3Total / totalUsuarios) * 100) : 0;

    // Construir array de semestres com percentual
    const usuariosPorSemestre = Array.from(usuariosPorSemestreMap.entries())
      .map(([semestre, quantidade]) => ({ 
        semestre: semestre === 0 ? 'Não informado' : `${semestre}º`,
        quantidade,
        percentual: totalUsuarios > 0 ? Math.round((quantidade / totalUsuarios) * 1000) / 10 : 0,
      }))
      .sort((a, b) => {
        if (a.semestre === 'Não informado') return 1;
        if (b.semestre === 'Não informado') return -1;
        return parseInt(a.semestre) - parseInt(b.semestre);
      });

    const taxaCompletude = totalUsuarios > 0 
      ? Math.round((cadastrosCompletos / totalUsuarios) * 1000) / 10 
      : 0;

    // Fetch semester editing events
    const { startDate, endDate } = filterParams;
    const { data: semesterEvents } = await supabase
      .from('analytics_events')
      .select('event_name, event_data, created_at')
      .in('event_name', ['semester_updated', 'semester_banner_shown', 'semester_banner_clicked'])
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    const events = semesterEvents || [];
    let totalUpdates = 0;
    let firstDefinitions = 0;
    let bannerShown = 0;
    let bannerClicked = 0;
    const updatesPerDayMap = new Map<string, { total: number; firstDef: number }>();

    events.forEach(e => {
      if (e.event_name === 'semester_updated') {
        totalUpdates++;
        const data = e.event_data as Record<string, any> | null;
        const isFirst = data?.is_first_definition === true;
        if (isFirst) firstDefinitions++;
        const day = e.created_at.substring(0, 10);
        const entry = updatesPerDayMap.get(day) || { total: 0, firstDef: 0 };
        entry.total++;
        if (isFirst) entry.firstDef++;
        updatesPerDayMap.set(day, entry);
      } else if (e.event_name === 'semester_banner_shown') {
        bannerShown++;
      } else if (e.event_name === 'semester_banner_clicked') {
        bannerClicked++;
      }
    });

    const updatesPerDay = Array.from(updatesPerDayMap.entries())
      .map(([data, v]) => ({ data, total: v.total, firstDef: v.firstDef }))
      .sort((a, b) => a.data.localeCompare(b.data));

    const conversionRate = bannerShown > 0 ? Math.round((bannerClicked / bannerShown) * 1000) / 10 : 0;

    return {
      usuariosPorIES,
      usuariosPorSemestre,
      totalUsuarios,
      usuariosComIES,
      usuariosSemIES: totalUsuarios - usuariosComIES,
      usuariosComSemestre,
      usuariosSemSemestre: totalUsuarios - usuariosComSemestre,
      cadastrosCompletos,
      taxaCompletude,
      indiceHHI,
      concentracaoTop3,
      semestresPorGrupo,
      semesterEditing: {
        totalUpdates,
        firstDefinitions,
        bannerShown,
        bannerClicked,
        conversionRate,
        updatesPerDay,
      },
    };
  }, [filterParams, fetchAdminUserIds]);

  const fetchSimuladoMetrics = useCallback(async (): Promise<SimuladoMetrics> => {
    const { iesFilter, excludedIESIds, startDate, endDate } = filterParams;

    Logger.info('[Analytics] fetchSimuladoMetrics:', { iesFilter, excludedIESIds, startDate, endDate });

    // CRÍTICO: Buscar admin IDs primeiro para exclusão global
    const adminIds = await fetchAdminUserIds();
    Logger.info('[Analytics] Excluding', adminIds.size, 'admin users from simulado metrics');

    // Buscar user IDs da IES filtrada OU excluindo IES (já exclui admins)
    let userIdsFromIES: string[] | null = null;
    let hasExclusions = false;
    
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter, adminIds);
    } else if (excludedIESIds.length > 0) {
      userIdsFromIES = await fetchUserIdsExcludingIES(excludedIESIds, adminIds);
      hasExclusions = true;
    }

    // PARALLEL: Buscar dados base
    // Simulados filtrados por IES (ies_ids é um array de UUIDs)
    const simuladosQuery = iesFilter
      ? supabase.from('simulados_admin').select('id, nome').contains('ies_ids', [iesFilter])
      : supabase.from('simulados_admin').select('id, nome');

    const useUserFilter = (iesFilter && userIdsFromIES && userIdsFromIES.length > 0) || (hasExclusions && userIdsFromIES && userIdsFromIES.length > 0);

    // MUDANÇA: Usar paginação para respostas (via fetchAllAnswerProgress) em vez de query simples
    const [simuladosResult, iniciadosResult, finalizadosResult] = await Promise.all([
      simuladosQuery,
      // Iniciados no dateRange - agora inclui user_id para contagem DISTINCT
      useUserFilter && userIdsFromIES
        ? supabase.from('simulados_iniciados').select('simulado_id, user_id').gte('started_at', startDate).lte('started_at', endDate).in('user_id', userIdsFromIES)
        : supabase.from('simulados_iniciados').select('simulado_id, user_id').gte('started_at', startDate).lte('started_at', endDate),
      // Finalizados no dateRange - agora inclui user_id para contagem DISTINCT
      useUserFilter && userIdsFromIES
        ? supabase.from('simulados_finalizados').select('simulado_id, user_id').gte('finalizado_em', startDate).lte('finalizado_em', endDate).in('user_id', userIdsFromIES)
        : supabase.from('simulados_finalizados').select('simulado_id, user_id').gte('finalizado_em', startDate).lte('finalizado_em', endDate),
    ]);

    // PAGINAÇÃO COMPLETA: Buscar TODAS as respostas (22.000+) sem limite de 1000
    Logger.info('[Analytics] Fetching all answers with pagination...');
    const respostasData = await fetchAllAnswerProgress(
      useUserFilter && userIdsFromIES ? userIdsFromIES : null,
      adminIds
    );
    Logger.info('[Analytics] Total answers fetched:', respostasData.length);

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

    // CORREÇÃO: Usar Set para contar pares únicos (user_id + simulado_id)
    // Isso evita que múltiplas tentativas/duplicatas distorçam as métricas
    const iniciadosPorSimulado = new Map<string, Set<string>>();
    iniciadosResult.data?.forEach((i) => {
      if (!iniciadosPorSimulado.has(i.simulado_id)) {
        iniciadosPorSimulado.set(i.simulado_id, new Set());
      }
      iniciadosPorSimulado.get(i.simulado_id)!.add(i.user_id);
    });

    // Criar um Set de todas as chaves (user_id-simulado_id) que têm início válido
    const iniciosValidos = new Set<string>();
    iniciadosResult.data?.forEach((i) => {
      iniciosValidos.add(`${i.user_id}-${i.simulado_id}`);
    });

    // CORREÇÃO: Finalizações só contam se existir início correspondente
    const finalizadosPorSimulado = new Map<string, Set<string>>();
    finalizadosResult.data?.forEach((f) => {
      const chave = `${f.user_id}-${f.simulado_id}`;
      // Só conta se tiver início correspondente
      if (iniciosValidos.has(chave)) {
        if (!finalizadosPorSimulado.has(f.simulado_id)) {
          finalizadosPorSimulado.set(f.simulado_id, new Set());
        }
        finalizadosPorSimulado.get(f.simulado_id)!.add(f.user_id);
      }
    });

    const simuladosDisponiveis = simuladosResult.data?.map((s) => {
      const iniciados = iniciadosPorSimulado.get(s.id)?.size || 0;
      const finalizados = finalizadosPorSimulado.get(s.id)?.size || 0;
      return {
        id: s.id,
        nome: s.nome,
        total_questoes: questoesPorSimulado.get(s.id) || 0,
        iniciados,
        finalizados,
        taxa_conclusao: iniciados > 0 ? Math.round((finalizados / iniciados) * 100) : 0,
      };
    }) || [];

    // Desempenho geral (respostasData já veio da paginação acima)
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
  }, [filterParams, fetchAdminUserIds, fetchAllAnswerProgress, fetchUserIdsByIES, fetchUserIdsExcludingIES]);

  const fetchTrackingHealth = useCallback(async (): Promise<TrackingHealth[]> => {
    const { seteDiasAtras, iesFilter, excludedIESIds } = filterParams;

    Logger.info('[Analytics] fetchTrackingHealth:', { seteDiasAtras, iesFilter, excludedIESIds });

    // CRÍTICO: Buscar admin IDs primeiro para exclusão global
    const adminIds = await fetchAdminUserIds();

    // Buscar user IDs da IES se filtrado ou excluído (já exclui admins)
    let userIdsFromIES: string[] | null = null;
    let hasExclusions = false;
    
    if (iesFilter) {
      userIdsFromIES = await fetchUserIdsByIES(iesFilter, adminIds);
    } else if (excludedIESIds.length > 0) {
      userIdsFromIES = await fetchUserIdsExcludingIES(excludedIESIds, adminIds);
      hasExclusions = true;
    }

    const useUserFilter = (iesFilter && userIdsFromIES && userIdsFromIES.length > 0) || (hasExclusions && userIdsFromIES && userIdsFromIES.length > 0);

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
        : hasExclusions && userIdsFromIES
          ? supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', seteDiasAtras).in('user_id', userIdsFromIES)
          : supabase.from('user_sessions').select('*', { count: 'exact', head: true }).gte('started_at', seteDiasAtras),
      
      // page_views
      iesFilter
        ? supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
          : supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // analytics_events
      iesFilter
        ? supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).eq('ies_id', iesFilter)
        : hasExclusions && userIdsFromIES
          ? supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
          : supabase.from('analytics_events').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // study_progress (filtra por user_id)
      useUserFilter && userIdsFromIES
        ? supabase.from('study_progress').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
        : supabase.from('study_progress').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // aula_views (filtra por user_id)
      useUserFilter && userIdsFromIES
        ? supabase.from('aula_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras).in('user_id', userIdsFromIES)
        : supabase.from('aula_views').select('*', { count: 'exact', head: true }).gte('created_at', seteDiasAtras),
      
      // sanarclass_views (filtra por user_id)
      useUserFilter && userIdsFromIES
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
  }, [filterParams, fetchAdminUserIds, fetchUserIdsByIES, fetchUserIdsExcludingIES]);

  const fetchAllData = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      Logger.info('[Analytics] Iniciando fetch com filtros:', filterParams);
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
      Logger.info(`[Analytics] Dados carregados em ${Math.round(endTime - startTime)}ms`);

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
      Logger.error('[Analytics] Erro ao carregar dados:', error);
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
