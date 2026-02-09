import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBrazilDate } from '@/utils/timezone';

export const useOnlineUsersCount = () => {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const hoje = getBrazilDate();
        hoje.setHours(0, 0, 0, 0);
        
        const { count: sessionsCount, error } = await supabase
          .from('user_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('started_at', hoje.toISOString());
        
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
    };
    
    loadCount();
    
    // Listen to new sessions in real-time
    const channel = supabase
      .channel('online-users-count')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'user_sessions' },
        () => setCount(prev => prev + 1)
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { count, isConnected, isLoading };
};
