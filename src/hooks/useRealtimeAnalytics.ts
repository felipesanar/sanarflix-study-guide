import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface AtividadeRecente {
  id: string;
  tipo: 'resposta' | 'aula' | 'simulado' | 'progresso';
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
  atividadesRecentes: AtividadeRecente[];
  respostasPorMinuto: { minuto: string; count: number }[];
  isConnected: boolean;
}

const MAX_ATIVIDADES = 50;
const DEBOUNCE_MS = 1000;

export const useRealtimeAnalytics = () => {
  const [stats, setStats] = useState<RealtimeStats>({
    respostasUltimaHora: 0,
    aulasAssistidasHoje: 0,
    simuladosConcluidosHoje: 0,
    atividadesRecentes: [],
    respostasPorMinuto: [],
    isConnected: false,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Partial<RealtimeStats>>({});

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

  // Load initial counts
  const loadInitialCounts = useCallback(async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString();

    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    try {
      // Parallel queries for initial data
      const [respostasResult, aulasResult, simuladosResult] = await Promise.all([
        // Respostas na última hora - count estimate
        supabase
          .from('answer_progress')
          .select('answer_id', { count: 'exact', head: true }),
        
        // Aulas hoje
        supabase
          .from('aula_views')
          .select('id', { count: 'exact', head: true })
          .gte('viewed_at', hojeISO),
        
        // Simulados concluídos hoje
        supabase
          .from('simulados_finalizados')
          .select('id', { count: 'exact', head: true })
          .gte('finalizado_em', hojeISO),
      ]);

      setStats((prev) => ({
        ...prev,
        respostasUltimaHora: Math.min(respostasResult.count || 0, 999),
        aulasAssistidasHoje: aulasResult.count || 0,
        simuladosConcluidosHoje: simuladosResult.count || 0,
      }));
    } catch (error) {
      console.error('Error loading initial counts:', error);
    }
  }, []);

  // Setup realtime subscriptions
  useEffect(() => {
    loadInitialCounts();

    const channel = supabase
      .channel('realtime-analytics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answer_progress' },
        (payload) => {
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
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'aula_views' },
        (payload) => {
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
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'simulados_finalizados' },
        (payload) => {
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
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'study_progress' },
        (payload) => {
          console.log('[Realtime] Progresso de estudo:', payload);
          addAtividade({
            id: crypto.randomUUID(),
            tipo: 'progresso',
            descricao: 'Conteúdo marcado como concluído',
            timestamp: new Date(),
            userId: payload.new.user_id,
          });
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
  }, [loadInitialCounts, updateRespostasPorMinuto, addAtividade]);

  return stats;
};
