import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimuladoPerformance } from '@/hooks/useHomeData';

interface User {
  id: string;
}

/**
 * Hook extraído de useHomeData para buscar performance em simulados
 * Responsável por: nota, tempo, ranking do último simulado
 */
export const useSimuladoPerformance = () => {
  const [simuladoData, setSimuladoData] = useState<SimuladoPerformance | null>(null);

  const fetchSimuladoData = async (user: User): Promise<SimuladoPerformance | null> => {
    if (!user?.id) return null;

    try {
      const { data: answerData } = await supabase
        .from('answer_progress')
        .select('simulado, correct, question_id')
        .eq('user_id', user.id)
        .order('simulado', { ascending: false });

      if (!answerData || answerData.length === 0) return null;

      // Último simulado
      const latestSimulado = answerData[0].simulado;
      const simuladoAnswers = answerData.filter((a) => a.simulado === latestSimulado);
      const corrects = simuladoAnswers.filter((a) => a.correct).length;
      const total = simuladoAnswers.length;
      const nota = total > 0 ? Math.round((corrects / total) * 100) : 0;

      // Nome do simulado
      const { data: simuladoInfo } = await supabase
        .from('simulados_admin')
        .select('nome')
        .eq('id', latestSimulado)
        .maybeSingle();

      // Ranking
      const { data: rankingData } = await supabase.rpc('get_user_rankings', { p_simulado_id: latestSimulado });

      let ranking = 0;
      let totalAlunos = 0;

      if (rankingData && typeof rankingData === 'object') {
        const rankingObj = rankingData as { rankingIES?: { rank?: number; total?: number } };
        ranking = rankingObj.rankingIES?.rank || 0;
        totalAlunos = rankingObj.rankingIES?.total || 0;
      }

      const result: SimuladoPerformance = {
        nota,
        tempoGasto: '45min',
        ranking,
        totalAlunos,
        simuladoNome: simuladoInfo?.nome || 'Simulado',
      };

      setSimuladoData(result);
      return result;
    } catch (error) {
      console.error('Error fetching simulado data:', error);
      return null;
    }
  };

  return { simuladoData, fetchSimuladoData };
};
