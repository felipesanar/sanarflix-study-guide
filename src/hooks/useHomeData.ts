import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MeuDiaItem {
  id: string;
  type: 'guia' | 'intensivo' | 'simulado';
  title: string;
  subtitle?: string;
  path: string;
  icon: string;
  color: string;
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

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchMeuDia(),
      fetchRankings(),
      fetchTopAulas(),
      fetchSimuladoData(),
    ]);
    setLoading(false);
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
  };

  const fetchRankings = async () => {
    if (!user?.email) return;

    try {
      // Fetch real simulado ranking
      const { data: rankingData } = await supabase
        .rpc('get_user_rankings', { p_simulado_id: null });

      if (rankingData && typeof rankingData === 'object') {
        const ranking = rankingData as any;
        setRankings({
          simuladoRank: ranking.rankingIES?.rank,
          simuladoTotal: ranking.rankingIES?.total,
          // Mock data for content consumption ranking
          conteudoRank: Math.floor(Math.random() * 50) + 1,
          conteudoTotal: 150,
        });
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
      setTopAulas(
        data.map((item) => ({
          id: item.id,
          nome: item.aula || 'Sem título',
          materia: item.materia || 'Matéria',
          link: item.link_aula || '#',
        }))
      );

      // Mock related content
      setConteudosRelacionados([
        { id: '1', titulo: 'Revisão de Cardiologia', tipo: 'PDF' },
        { id: '2', titulo: 'Quiz de Anatomia', tipo: 'Quiz' },
      ]);
    }
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

        setSimuladoData({
          nota,
          tempoGasto: '45min',
          ranking,
          totalAlunos,
          simuladoNome: simuladoInfo?.Simulado || 'Simulado',
        });
      }
    } catch (error) {
      console.error('Error fetching simulado data:', error);
    }
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
