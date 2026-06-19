import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';

export interface UserNote {
  id: string;
  title: string;
  body_md: string;
  question_id: string | null;
  simulado_id: string | null;
  grande_area: string | null;
  tema: string | null;
  created_at: string;
  updated_at: string;
}

const NOTE_COLS = 'id, title, body_md, question_id, simulado_id, grande_area, tema, created_at, updated_at';

export function useNotes() {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select(NOTE_COLS)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setNotes((data ?? []) as UserNote[]);
    } catch (err) {
      Logger.error('[Notes] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (): Promise<UserNote | null> => {
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('user_notes')
      .insert({ user_id: user.id, title: '', body_md: '' })
      .select(NOTE_COLS)
      .single();
    if (error) { Logger.error('[Notes] create error:', error); return null; }
    trackEvent({ eventName: 'ce_note_created', category: 'interaction' });
    const note = data as UserNote;
    setNotes((prev) => [note, ...prev]);
    return note;
  }, [user?.id, trackEvent]);

  const update = useCallback(async (id: string, patch: { title?: string; body_md?: string }) => {
    if (!user?.id) return;
    // otimista
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    const { error } = await supabase.from('user_notes').update(patch).eq('id', id).eq('user_id', user.id);
    if (error) { Logger.error('[Notes] update error:', error); return; }
    trackEvent({ eventName: 'ce_note_updated', category: 'interaction', data: { note_id: id } });
  }, [user?.id, trackEvent]);

  const remove = useCallback(async (id: string) => {
    if (!user?.id) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase
      .from('user_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) Logger.error('[Notes] remove error:', error);
  }, [user?.id]);

  return { notes, loading, create, update, remove, refresh };
}
