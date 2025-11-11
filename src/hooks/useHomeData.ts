import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  nome: string;
  materia: string;
  link: string;
}

export const useHomeData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [meuDiaItems, setMeuDiaItems] = useState<MeuDiaItem[]>([]);
  const [hasStudyGuide, setHasStudyGuide] = useState(false);
  const [hasCronograma, setHasCronograma] = useState(false);
  const [rankings, setRankings] = useState<RankingData>({});
  const [topAulas, setTopAulas] = useState<TopAula[]>([]);
  const [conteudosRelacionados, setConteudosRelacionados] = useState<any[]>([]);
  const [simuladoData, setSimuladoData] = useState<SimuladoPerformance | null>(null);
  
  // Cache leve em sessionStorage para evitar skeleton em revisitas rápidas
  const cacheKey = user ? `home_data_cache_${user.id}` : null;
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

  useEffect(() => {
    if (user) {
      // Tenta restaurar dados do cache para evitar mostrar skeleton
      if (cacheKey) {
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS) {
              setMeuDiaItems(parsed.meuDiaItems || []);
              setHasStudyGuide(!!parsed.hasStudyGuide);
              setHasCronograma(!!parsed.hasCronograma);
              setRankings(parsed.rankings || {});
              setTopAulas(parsed.topAulas || []);
              setConteudosRelacionados(parsed.conteudosRelacionados || []);
              setSimuladoData(parsed.simuladoData || null);
              // Evita skeleton imediato; atualiza silenciosamente em background
              setLoading(false);
              fetchAllData(true);
              return;
            }
          }
        } catch (e) {
          console.warn('Falha ao ler cache da Home:', e);
        }
      }

      // Sem cache válido: carrega normalmente
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    }
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
  };

  const fetchMeuDia = async () => {
    if (!user?.id_ies || !user?.semestre) return;

    const items: MeuDiaItem[] = [];

    // Check for study guide content
    const { data: studyGuideData } = await supabase
      .from('conteudos')
      .select('*')
      .eq('id_ies', user.id_ies)
      .eq('semestre', user.semestre.toString())
      .limit(1);

    if (studyGuideData && studyGuideData.length > 0) {
      setHasStudyGuide(true);
      items.push({
        id: 'guia',
        type: 'guia',
        title: 'Guia de Estudos',
        subtitle: 'Continue seus estudos',
        path: '/guia-estudos',
        icon: 'BookOpen',
        color: 'from-blue-500 to-cyan-500',
      });
    }

    // Check for cronograma
    const { data: cronogramaData } = await supabase
      .from('calendar_subjects')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);

    if (cronogramaData && cronogramaData.length > 0) {
      setHasCronograma(true);
    }

    // Matéria do dia (do calendário) + sugestão de aula não concluída
    try {
      const today = new Date().getDay(); // 0 (Dom) - 6 (Sáb)
      const { data: todaySubjects } = await supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_of_week', today)
        .order('start_time', { ascending: true })
        .limit(1);

      let subjectName: string | null = todaySubjects && todaySubjects[0]?.name ? todaySubjects[0].name : null;

      // Fallback: usar calendar_arrangements quando não há registros em calendar_subjects
      if (!subjectName) {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayName = dayNames[today];
        const { data: arrangements } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', user.id)
          .eq('day', todayName)
          .order('position', { ascending: true })
          .limit(1);
        subjectName = arrangements && arrangements[0]?.item_key ? arrangements[0].item_key : null;
      }

      if (subjectName) {
        // Buscar aulas da matéria
        const { data: materiaConteudos } = await supabase
          .from('conteudos')
          .select('id, aula, materia, link_aula')
          .eq('id_ies', user.id_ies)
          .eq('semestre', user.semestre.toString())
          .eq('materia', subjectName)
          .not('link_aula', 'is', null)
          .limit(20);

        // Buscar itens concluídos pelo usuário para essa matéria
        const { data: completed } = await supabase
          .from('study_progress')
          .select('content_id')
          .eq('user_id', user.id)
          .eq('materia_id', subjectName)
          .eq('semestre', user.semestre)
          .eq('ies_nome', user.ies_nome || '')
          .eq('content_type', 'aula')
          .eq('completed', true);

        const completedSet = new Set((completed || []).map((c: any) => String(c.content_id)));
        const suggestion = (materiaConteudos || []).find((c: any) => !completedSet.has(String(c.id)));

        items.push({
          id: `materia-${subjectName}`,
          type: 'materia',
          title: subjectName,
          subtitle: suggestion ? `Sugestão: ${suggestion.aula}` : 'Matéria do dia',
          path: `/guia-estudos?materia=${encodeURIComponent(subjectName)}`,
          icon: 'BookOpen',
          color: 'from-emerald-500 to-teal-500',
          lessonLink: suggestion?.link_aula || undefined,
        });
      }
    } catch (e) {
      // Falha opcional ao sugerir aula - não bloquear Meu Dia
      console.warn('Falha ao montar matéria do dia/sugestão de aula:', e);
    }

    // Check for intensivo
    const { data: intensivoData } = await supabase
      .from('intensivouscs')
      .select('*')
      .limit(1);

    if (intensivoData && intensivoData.length > 0) {
      items.push({
        id: 'intensivo',
        type: 'intensivo',
        title: 'Intensivo ENAMED',
        subtitle: 'Conteúdo focado',
        path: '/intensivao-enamed',
        icon: 'Zap',
        color: 'from-purple-500 to-pink-500',
      });
    }

    // Check for pending simulado
    const { data: simuladoData } = await supabase
      .from('Simulados')
      .select('id, Simulado')
      .limit(1);

    if (simuladoData && simuladoData.length > 0) {
      items.push({
        id: 'simulado',
        type: 'simulado',
        title: 'Simulado Disponível',
        subtitle: 'Teste seus conhecimentos',
        path: '/desempenho-simulado',
        icon: 'BarChart3',
        color: 'from-orange-500 to-red-500',
      });
    }

    setMeuDiaItems(items);
    return {
      items,
      hasStudyGuide: !!(studyGuideData && studyGuideData.length > 0),
      hasCronograma: !!(cronogramaData && cronogramaData.length > 0)
    };
  };

  const fetchRankings = async () => {
    if (!user?.email) return;

    try {
      // Fetch real simulado ranking
      const { data: rankingData } = await supabase
        .rpc('get_user_rankings', { p_simulado_id: null });

      if (rankingData && typeof rankingData === 'object') {
        const ranking = rankingData as any;
        const next: RankingData = {
          simuladoRank: ranking.rankingIES?.rank,
          simuladoTotal: ranking.rankingIES?.total,
          // Mock data for content consumption ranking
          conteudoRank: Math.floor(Math.random() * 50) + 1,
          conteudoTotal: 150,
        };
        setRankings(next);
        return next;
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
    }
  };

  const fetchTopAulas = async () => {
    if (!user?.id_ies || !user?.semestre) return;

    const { data } = await supabase
      .from('conteudos')
      .select('id, aula, materia, link_aula')
      .eq('id_ies', user.id_ies)
      .eq('semestre', user.semestre.toString())
      .not('link_aula', 'is', null)
      .limit(3);

    if (data) {
      const aulas = data.map((item) => ({
        id: item.id,
        nome: item.aula || 'Sem título',
        materia: item.materia || 'Matéria',
        link: item.link_aula || '#',
      }));
      setTopAulas(aulas);

      // Mock related content
      const relacionados = [
        { id: '1', titulo: 'Revisão de Cardiologia', tipo: 'PDF' },
        { id: '2', titulo: 'Quiz de Anatomia', tipo: 'Quiz' },
      ];
      setConteudosRelacionados(relacionados);
      return { aulas, relacionados };
    }
    return undefined;
  };

  const fetchSimuladoData = async () => {
    if (!user?.email) return;

    try {
      const { data: answerData } = await supabase
        .from('answer_progress_enamed')
        .select('simulado, correct, question_id')
        .eq('email', user.email)
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
          .from('Simulados')
          .select('Simulado')
          .eq('id', latestSimulado)
          .single();

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
          simuladoNome: simuladoInfo?.Simulado || 'Simulado',
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
