import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StatsRefresherProps {
  onRefresh: () => void;
}

export const StatsRefresher = ({ onRefresh }: StatsRefresherProps) => {
  useEffect(() => {
    // Escutar mudanças em tempo real nas tabelas relevantes
    const channel = supabase
      .channel('home-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_progress'
        },
        () => {
          console.log('Study progress updated, refreshing home...');
          onRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answer_progress_enamed'
        },
        () => {
          console.log('Answer progress updated, refreshing home...');
          onRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_subjects'
        },
        () => {
          console.log('Calendar subjects updated, refreshing home...');
          onRefresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  return null;
};
