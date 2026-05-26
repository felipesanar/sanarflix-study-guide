import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimuladoPerformance } from '@/hooks/useHomeData';
import { Logger } from '@/utils/logger';

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
      // 1. Find the LAST finalized simulado by actual timestamp
      const { data: lastFinalization } = await supabase
        .from('simulados_finalizados')
        .select('simulado_id, tempo_total_segundos, finalizado_em')
        .eq('user_id', user.id)
        .order('finalizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastFinalization) return null;

      const latestSimulado = lastFinalization.simulado_id;

      // 2. Get answers for this specific simulado, excluding annulled questions
      const { data: answerData } = await supabase
        .from('answer_progress')
        .select('correct, question_id')
        .eq('user_id', user.id)
        .eq('simulado', latestSimulado);

      // Get annulled question IDs
      const { data: annulledQuestions } = await supabase
        .from('questoes_simulado')
        .select('id')
        .eq('simulado_id', latestSimulado)
        .eq('anulada', true);

      const annulledIds = new Set((annulledQuestions || []).map(q => q.id));
      const validAnswers = (answerData || []).filter(a => !annulledIds.has(a.question_id));

      const total = validAnswers.length;
      const corrects = validAnswers.filter((a) => a.correct).length;
      const nota = total > 0 ? Math.round((corrects / total) * 100) : 0;

      // 3. Format actual time from seconds
      const totalSeconds = lastFinalization.tempo_total_segundos || 0;
      const minutes = Math.round(totalSeconds / 60);
      const tempoFormatado = minutes > 0 ? `${minutes}` : '<1';

      // 4. Get simulado name
      const { data: simuladoInfo } = await supabase
        .from('simulados_admin')
        .select('nome')
        .eq('id', latestSimulado)
        .maybeSingle();

      // 5. Get ranking for THIS specific simulado
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
        tempoGasto: tempoFormatado,
        ranking,
        totalAlunos,
        simuladoNome: simuladoInfo?.nome || 'Simulado',
      };

      setSimuladoData(result);
      return result;
    } catch (error) {
      Logger.error('Error fetching simulado data:', error);
      return null;
    }
  };

  return { simuladoData, fetchSimuladoData };
};
