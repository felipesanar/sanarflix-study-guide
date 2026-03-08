import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';

export type ErrorReason = 'did_not_know' | 'did_not_remember' | 'did_not_understand_statement' | 'answered_without_confidence';

export interface ErrorNotebookEntry {
  id: string;
  user_id: string;
  question_id: string;
  simulado_id: string;
  simulado_nome: string;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  reason: ErrorReason;
  learning_text: string | null;
  was_correct: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AddEntryParams {
  question_id: string;
  simulado_id: string;
  simulado_nome: string;
  grande_area?: string | null;
  especialidade?: string | null;
  tema?: string | null;
  reason: ErrorReason;
  learning_text?: string | null;
  was_correct: boolean;
}

export interface ErrorNotebookFilters {
  grande_area?: string;
  tema?: string;
  reason?: ErrorReason;
  simulado_id?: string;
  search?: string;
}

export const REASON_LABELS: Record<ErrorReason, string> = {
  did_not_know: 'Não sabia',
  did_not_remember: 'Não lembrei',
  did_not_understand_statement: 'Não entendi o enunciado',
  answered_without_confidence: 'Acertei sem certeza',
};

export const useErrorNotebook = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [entries, setEntries] = useState<ErrorNotebookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (filters?: ErrorNotebookFilters) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('error_notebook_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filters?.grande_area) query = query.eq('grande_area', filters.grande_area);
      if (filters?.tema) query = query.eq('tema', filters.tema);
      if (filters?.reason) query = query.eq('reason', filters.reason);
      if (filters?.simulado_id) query = query.eq('simulado_id', filters.simulado_id);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let result = (data || []) as ErrorNotebookEntry[];

      // Client-side search on learning_text
      if (filters?.search && filters.search.trim()) {
        const searchLower = filters.search.toLowerCase().trim();
        result = result.filter(e =>
          e.learning_text?.toLowerCase().includes(searchLower)
        );
      }

      setEntries(result);
    } catch (err: any) {
      console.error('[ErrorNotebook] Fetch error:', err);
      setError('Erro ao carregar caderno de erros');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const addEntry = useCallback(async (params: AddEntryParams): Promise<boolean> => {
    if (!user?.id) return false;

    const learningText = params.learning_text?.trim() || null;
    if (learningText && learningText.length > 280) {
      setError('Aprendizado deve ter no máximo 280 caracteres');
      return false;
    }

    try {
      const { error: insertError } = await supabase
        .from('error_notebook_entries')
        .insert({
          user_id: user.id,
          question_id: params.question_id,
          simulado_id: params.simulado_id,
          simulado_nome: params.simulado_nome,
          grande_area: params.grande_area || null,
          especialidade: params.especialidade || null,
          tema: params.tema || null,
          reason: params.reason,
          learning_text: learningText,
          was_correct: params.was_correct,
          source: 'simulation_correction',
        });

      if (insertError) throw insertError;

      console.log('[ErrorNotebook] Entry added:', params.question_id);
      trackEvent({
        eventName: 'ce_error_added',
        category: 'interaction',
        data: {
          simulado_id: params.simulado_id,
          question_id: params.question_id,
          reason: params.reason,
          has_learning_text: !!learningText,
        },
      });

      return true;
    } catch (err: any) {
      console.error('[ErrorNotebook] Add error:', err);
      setError('Erro ao salvar no caderno de erros');
      return false;
    }
  }, [user?.id, trackEvent]);

  const updateEntry = useCallback(async (
    entryId: string,
    updates: { reason?: ErrorReason; learning_text?: string | null }
  ): Promise<boolean> => {
    if (!user?.id) return false;

    const learningText = updates.learning_text !== undefined
      ? (updates.learning_text?.trim() || null)
      : undefined;

    if (learningText && learningText.length > 280) {
      setError('Aprendizado deve ter no máximo 280 caracteres');
      return false;
    }

    try {
      const updateData: Record<string, any> = {};
      if (updates.reason) updateData.reason = updates.reason;
      if (learningText !== undefined) updateData.learning_text = learningText;

      const { error: updateError } = await supabase
        .from('error_notebook_entries')
        .update(updateData)
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      console.log('[ErrorNotebook] Entry updated:', entryId);
      trackEvent({ eventName: 'ce_entry_edited', category: 'interaction', data: { entry_id: entryId } });

      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, ...updateData, updated_at: new Date().toISOString() } : e
      ));

      return true;
    } catch (err: any) {
      console.error('[ErrorNotebook] Update error:', err);
      setError('Erro ao atualizar registro');
      return false;
    }
  }, [user?.id, trackEvent]);

  const deleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: deleteError } = await supabase
        .from('error_notebook_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      console.log('[ErrorNotebook] Entry deleted:', entryId);
      trackEvent({ eventName: 'ce_entry_deleted', category: 'interaction', data: { entry_id: entryId } });

      setEntries(prev => prev.filter(e => e.id !== entryId));
      return true;
    } catch (err: any) {
      console.error('[ErrorNotebook] Delete error:', err);
      setError('Erro ao excluir registro');
      return false;
    }
  }, [user?.id, trackEvent]);

  const checkIfAdded = useCallback(async (questionId: string, simuladoId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error: checkError } = await supabase
        .from('error_notebook_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('question_id', questionId)
        .eq('simulado_id', simuladoId)
        .limit(1);

      if (checkError) throw checkError;
      return (data?.length || 0) > 0;
    } catch {
      return false;
    }
  }, [user?.id]);

  return {
    entries,
    loading,
    error,
    fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    checkIfAdded,
    clearError: () => setError(null),
  };
};
