import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe leve ao user_feedback do usuário atual — quando a equipe responde
 * (admin_response passa de null → not null), dispara um toast com CTA.
 * Fica montado uma única vez, dentro do FeedbackProvider.
 */
export function useFeedbackResponseToast() {
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user_feedback_toast_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_feedback',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const oldResp = payload?.old?.admin_response ?? null;
          const newResp = payload?.new?.admin_response ?? null;
          if (!oldResp && newResp) {
            toast.success('A equipe respondeu seu feedback ✨', {
              description: 'Toque para ver a resposta.',
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => navigate('/meus-feedbacks'),
              },
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);
}
