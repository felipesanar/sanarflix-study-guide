import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RealtimeFilters {
  iesId: string | null;
  simuladoId: string | null;
}
import { RealtimeChannel } from '@supabase/supabase-js';

export interface AtividadeRecente {
  id: string;
  tipo: 'resposta' | 'aula' | 'simulado' | 'progresso' | 'sanarclass' | 'session';
  descricao: string;
  timestamp: Date;
  userId?: string;
}

export interface SimuladoAtivo {
  id: string;
  nome: string;
  alunosAtivos: number;
}

export interface RealtimeStats {
  respostasUltimaHora: number;
  aulasAssistidasHoje: number;
  simuladosConcluidosHoje: number;
  simuladosIniciadosHoje: number;
  sanarclassViewsHoje: number;
  sessaoesAtivasHoje: number;
  atividadesRecentes: AtividadeRecente[];
  respostasPorMinuto: { minuto: string; count: number }[];
  isConnected: boolean;
}

const MAX_ATIVIDADES = 50;
const DEBOUNCE_MS = 1000;

export const useRealtimeAnalytics = (filters?: RealtimeFilters) => {
  const [stats, setStats] = useState<RealtimeStats>({
    respostasUltimaHora: 0,
    aulasAssistidasHoje: 0,
    simuladosConcluidosHoje: 0,
    simuladosIniciadosHoje: 0,
    sanarclassViewsHoje: 0,
    sessaoesAtivasHoje: 0,
    atividadesRecentes: [],
    respostasPorMinuto: [],
    isConnected: false,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<RealtimeStats>>({});

  // Memoize filters to prevent unnecessary re-renders
  const iesId = filters?.iesId ?? null;
  const simuladoId = filters?.simuladoId ?? null;

  // Debounced state update to prevent excessive re-renders
  const applyPendingUpdates = useCallback(() => {
    setStats((prev) => ({
      ...prev,
      ...pendingUpdatesRef.current,
    }));
    pendingUpdatesRef.current = {};
  }, []);

  const scheduleUpdate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(applyPendingUpdates, DEBOUNCE_MS);
  }, [applyPendingUpdates]);

  // Add activity to the feed
  const addAtividade = useCallback((atividade: AtividadeRecente) => {
    setStats((prev) => ({
      ...prev,
      atividadesRecentes: [atividade, ...prev.atividadesRecentes].slice(0, MAX_ATIVIDADES),
    }));
  }, []);

  // Update respostas por minuto chart data
  const updateRespostasPorMinuto = useCallback(() => {
    setStats((prev) => {
      const agora = new Date();
      const minutoAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      const updated = [...prev.respostasPorMinuto];
      const existingIdx = updated.findIndex(r => r.minuto === minutoAtual);
      
      if (existingIdx >= 0) {
        updated[existingIdx] = { ...updated[existingIdx], count: updated[existingIdx].count + 1 };
      } else {
        updated.push({ minuto: minutoAtual, count: 1 });
      }
      
      // Keep only last 60 minutes
      const cutoff = updated.slice(-60);
      
      return {
        ...prev,
        respostasPorMinuto: cutoff,
        respostasUltimaHora: prev.respostasUltimaHora + 1,
      };
    });
  }, []);

  // Load initial counts with filters
  const loadInitialCounts = useCallback(async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString();

    try {
      // Build queries with filters
      let respostasQuery = supabase.from('answer_progress').select('answer_id', { count: 'exact', head: true });
      let aulasQuery = supabase.from('aula_views').select('id', { count: 'exact', head: true }).gte('viewed_at', hojeISO);
      let simuladosQuery = supabase.from('simulados_finalizados').select('id', { count: 'exact', head: true }).gte('finalizado_em', hojeISO);
      const simuladosIniciadosQuery = supabase.from('simulados_iniciados').select('id', { count: 'exact', head: true }).gte('started_at', hojeISO);
      const sanarclassQuery = supabase.from('sanarclass_views').select('id', { count: 'exact', head: true }).gte('created_at', hojeISO);
      const sessoesQuery = supabase.from('user_sessions').select('id', { count: 'exact', head: true }).gte('started_at', hojeISO);

      // Apply simulado filter if set
      if (simuladoId) {
        respostasQuery = respostasQuery.eq('simulado', simuladoId);
        simuladosQuery = simuladosQuery.eq('simulado_id', simuladoId);
      }

      const [respostasResult, aulasResult, simuladosResult, iniciadosResult, sanarResult, sessoesResult] = await Promise.all([
        respostasQuery,
        aulasQuery,
        simuladosQuery,
        simuladosIniciadosQuery,
        sanarclassQuery,
        sessoesQuery,
      ]);

      setStats((prev) => ({
        ...prev,
        respostasUltimaHora: Math.min(respostasResult.count || 0, 999),
        aulasAssistidasHoje: aulasResult.count || 0,
        simuladosConcluidosHoje: simuladosResult.count || 0,
        simuladosIniciadosHoje: iniciadosResult.count || 0,
        sanarclassViewsHoje: sanarResult.count || 0,
        sessaoesAtivasHoje: sessoesResult.count || 0,
        atividadesRecentes: [],
        respostasPorMinuto: [],
      }));
    } catch (error) {
      console.error('Error loading initial counts:', error);
    }
  }, [iesId, simuladoId]);

  // Check if event matches current filters
  const matchesFilters = useCallback(async (payload: any, table: string): Promise<boolean> => {
    if (!iesId && !simuladoId) return true;

    // For answer_progress and simulados_finalizados, check simulado filter
    if (table === 'answer_progress' || table === 'simulados_finalizados') {
      const eventSimuladoId = table === 'answer_progress' ? payload.new.simulado : payload.new.simulado_id;
      
      if (simuladoId && eventSimuladoId !== simuladoId) {
        return false;
      }

      // If IES filter is set, need to check if simulado belongs to that IES
      if (iesId && eventSimuladoId) {
        const { data: simulado } = await supabase
          .from('simulados_admin')
          .select('ies_ids')
          .eq('id', eventSimuladoId)
          .single();
        
        if (!simulado || !simulado.ies_ids?.includes(iesId)) {
          return false;
        }
      }
    }

    // For aula_views and study_progress, check IES via user
    if (iesId && (table === 'aula_views' || table === 'study_progress')) {
      const userId = payload.new.user_id;
      if (userId) {
        const { data: user } = await supabase
          .from('users')
          .select('id_ies')
          .eq('id', userId)
          .single();
        
        if (!user || user.id_ies !== iesId) {
          return false;
        }
      }
    }

    return true;
  }, [iesId, simuladoId]);

  // Setup realtime subscriptions
  useEffect(() => {
    loadInitialCounts();

    const channel = supabase
      .channel('realtime-analytics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answer_progress' },
        async (payload) => {
          if (await matchesFilters(payload, 'answer_progress')) {
            console.log('[Realtime] Nova resposta:', payload);
            updateRespostasPorMinuto();
            addAtividade({
              id: crypto.randomUUID(),
              tipo: 'resposta',
              descricao: 'Nova resposta registrada',
              timestamp: new Date(),
              userId: payload.new.user_id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'aula_views' },
        async (payload) => {
          if (await matchesFilters(payload, 'aula_views')) {
            console.log('[Realtime] Nova visualização de aula:', payload);
            setStats((prev) => ({
              ...prev,
              aulasAssistidasHoje: prev.aulasAssistidasHoje + 1,
            }));
            addAtividade({
              id: crypto.randomUUID(),
              tipo: 'aula',
              descricao: 'Aula visualizada',
              timestamp: new Date(),
              userId: payload.new.user_id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'simulados_finalizados' },
        async (payload) => {
          if (await matchesFilters(payload, 'simulados_finalizados')) {
            console.log('[Realtime] Simulado finalizado:', payload);
            setStats((prev) => ({
              ...prev,
              simuladosConcluidosHoje: prev.simuladosConcluidosHoje + 1,
            }));
            addAtividade({
              id: crypto.randomUUID(),
              tipo: 'simulado',
              descricao: 'Simulado concluído',
              timestamp: new Date(),
              userId: payload.new.user_id,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'study_progress' },
        async (payload) => {
          if (await matchesFilters(payload, 'study_progress')) {
            console.log('[Realtime] Progresso de estudo:', payload);
            addAtividade({
              id: crypto.randomUUID(),
              tipo: 'progresso',
              descricao: 'Conteúdo marcado como concluído',
              timestamp: new Date(),
              userId: payload.new.user_id,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da conexão:', status);
        setStats((prev) => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED',
        }));
      });

    channelRef.current = channel;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadInitialCounts, updateRespostasPorMinuto, addAtividade, matchesFilters]);

  return stats;
};
