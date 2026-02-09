import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PRESENCE_CHANNEL } from './usePresenceTracker';

export const useOnlineUsersCount = () => {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: 'analytics-observer',
        },
      },
    });

    const updateCount = () => {
      const state = channel.presenceState();
      // Count unique users (each key in presence state is a user)
      const uniqueUsers = Object.keys(state).length;
      setCount(uniqueUsers);
      setIsLoading(false);
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        updateCount();
      })
      .on('presence', { event: 'join' }, () => {
        updateCount();
      })
      .on('presence', { event: 'leave' }, () => {
        updateCount();
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          updateCount();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { count, isConnected, isLoading };
};
