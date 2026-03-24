import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { presenceService } from '@/services/presenceService';
import { supabase } from '@/integrations/supabase/client';

export const usePresenceTracker = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(null);
      return;
    }

    const checkAdminRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
    };

    checkAdminRole();
  }, [user?.id]);

  // Track presence only for non-admin users
  useEffect(() => {
    // Wait until we know if user is admin
    if (!user?.id || isAdmin === null) return;
    
    // Don't track admin users
    if (isAdmin) return;

    presenceService.track(user.id, {
      email: user.email,
      name: user.nome || user.email?.split('@')[0],
      online_at: new Date().toISOString(),
    });

    return () => {
      presenceService.untrack();
    };
  }, [user?.id, user?.email, user?.nome, isAdmin]);
};
