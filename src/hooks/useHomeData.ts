import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StudyItem {
  id: string;
  title: string;
  type: 'guia' | 'intensivo' | 'simulado';
  progress?: string;
  link: string;
}

interface RankingData {
  position: number;
  total: number;
  variation: number;
  type: 'geral' | 'semestre' | 'simulado';
}

interface TopAula {
  id: string;
  titulo: string;
  materia: string;
  acessos: number;
  link: string;
}

interface ConteudoRelacionado {
  id: string;
  titulo: string;
  tipo: 'prova' | 'reforco';
  link: string;
}

interface SimuladoData {
  nome: string;
  nota: number;
  posicao: number;
  totalParticipantes: number;
  tempoGasto: string;
  dataRealizacao: string;
}

interface HomeData {
  meuDiaItems: StudyItem[];
  rankings: RankingData[];
  topAulas: TopAula[];
  conteudosRelacionados: ConteudoRelacionado[];
  simuladoData?: SimuladoData;
  hasStudyGuide: boolean;
  hasCronograma: boolean;
}

export const useHomeData = () => {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData>({
    meuDiaItems: [],
    rankings: [],
    topAulas: [],
    conteudosRelacionados: [],
    hasStudyGuide: false,
    hasCronograma: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHomeData();
    }
  }, [user]);

  const fetchHomeData = async () => {
    try {
      setLoading(true);

      // Buscar dados em paralelo
      const [
        meuDiaItems,
        rankings,
        topAulas,
        conteudosRelacionados,
        simuladoData,
        guideCheck,
        cronogramaCheck,
      ] = await Promise.all([
        fetchMeuDia(),
        fetchRankings(),
        fetchTopAulas(),
        fetchConteudosRelacionados(),
        fetchSimuladoData(),
        checkStudyGuide(),
        checkCronograma(),
      ]);

      setData({
        meuDiaItems,
        rankings,
        topAulas,
        conteudosRelacionados,
        simuladoData,
        hasStudyGuide: guideCheck,
        hasCronograma: cronogramaCheck,
      });
    } catch (error) {
      console.error('Erro ao buscar dados da home:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeuDia = async (): Promise<StudyItem[]> => {
    const items: StudyItem[] = [];

    try {
      // Verificar se há progresso no guia de estudos hoje
      const { data: studyProgress } = await supabase
        .from('study_progress')
        .select('*')
        .eq('user_id', user?.id)
        .eq('completed', false)
        .limit(3);

      if (studyProgress && studyProgress.length > 0) {
        const totalItems = studyProgress.length;
        const completedItems = studyProgress.filter(p => p.completed).length;
        
        items.push({
          id: 'study-guide',
          title: 'Guia de Estudos',
          type: 'guia',
          progress: `${completedItems}/${totalItems} concluídas`,
          link: '/guia-estudos',
        });
      }

      // Verificar intensivo ENAMED disponível
      const { data: intensivoData } = await supabase
        .from('intensivouscs')
        .select('*')
        .limit(1);

      if (intensivoData && intensivoData.length > 0) {
        items.push({
          id: 'intensivo',
          title: 'Intensivo ENAMED',
          type: 'intensivo',
          progress: 'Disponível',
          link: '/intensivao-enamed',
        });
      }

      // Verificar simulados disponíveis
      const { data: simulados } = await supabase
        .from('Simulados')
        .select('*')
        .limit(1);

      if (simulados && simulados.length > 0) {
        items.push({
          id: 'simulado',
          title: 'Simulado Disponível',
          type: 'simulado',
          progress: 'Não iniciado',
          link: '/desempenho-simulado',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar Meu Dia:', error);
    }

    return items;
  };

  const fetchRankings = async (): Promise<RankingData[]> => {
    try {
      // Buscar ranking usando a função do banco
      const { data: rankingData, error } = await supabase
        .rpc('get_user_rankings', { p_simulado_id: null });

      if (error) throw error;

      const rankings: RankingData[] = [];

      // Type guard para verificar se rankingData é um objeto válido
      if (rankingData && typeof rankingData === 'object' && !Array.isArray(rankingData)) {
        const data = rankingData as { rankingIES?: { rank?: number; total?: number }; rankingSemester?: { rank?: number; total?: number } };
        
        if (data.rankingIES) {
          rankings.push({
            position: data.rankingIES.rank || 0,
            total: data.rankingIES.total || 0,
            variation: 0, // Pode ser calculado comparando com dados anteriores
            type: 'geral',
          });
        }

        if (data.rankingSemester) {
          rankings.push({
            position: data.rankingSemester.rank || 0,
            total: data.rankingSemester.total || 0,
            variation: 0,
            type: 'semestre',
          });
        }
      }

      return rankings;
    } catch (error) {
      console.error('Erro ao buscar rankings:', error);
      return [];
    }
  };

  const fetchTopAulas = async (): Promise<TopAula[]> => {
    try {
      // Buscar as aulas mais acessadas do semestre
      const { data: conteudos, error } = await supabase
        .from('conteudos')
        .select('id, tema, materia, link_aula')
        .eq('semestre', user?.semestre?.toString() || '1')
        .eq('id_ies', user?.id_ies)
        .limit(3);

      if (error) throw error;

      return conteudos?.map((c, index) => ({
        id: c.id,
        titulo: c.tema || 'Sem título',
        materia: c.materia || 'Sem matéria',
        acessos: 200 - (index * 25), // Mock temporário
        link: c.link_aula || 'https://www.sanarflix.com.br',
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar top aulas:', error);
      return [];
    }
  };

  const fetchConteudosRelacionados = async (): Promise<ConteudoRelacionado[]> => {
    // Mock - em produção, buscar de uma tabela de materiais complementares
    return [
      {
        id: '1',
        titulo: 'Material de Reforço',
        tipo: 'reforco',
        link: '#',
      },
    ];
  };

  const fetchSimuladoData = async (): Promise<SimuladoData | undefined> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) return undefined;

      // Buscar último simulado respondido
      const { data: lastAnswers, error } = await supabase
        .from('answer_progress_enamed')
        .select('simulado, correct')
        .eq('email', authUser.email)
        .order('answer_id', { ascending: false })
        .limit(100);

      if (error || !lastAnswers || lastAnswers.length === 0) return undefined;

      // Agrupar por simulado
      const simuladoId = lastAnswers[0].simulado;
      const respostasDoSimulado = lastAnswers.filter(a => a.simulado === simuladoId);
      
      const totalQuestoes = respostasDoSimulado.length;
      const acertos = respostasDoSimulado.filter(a => a.correct).length;
      const nota = Math.round((acertos / totalQuestoes) * 100);

      // Buscar nome do simulado
      const { data: simulado } = await supabase
        .from('Simulados')
        .select('Simulado')
        .eq('id', simuladoId)
        .single();

      // Buscar ranking do simulado
      const { data: rankingData } = await supabase
        .rpc('get_user_rankings', { p_simulado_id: simuladoId });

      // Type guard para rankingData
      const ranking = rankingData && typeof rankingData === 'object' && !Array.isArray(rankingData)
        ? rankingData as { rankingIES?: { rank?: number; total?: number } }
        : null;

      return {
        nome: simulado?.Simulado || 'Simulado ENAMED',
        nota,
        posicao: ranking?.rankingIES?.rank || 0,
        totalParticipantes: ranking?.rankingIES?.total || 0,
        tempoGasto: '2h 15min', // Mock - calcular em produção
        dataRealizacao: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Erro ao buscar dados do simulado:', error);
      return undefined;
    }
  };

  const checkStudyGuide = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('study_progress')
        .select('id')
        .eq('user_id', user?.id)
        .limit(1);

      return !error && data && data.length > 0;
    } catch {
      return false;
    }
  };

  const checkCronograma = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('calendar_subjects')
        .select('id')
        .eq('user_id', user?.id)
        .limit(1);

      return !error && data && data.length > 0;
    } catch {
      return false;
    }
  };

  return { data, loading, refetch: fetchHomeData };
};
