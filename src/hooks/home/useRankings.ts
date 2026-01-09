import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RankingData } from '@/hooks/useHomeData';

interface User {
  id: string;
  id_ies?: string;
  semestre?: number;
}

/**
 * Hook extraído de useHomeData para buscar rankings do usuário
 * Responsável por: ranking de simulados e consumo de conteúdo
 */
export const useRankings = () => {
  const [rankings, setRankings] = useState<RankingData>({});

  const fetchRankings = async (user: User): Promise<RankingData> => {
    if (!user?.id) return {};

    try {
      // Ranking de simulado
      const { data: simData } = await supabase.rpc('get_user_rankings', { p_simulado_id: null });
      const simuladoRank = (simData as Record<string, { rank?: number; total?: number }>)?.rankingIES?.rank || 0;
      const simuladoTotal = (simData as Record<string, { rank?: number; total?: number }>)?.rankingIES?.total || 0;

      // Dados da IES e semestre
      let iesId = user.id_ies || null;
      let semestreVal: number | null = user.semestre ?? null;

      try {
        const [{ data: iesRpc }, { data: semRpc }] = await Promise.all([
          supabase.rpc('get_current_user_ies_id'),
          supabase.rpc('get_current_user_semester'),
        ]);
        if (iesRpc) iesId = iesRpc as string;
        if (semRpc !== null && semRpc !== undefined) semestreVal = semRpc as number;
      } catch {}

      if (!iesId || semestreVal === null) {
        const next = { simuladoRank, simuladoTotal };
        setRankings(next);
        return next;
      }

      // Tentar ranking via RPC otimizado
      try {
        const { data: ranking } = await supabase.rpc('get_cohort_consumo_ranking');
        if (ranking && (ranking as Array<{ supabase_user_id: string; rank_videos: number; rank_questoes: number; total: number }>).length) {
          const typedRanking = ranking as Array<{ supabase_user_id: string; rank_videos: number; rank_questoes: number; total: number }>;
          const total = typedRanking[0]?.total ?? typedRanking.length;
          const myRow = typedRanking.find((r) => r.supabase_user_id === user.id);
          const rv = Number(myRow?.rank_videos ?? total);
          const rq = Number(myRow?.rank_questoes ?? total);
          const best = Math.min(rv, rq);
          const next = { simuladoRank, simuladoTotal, conteudoRank: best, conteudoTotal: total };
          setRankings(next);
          return next;
        }
      } catch {}

      // Fallback: calcular ranking manualmente
      const rankingResult = await calculateManualRanking(user.id, iesId, semestreVal);
      const next = { simuladoRank, simuladoTotal, ...rankingResult };
      setRankings(next);
      return next;
    } catch (error) {
      console.error('Error fetching rankings:', error);
      return {};
    }
  };

  const calculateManualRanking = async (userId: string, iesId: string, semestre: number) => {
    const { data: usersRes } = await supabase
      .from('users')
      .select('id')
      .eq('id_ies', iesId)
      .eq('semestre', semestre);

    const userIds = (usersRes || []).map((u) => u.id);

    const { data: mapRes } = await supabase
      .from('supabase_to_metabase')
      .select('id, user_id_metabase')
      .in('id', userIds);

    const idToMetabase = new Map<string, string>();
    (mapRes || []).forEach((m) => idToMetabase.set(m.id, m.user_id_metabase));
    const metabaseIds = Array.from(idToMetabase.values());

    let consumoRes: Array<{ id: string; videos_assistidos: number; questoes_respondidas: number | null }> = [];
    if (metabaseIds.length > 0) {
      const { data: consumo } = await supabase
        .from('consumo_metabase')
        .select('id, videos_assistidos, questoes_respondidas')
        .in('id', metabaseIds);
      consumoRes = consumo || [];
    }

    const consumoByMetabaseId = new Map(consumoRes.map((c) => [c.id, c]));
    const total = userIds.length;

    const sortBy = (key: 'videos_assistidos' | 'questoes_respondidas') => {
      return userIds
        .map((uid) => {
          const mid = idToMetabase.get(uid);
          const c = mid ? consumoByMetabaseId.get(mid) : null;
          const val = Number(c?.[key] ?? 0);
          return { uid, val };
        })
        .sort((a, b) => b.val - a.val);
    };

    const videosBoard = sortBy('videos_assistidos');
    const questsBoard = sortBy('questoes_respondidas');

    const myVideos = videosBoard.find((s) => s.uid === userId)?.val ?? 0;
    const myQuests = questsBoard.find((s) => s.uid === userId)?.val ?? 0;
    const videosIdx = videosBoard.findIndex((s) => s.uid === userId);
    const questsIdx = questsBoard.findIndex((s) => s.uid === userId);

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

    return { conteudoRank: Math.min(videosPos, questsPos), conteudoTotal: total };
  };

  return { rankings, fetchRankings };
};
