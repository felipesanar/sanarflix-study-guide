import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilDayOfWeek } from '@/utils/timezone';

export interface MeuDiaItem {
  id: string;
  type: 'guia' | 'intensivo' | 'simulado' | 'materia';
  title: string;
  subtitle?: string;
  path: string; // caminho principal (ex.: guia com matéria pré-selecionada)
  icon: string;
  color: string;
  // Link direto para aula sugerida (caso exista)
  lessonLink?: string;
  // Origem dos dados: calendário pessoal ou cronograma ENAMED
  source?: 'calendar' | 'cronograma_enamed' | 'fallback';
  // Metadados para deep linking
  aulaId?: string;      // ID da aula específica
  aulaNome?: string;    // Nome completo da aula
  temaNome?: string;    // Nome do tema
  subtemaNome?: string; // Nome do subtema
}

export interface RankingData {
  simuladoRank?: number;
  simuladoTotal?: number;
  conteudoRank?: number;
  conteudoTotal?: number;
}

export interface SimuladoPerformance {
  nota: number;
  tempoGasto: string;
  ranking: number;
  totalAlunos: number;
  simuladoNome: string;
}

export interface TopAula {
  id: string;
  conteudo: string;
  curso: string;
  link: string;
  tipo: 'videos' | 'questoes';
}

