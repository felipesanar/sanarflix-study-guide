import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  usuariosPorSemestre: { semestre: number; quantidade: number }[];
}

export interface SimuladoMetrics {
  simuladosDisponiveis: { id: string; nome: string; total_questoes: number; iniciados: number; finalizados: number; taxa_conclusao: number }[];
  desempenhoGeral: { media_acertos: number; total_respostas: number };
  questoesProblematicas: { questao_id: string; enunciado: string; taxa_erro: number }[];
}

export interface AnalyticsData {
  overview: OverviewMetrics;
  engagement: EngagementMetrics;
  progress: ProgressMetrics;
  demographics: DemographicsMetrics;
  simulados: SimuladoMetrics;
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
  isLoading: true,
  error: null,
  lastUpdated: null,
};

export function useAnalyticsData(filters: AnalyticsFiltersState) {
  const [data, setData] = useState<AnalyticsData>(defaultMetrics);

  const fetchOverviewMetrics = useCallback(async (): Promise<OverviewMetrics> => {
    const hoje = new Date().toISOString().split('T')[0];
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Total de usuários
    const { count: totalUsuarios } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Sessões de hoje
    const { data: sessoesHoje, count: countSessoes } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact' })
      .gte('started_at', hoje);

    // Usuários únicos ativos hoje (por sessões)
    const { data: usuariosAtivosHojeData } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('started_at', hoje);
    const usuariosAtivosHoje = new Set(usuariosAtivosHojeData?.map(s => s.user_id) || []).size;

    // Usuários únicos ativos últimos 7 dias
    const { data: usuariosAtivos7DiasData } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('started_at', seteDiasAtras);
    const usuariosAtivos7Dias = new Set(usuariosAtivos7DiasData?.map(s => s.user_id) || []).size;

    // Média de tempo de sessão (segundos)
    const { data: sessoesDuracao } = await supabase
      .from('user_sessions')
      .select('duration_seconds')
      .not('duration_seconds', 'is', null)
      .gte('started_at', seteDiasAtras);
    const mediaTempoSessao = sessoesDuracao?.length
      ? sessoesDuracao.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / sessoesDuracao.length / 60
      : 0;

    // Page views de hoje
    const { count: pageViewsHoje } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoje);

    // Simulados iniciados hoje
    const { count: simuladosIniciadosHoje } = await supabase
      .from('simulados_iniciados')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', hoje);

    // Simulados finalizados hoje
    const { count: simuladosFinalizadosHoje } = await supabase
      .from('simulados_finalizados')
      .select('*', { count: 'exact', head: true })
      .gte('finalizado_em', hoje);

    // SanarClass views hoje
    const { count: sanarclassViewsHoje } = await supabase
      .from('sanarclass_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoje);

    // Taxa de abandono de simulados
    const { count: totalIniciados } = await supabase
      .from('simulados_iniciados')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', filters.dateRange.start.toISOString())
      .lte('started_at', filters.dateRange.end.toISOString());

    const { count: totalFinalizados } = await supabase
      .from('simulados_finalizados')
      .select('*', { count: 'exact', head: true })
      .gte('finalizado_em', filters.dateRange.start.toISOString())
      .lte('finalizado_em', filters.dateRange.end.toISOString());

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
      simuladosIniciadosHoje: simuladosIniciadosHoje || 0,
      simuladosFinalizadosHoje: simuladosFinalizadosHoje || 0,
      sanarclassViewsHoje: sanarclassViewsHoje || 0,
      taxaAbandonoSimulados,
    };
  }, [filters.dateRange]);

  const fetchEngagementMetrics = useCallback(async (): Promise<EngagementMetrics> => {
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Sessões por dia
    const { data: sessoesBrutas } = await supabase
      .from('user_sessions')
      .select('started_at, duration_seconds, is_mobile')
      .gte('started_at', seteDiasAtras)
      .order('started_at', { ascending: true });

    // Agrupar sessões por dia
    const sessoesPorDiaMap = new Map<string, { count: number; totalDuration: number }>();
    sessoesBrutas?.forEach((s) => {
      const dia = s.started_at.split('T')[0];
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

    // Page views por página
    const { data: pageViewsBrutas } = await supabase
      .from('page_views')
      .select('page_path')
      .gte('created_at', seteDiasAtras);

    const pageViewsMap = new Map<string, number>();
    pageViewsBrutas?.forEach((pv) => {
      const count = pageViewsMap.get(pv.page_path) || 0;
      pageViewsMap.set(pv.page_path, count + 1);
    });

    const pageViewsPorPagina = Array.from(pageViewsMap.entries())
      .map(([pagina, views]) => ({ pagina, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Horários de pico
    const horarioMap = new Map<number, number>();
    sessoesBrutas?.forEach((s) => {
      const hora = new Date(s.started_at).getHours();
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
  }, []);

  const fetchProgressMetrics = useCallback(async (): Promise<ProgressMetrics> => {
    // Progresso por matéria
    const { data: progressoBruto } = await supabase
      .from('study_progress')
      .select('materia_id, completed');

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
    const { data: usuarioProgressos } = await supabase
      .from('study_progress')
      .select('user_id, completed');

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
  }, []);

  const fetchDemographicsMetrics = useCallback(async (): Promise<DemographicsMetrics> => {
    // Usuários por IES
    const { data: usuariosData } = await supabase
      .from('users')
      .select('id_ies, semestre');

    // Buscar nomes das IES
    const { data: iesData } = await supabase
      .from('ies')
      .select('id, nome');

    const iesMap = new Map(iesData?.map(i => [i.id, i.nome]) || []);

    const usuariosPorIESMap = new Map<string, number>();
    const usuariosPorSemestreMap = new Map<number, number>();

    usuariosData?.forEach((u) => {
      if (u.id_ies) {
        const count = usuariosPorIESMap.get(u.id_ies) || 0;
        usuariosPorIESMap.set(u.id_ies, count + 1);
      }
      if (u.semestre) {
        const count = usuariosPorSemestreMap.get(u.semestre) || 0;
        usuariosPorSemestreMap.set(u.semestre, count + 1);
      }
    });

    const usuariosPorIES = Array.from(usuariosPorIESMap.entries())
      .map(([ies_id, quantidade]) => ({
        ies_id,
        ies_nome: iesMap.get(ies_id) || 'Desconhecida',
        quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const usuariosPorSemestre = Array.from(usuariosPorSemestreMap.entries())
      .map(([semestre, quantidade]) => ({ semestre, quantidade }))
      .sort((a, b) => a.semestre - b.semestre);

    return {
      usuariosPorIES,
      usuariosPorSemestre,
    };
  }, []);

  const fetchSimuladoMetrics = useCallback(async (): Promise<SimuladoMetrics> => {
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

    // Iniciados por simulado
    const { data: iniciadosData } = await supabase
      .from('simulados_iniciados')
      .select('simulado_id');

    const iniciadosPorSimulado = new Map<string, number>();
    iniciadosData?.forEach((i) => {
      const count = iniciadosPorSimulado.get(i.simulado_id) || 0;
      iniciadosPorSimulado.set(i.simulado_id, count + 1);
    });

    // Finalizados por simulado
    const { data: finalizadosData } = await supabase
      .from('simulados_finalizados')
      .select('simulado_id');

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

    // Questões problemáticas (maior taxa de erro)
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

    const questoesProblematicas = Array.from(questaoStats.entries())
      .map(([questao_id, stats]) => ({
        questao_id,
        enunciado: `Questão ${questao_id.slice(0, 8)}...`,
        taxa_erro: stats.total > 0 ? Math.round(((stats.total - stats.corretas) / stats.total) * 100) : 0,
      }))
      .filter(q => q.taxa_erro >= 50)
      .sort((a, b) => b.taxa_erro - a.taxa_erro)
      .slice(0, 10);

    return {
      simuladosDisponiveis,
      desempenhoGeral: {
        media_acertos: mediaAcertos,
        total_respostas: totalRespostas,
      },
      questoesProblematicas,
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [overview, engagement, progress, demographics, simulados] = await Promise.all([
        fetchOverviewMetrics(),
        fetchEngagementMetrics(),
        fetchProgressMetrics(),
        fetchDemographicsMetrics(),
        fetchSimuladoMetrics(),
      ]);

      setData({
        overview,
        engagement,
        progress,
        demographics,
        simulados,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('[AnalyticsCapture] Erro ao carregar dados:', error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar dados',
      }));
    }
  }, [fetchOverviewMetrics, fetchEngagementMetrics, fetchProgressMetrics, fetchDemographicsMetrics, fetchSimuladoMetrics]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refetch = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  return { ...data, refetch };
}
