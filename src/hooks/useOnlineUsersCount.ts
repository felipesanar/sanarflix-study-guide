import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ACTIVITY_WINDOW_MINUTES = 15;
const REFRESH_INTERVAL_MS = 30000; // 30 segundos

export const useOnlineUsersCount = () => {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadCount = useCallback(async () => {
    try {
      // Janela de atividade: últimos 15 minutos
      const activityThreshold = new Date(
        Date.now() - ACTIVITY_WINDOW_MINUTES * 60 * 1000
      ).toISOString();
      
      const { count: sessionsCount, error } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .is('ended_at', null) // Sessão não finalizada
        .gte('started_at', activityThreshold); // Atividade recente
      
      if (error) {
        console.error('Error fetching sessions count:', error);
        return;
      }
      
      setCount(sessionsCount || 0);
    } catch (err) {
      console.error('Error in loadCount:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
    
    // Refresh periódico para precisão
    const interval = setInterval(loadCount, REFRESH_INTERVAL_MS);
    
    // Real-time para atualizações imediatas
    const channel = supabase
      .channel('online-users-count')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'user_sessions' },
        () => loadCount() // Recarrega em qualquer mudança
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadCount]);

  return { count, isConnected, isLoading };
};