// Função para ler cache sincronamente (antes do estado inicial)
const readCacheSync = (userId: string): any | null => {
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
  try {
    const raw = sessionStorage.getItem(`home_data_cache_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Falha ao ler cache da Home:', e);
  }
  return null;
};

export const useHomeData = () => {
  const { user } = useAuth();
  
  // Ler cache SINCRONAMENTE para definir estados iniciais corretamente
  const cachedData = user ? readCacheSync(user.id) : null;
  
  // Estados inicializados com cache (evita skeleton em revisitas)
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const [meuDiaItems, setMeuDiaItems] = useState<MeuDiaItem[]>(cachedData?.meuDiaItems || []);
  const [hasStudyGuide, setHasStudyGuide] = useState(!!cachedData?.hasStudyGuide);
  const [hasCronograma, setHasCronograma] = useState(!!cachedData?.hasCronograma);
  const [rankings, setRankings] = useState<RankingData>(cachedData?.rankings || {});
  const [topAulas, setTopAulas] = useState<TopAula[]>(cachedData?.topAulas || []);
  const [conteudosRelacionados, setConteudosRelacionados] = useState<any[]>(cachedData?.conteudosRelacionados || []);
  const [simuladoData, setSimuladoData] = useState<SimuladoPerformance | null>(cachedData?.simuladoData || null);

  const cacheKey = user ? `home_data_cache_${user.id}` : null;
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

  useEffect(() => {
    if (user) {
      // Se já carregou do cache sincronamente, só atualiza em background
      if (cachedData) {
        fetchAllData(true); // silent update
        return;
      }
      // Sem cache válido: carrega normalmente
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      setError(null);
      const [meuDiaRes, rankingsRes, topAulasRes, simuladoRes] = await Promise.all([
        fetchMeuDia(),
        fetchRankings(),
        fetchTopAulas(),
        fetchSimuladoData(),
      ]);
      setLoading(false);

      // Atualiza cache com dados atuais
      if (cacheKey) {
        try {
          const payload = {
            timestamp: Date.now(),
            meuDiaItems: meuDiaRes?.items ?? meuDiaItems,
            hasStudyGuide: meuDiaRes?.hasStudyGuide ?? hasStudyGuide,
            hasCronograma: meuDiaRes?.hasCronograma ?? hasCronograma,
            rankings: rankingsRes ?? rankings,
            topAulas: topAulasRes?.aulas ?? topAulas,
            conteudosRelacionados: topAulasRes?.relacionados ?? conteudosRelacionados,
            simuladoData: simuladoRes ?? simuladoData,
          };
          sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch (e) {
          console.warn('Falha ao salvar cache da Home:', e);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados da Home:', error);
      setError('Não foi possível carregar os dados. Tente novamente.');
      setLoading(false);
    }
  };

  const fetchMeuDia = async () => {
    if (!user?.id_ies || !user?.semestre) return;

    const items: MeuDiaItem[] = [];

    // 🚀 Paralelizar queries principais para melhor performance
    const [studyGuideRes, cronogramaRes, simuladoRes] = await Promise.all([
      supabase
        .from('conteudos')
        .select('*')
        .eq('id_ies', user.id_ies)
        .eq('semestre', user.semestre.toString())
        .limit(1),
      supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .limit(1),
      supabase
        .from('simulados_admin')
        .select('id, nome, status')
        .eq('status', 'ativo'),
    ]);

    // Process study guide
    const studyGuideData = studyGuideRes.data;
    if (studyGuideData && studyGuideData.length > 0) {
      setHasStudyGuide(true);
    }

    // Process cronograma
    const cronogramaData = cronogramaRes.data;
    if (cronogramaData && cronogramaData.length > 0) {
      setHasCronograma(true);
    }

    // ⭐ Matérias do dia (do calendário) + sugestão de aula não concluída para cada uma
    try {
      // 🌍 Usar fuso de Brasília (GMT-3) para consistência com sistema de lembretes
      const today = getBrazilDayOfWeek(); // 0 (Dom) - 6 (Sáb)



      // Buscar TODAS as matérias agendadas para hoje
      const { data: todaySubjects, error: subjectsError } = await supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_of_week', today)
        .order('name', { ascending: true });


      if (subjectsError) console.error('❌ [Meu Dia] Erro ao buscar calendar_subjects:', subjectsError);

      let subjectsToProcess: string[] = [];

      if (todaySubjects && todaySubjects.length > 0) {
        subjectsToProcess = todaySubjects.map((s: any) => s.name);
      } else {
        // Fallback: usar calendar_arrangements
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayName = dayNames[today];


        const { data: arrangements, error: arrangementsError } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', user.id)
          .eq('day', todayName)
          .order('position', { ascending: true });


        if (arrangementsError) console.error('❌ [Meu Dia] Erro ao buscar calendar_arrangements:', arrangementsError);

        if (arrangements && arrangements.length > 0) {
          subjectsToProcess = arrangements.map((a: any) => a.item_key);
        }
      }


      // Processar matérias do calendário pessoal se encontradas
      if (subjectsToProcess.length > 0) {
        // Processar matérias do calendário pessoal
        const subjectPromises = subjectsToProcess.map(async (subjectName) => {
          if (!subjectName) return null;

          try {
            const [materiaConteudosRes, completedRes] = await Promise.all([
              supabase
                .from('conteudos')
                .select('id, aula, materia, link_aula')
                .eq('id_ies', user.id_ies)
                .eq('semestre', user.semestre.toString())
                .eq('materia', subjectName)
                .not('link_aula', 'is', null)
                .limit(20),
              supabase
                .from('study_progress')
                .select('content_id')
                .eq('user_id', user.id)
                .eq('materia_id', subjectName)
                .eq('semestre', user.semestre)
                .eq('ies_nome', user.ies_nome || '')
                .eq('content_type', 'aula')
                .eq('completed', true)
            ]);

            const materiaConteudos = materiaConteudosRes.data;
            const completed = completedRes.data;

            const completedSet = new Set((completed || []).map((c: any) => String(c.content_id)));
            const suggestion = (materiaConteudos || []).find((c: any) => !completedSet.has(String(c.id)));

            // Buscar informações completas (tema e subtema) da aula sugerida
            let temaNome: string | undefined;
            let subtemaNome: string | undefined;

            if (suggestion) {
              const { data: aulaCompleta } = await supabase
                .from('conteudos')
                .select('tema, subtema')
                .eq('id', suggestion.id)
                .single();

              if (aulaCompleta) {
                temaNome = aulaCompleta.tema;
                subtemaNome = aulaCompleta.subtema;
              }
            }

            return {
              id: `materia-${subjectName}`,
              type: 'materia' as const,
              title: subjectName,
              subtitle: suggestion ? `Aula sugerida: ${suggestion.aula}` : 'Matéria agendada',
              path: suggestion && temaNome
                ? `/guia-estudos?materia=${encodeURIComponent(subjectName)}&aula=${encodeURIComponent(suggestion.aula)}&tema=${encodeURIComponent(temaNome)}&subtema=${encodeURIComponent(subtemaNome || '')}`
                : `/guia-estudos?materia=${encodeURIComponent(subjectName)}`,
              icon: 'BookOpen',
              color: 'from-emerald-500 to-teal-500',
              lessonLink: suggestion?.link_aula || undefined,
              source: 'calendar' as const,
              // Metadados para deep linking
              aulaId: suggestion?.id,
              aulaNome: suggestion?.aula,
              temaNome,
              subtemaNome,
            };
          } catch (error) {
            console.warn(`Erro ao processar matéria ${subjectName}:`, error);
            return null;
          }
        });

        const subjectItems = (await Promise.all(subjectPromises)).filter((item) => item !== null) as MeuDiaItem[];
        // Limitar a 2 matérias do calendário
        items.push(...subjectItems.slice(0, 2));
      }
    } catch (e) {
      console.error('❌ [Meu Dia] Erro ao montar matérias:', e);
    }



    // Adicionar "Simulado Disponível" somente se houver simulado ativo não respondido pelo usuário
    try {
      const { data: finalizados } = await supabase
        .from('simulados_finalizados')
        .select('simulado_id')
        .eq('user_id', user.id);

      const finalizadosIds = new Set((finalizados || []).map((r: any) => r.simulado_id));
      const ativos = (simuladoRes.data || []) as any[];
      const disponiveis = ativos.filter((s: any) => !finalizadosIds.has(s.id));
      let availableSimulado = disponiveis[0] || null;
      if (!availableSimulado && ativos.length > 0) {
        availableSimulado = ativos[0];
      }

      if (availableSimulado) {
        items.push({
          id: `simulado-${availableSimulado.id}-${Date.now()}`,
          type: 'simulado',
          title: 'Simulado Disponível',
          subtitle: availableSimulado.nome || 'Simulado',
          path: '/simulados',
          icon: 'Trophy',
          color: 'from-orange-500 to-red-500',
          source: 'fallback' as const,
        });
      }
    } catch (e) {
      console.warn('⚠️ [Meu Dia] Erro ao avaliar simulados disponíveis:', e);
    }

    // Intensivo ENAMED foi descontinuado - não adicionar mais

    setMeuDiaItems(items);
    return {
      items,
      hasStudyGuide: !!(studyGuideData && studyGuideData.length > 0),
      hasCronograma: !!(cronogramaData && cronogramaData.length > 0)
    };
  };

  const fetchRankings = async () => {
    if (!user?.id) return;

    try {
      const { data: simData } = await supabase.rpc('get_user_rankings', { p_simulado_id: null });
      const simuladoRank = (simData as any)?.rankingIES?.rank || 0;
      const simuladoTotal = (simData as any)?.rankingIES?.total || 0;

      let iesId = user.id_ies || null;
      let semestreVal: number | null = (user.semestre ?? null) as number | null;
      try {
        const [{ data: iesRpc }, { data: semRpc }] = await Promise.all([
          supabase.rpc('get_current_user_ies_id'),
          supabase.rpc('get_current_user_semester'),
        ]);
        if (iesRpc) iesId = iesRpc as string;
        if (semRpc !== null && semRpc !== undefined) semestreVal = semRpc as number;
      } catch {}

      if (!iesId || semestreVal === null || semestreVal === undefined) {
        const next: RankingData = { simuladoRank, simuladoTotal };
        setRankings(next);
        return next;
      }

      const sb: any = supabase;

      try {
        const { data: ranking } = await sb.rpc('get_cohort_consumo_ranking');
        if (ranking && ranking.length) {
          const total = ranking[0]?.total ?? ranking.length;
          const myRow = ranking.find((r: any) => r.supabase_user_id === user.id);
          const rv = Number(myRow?.rank_videos ?? total);
          const rq = Number(myRow?.rank_questoes ?? total);
          const best = Math.min(rv, rq);
          const next: RankingData = {
            simuladoRank,
            simuladoTotal,
            conteudoRank: best,
            conteudoTotal: total,
          };
          setRankings(next);
          return next;
        }
      } catch (e) {}

      const { data: usersRes } = await sb
        .from('users')
        .select('id')
        .eq('id_ies', iesId)
        .eq('semestre', semestreVal);

      const userIds = (usersRes || []).map((u: any) => u.id);

      const { data: mapRes } = await sb
        .from('supabase_to_metabase')
        .select('id, user_id_metabase')
        .in('id', userIds);

      const idToMetabase = new Map<string, string>();
      (mapRes || []).forEach((m: any) => idToMetabase.set(m.id, m.user_id_metabase));
      const metabaseIds = Array.from(idToMetabase.values());

      let consumoRes: any[] = [];
      if (metabaseIds.length > 0) {
        const { data: consumo } = await sb
          .from('consumo_metabase')
          .select('id, videos_assistidos, documentos_lidos, questoes_respondidas')
          .in('id', metabaseIds);
        consumoRes = consumo || [];
      }

      const consumoByMetabaseId = new Map<string, any>();
      consumoRes.forEach((c: any) => consumoByMetabaseId.set(c.id, c));

      const total = userIds.length;
      const sortBy = (key: 'videos_assistidos' | 'questoes_respondidas') => {
        return userIds
          .map((uid: string) => {
            const mid = idToMetabase.get(uid);
            const c = mid ? consumoByMetabaseId.get(mid) : null;
            const val = Number(c?.[key] ?? 0);
            return { uid, val };
          })
          .sort((a, b) => b.val - a.val);
      };

      const videosBoard = sortBy('videos_assistidos');
      const questsBoard = sortBy('questoes_respondidas');

      const myId = user.id;
      const myVideos = videosBoard.find((s) => s.uid === myId)?.val ?? 0;
      const myQuests = questsBoard.find((s) => s.uid === myId)?.val ?? 0;
      const videosIdx = videosBoard.findIndex((s) => s.uid === myId);
      const questsIdx = questsBoard.findIndex((s) => s.uid === myId);

      const allZeroVideos = videosBoard.every((s) => s.val === 0);
      const allZeroQuests = questsBoard.every((s) => s.val === 0);
      const lastZeroVideos = videosBoard.map((s) => s.val).lastIndexOf(0);
      const lastZeroQuests = questsBoard.map((s) => s.val).lastIndexOf(0);

      const videosPos = videosIdx >= 0
        ? (myVideos === 0
            ? (lastZeroVideos >= 0 ? lastZeroVideos + 1 : total)
            : (allZeroVideos ? total : videosIdx + 1))
        : total;

      const questsPos = questsIdx >= 0
        ? (myQuests === 0
            ? (lastZeroQuests >= 0 ? lastZeroQuests + 1 : total)
            : (allZeroQuests ? total : questsIdx + 1))
        : total;

      const bestPos = Math.min(videosPos, questsPos);

      const next: RankingData = {
        simuladoRank,
        simuladoTotal,
        conteudoRank: bestPos,
        conteudoTotal: total,
      };
      setRankings(next);
      return next;
    } catch (error) {
      console.error('Error fetching rankings:', error);
    }
  };

  const fetchTopAulas = async () => {
    if (!user?.id_ies || !user?.semestre) return;

    const sb: any = supabase;
    const base = () =>
      sb
        .from('dados_meu_semestre')
        .select('id, id_ies, semestre, curso, modulo, conteudo, tipo_conteudo, total_acessos, link_acesso');

    let dataRes = await base()
      .in('id_ies', [user.id_ies])
      .in('semestre', [user.semestre])
      .order('total_acessos', { ascending: false })
      .limit(12);

    let data = dataRes.data || [];

    if (!data || data.length === 0) {
      const retry = await base()
        .eq('id_ies', user.id_ies)
        .eq('semestre', String(user.semestre))
        .order('total_acessos', { ascending: false })
        .limit(12);
      data = retry.data || [];
    }

    if (!data || data.length === 0) {
      const retry2 = await base()
        .in('id_ies', [user.id_ies, String(user.id_ies)])
        .order('total_acessos', { ascending: false })
        .limit(12);
      data = retry2.data || [];
    }

    if (!data || data.length === 0) {
      try {
        const { data: iesServer } = await supabase.rpc('get_current_user_ies_id');
        const { data: semServer } = await supabase.rpc('get_current_user_semester');
        if (iesServer) {
          let srvQuery = base().in('id_ies', [iesServer, String(iesServer)]);
          if (semServer !== null && semServer !== undefined) {
            srvQuery = srvQuery.in('semestre', [semServer, String(semServer)]);
          }
          const srvRes = await srvQuery.order('total_acessos', { ascending: false }).limit(12);
          data = srvRes.data || [];
        }
      } catch {
        // Silently fail, will use fallback
      }
    }

    if (data && data.length > 0) {
      const aulas = (data || [])
        .slice(0, 3)
        .map((item: any) => ({
          id: item.id,
          conteudo: ['questões','aula'].includes(String(item.conteudo || '').toLowerCase()) ? (item.modulo || item.curso || 'Conteúdo') : (item.conteudo || 'Sem título'),
          curso: item.curso || 'Curso',
          link: item.link_acesso || '#',
          tipo: String(item.tipo_conteudo || '').toLowerCase().includes('quest') ? 'questoes' : 'videos',
        }));
      setTopAulas(aulas);

      const relacionados = (data || [])
        .slice(3, 9)
        .map((item: any) => ({
          id: item.id,
          conteudo: ['questões','aula'].includes(String(item.conteudo || '').toLowerCase()) ? (item.modulo || item.curso || 'Conteúdo') : (item.conteudo || 'Conteúdo'),
          curso: item.curso || 'Curso',
          link: item.link_acesso || '#',
        }));
      setConteudosRelacionados(relacionados);
      return { aulas, relacionados };
    }

    // Fallback: conteudos table
    const { data: conteudosData } = await supabase
      .from('conteudos')
      .select('id, aula, materia, link_aula, link_quiz')
      .eq('id_ies', user.id_ies)
      .eq('semestre', user.semestre.toString())
      .not('link_aula', 'is', null)
      .limit(12);

    if (conteudosData && conteudosData.length > 0) {
      const aulas = conteudosData.slice(0, 3).map((item: any) => ({
        id: item.id,
        conteudo: ['questões','aula'].includes(String(item.aula || '').toLowerCase()) ? (item.materia || 'Conteúdo') : (item.aula || 'Sem título'),
        curso: item.materia || 'Matéria',
        link: item.link_quiz || item.link_aula || '#',
        tipo: item.link_quiz ? 'questoes' : 'videos',
      }));
      const relacionados = conteudosData.slice(3, 9).map((item: any) => ({
        id: item.id,
        conteudo: ['questões','aula'].includes(String(item.aula || '').toLowerCase()) ? (item.materia || 'Conteúdo') : (item.aula || 'Conteúdo'),
        curso: item.materia || 'Matéria',
        link: item.link_quiz || item.link_aula || '#',
      }));
      setTopAulas(aulas as TopAula[]);
      setConteudosRelacionados(relacionados);
      return { aulas, relacionados };
    }

    return undefined;
  };

  const fetchSimuladoData = async () => {
    if (!user?.id) return;

    try {
      const { data: answerData } = await supabase
        .from('answer_progress')
        .select('simulado, correct, question_id')
        .eq('user_id', user.id)
        .order('simulado', { ascending: false });

      if (answerData && answerData.length > 0) {
        // Get latest simulado
        const latestSimulado = answerData[0].simulado;
        const simuladoAnswers = answerData.filter((a) => a.simulado === latestSimulado);
        const corrects = simuladoAnswers.filter((a) => a.correct).length;
        const total = simuladoAnswers.length;
        const nota = total > 0 ? Math.round((corrects / total) * 100) : 0;

        // Get simulado name
        const { data: simuladoInfo } = await supabase
          .from('simulados_admin')
          .select('nome')
          .eq('id', latestSimulado)
          .maybeSingle();

        // Get ranking
        const { data: rankingData } = await supabase
          .rpc('get_user_rankings', { p_simulado_id: latestSimulado });

        let ranking = 0;
        let totalAlunos = 0;

        if (rankingData && typeof rankingData === 'object') {
          const rankingObj = rankingData as any;
          ranking = rankingObj.rankingIES?.rank || 0;
          totalAlunos = rankingObj.rankingIES?.total || 0;
        }

        const next: SimuladoPerformance = {
          nota,
          tempoGasto: '45min',
          ranking,
          totalAlunos,
          simuladoNome: simuladoInfo?.nome || 'Simulado',
        };
        setSimuladoData(next);
        return next;
      }
    } catch (error) {
      console.error('Error fetching simulado data:', error);
    }
    return null;
  };

  return {
    loading,
    error,
    meuDiaItems,
    hasStudyGuide,
    hasCronograma,
    rankings,
    topAulas,
    conteudosRelacionados,
    simuladoData,
    refetch: fetchAllData,
  };
};
