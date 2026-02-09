import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { presenceService } from '@/services/presenceService';

export const usePresenceTracker = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Track user in the shared presence channel
    presenceService.track(user.id, {
      email: user.email,
      name: user.nome || user.email?.split('@')[0],
      online_at: new Date().toISOString(),
    });

    return () => {
      presenceService.untrack();
    };
  }, [user?.id, user?.email, user?.nome]);
};
