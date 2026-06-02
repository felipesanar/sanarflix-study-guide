import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';
import { normalizeGrandeArea } from '@/utils/grandeArea';

export type ErrorReason = 'did_not_know' | 'did_not_remember' | 'did_not_understand_statement' | 'answered_without_confidence';

export interface ErrorNotebookEntry {
  id: string;
  user_id: string;
  question_id: string | null;
  simulado_id: string | null;
  simulado_nome: string | null;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  reason: ErrorReason;
  learning_text: string | null;
  was_correct: boolean;
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface QuestionDetails {
  id: string;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string | null;
  correta: string;
  comentario: string | null;
  imagem: string | null;
}

export interface AddEntryParams {
  question_id?: string | null;
  simulado_id?: string | null;
  simulado_nome?: string | null;
  grande_area?: string | null;
  especialidade?: string | null;
  tema?: string | null;
  reason: ErrorReason;
  learning_text?: string | null;
  was_correct: boolean;
  source?: 'simulation_correction' | 'manual';
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
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters?.grande_area) query = query.eq('grande_area', normalizeGrandeArea(filters.grande_area));
      if (filters?.tema) query = query.eq('tema', filters.tema);
      if (filters?.reason) query = query.eq('reason', filters.reason);
      if (filters?.simulado_id) query = query.eq('simulado_id', filters.simulado_id);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let result = (data || []) as ErrorNotebookEntry[];

      if (filters?.search && filters.search.trim()) {
        const searchLower = filters.search.toLowerCase().trim();
        result = result.filter(e =>
          e.learning_text?.toLowerCase().includes(searchLower)
        );
      }

      setEntries(result);
    } catch (err: any) {
      Logger.error('[ErrorNotebook] Fetch error:', err);
      setError('Erro ao carregar caderno de erros');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchQuestionDetails = useCallback(async (questionId: string): Promise<QuestionDetails | null> => {
    if (!user?.id || !questionId) return null;

    try {
      Logger.info('[ErrorNotebookUI] Fetching question details for:', questionId);
      const { data, error: fetchError } = await supabase
        .from('questoes_simulado')
        .select('id, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, comentario, imagem')
        .eq('id', questionId)
        .single();

      if (fetchError) {
        Logger.error('[ErrorNotebookUI] Question fetch error:', fetchError);
        return null;
      }

      return data as QuestionDetails;
    } catch (err) {
      Logger.error('[ErrorNotebookUI] Question fetch exception:', err);
      return null;
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
          question_id: params.question_id || null,
          simulado_id: params.simulado_id || null,
          simulado_nome: params.simulado_nome || null,
          grande_area: params.grande_area || null,
          especialidade: params.especialidade || null,
          tema: params.tema || null,
          reason: params.reason,
          learning_text: learningText,
          was_correct: params.was_correct,
          source: params.source || 'simulation_correction',
        });

      if (insertError) throw insertError;

      trackEvent({
        eventName: 'ce_error_added',
        category: 'interaction',
        data: {
          simulado_id: params.simulado_id,
          question_id: params.question_id,
          reason: params.reason,
          has_learning_text: !!learningText,
          source: params.source || 'simulation_correction',
        },
      });

      return true;
    } catch (err: any) {
      Logger.error('[ErrorNotebook] Add error:', err);
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
      const updateData: Database['public']['Tables']['error_notebook_entries']['Update'] = {};
      if (updates.reason) updateData.reason = updates.reason;
      if (learningText !== undefined) updateData.learning_text = learningText;

      const { error: updateError } = await supabase
        .from('error_notebook_entries')
        .update(updateData)
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      trackEvent({ eventName: 'ce_entry_edited', category: 'interaction', data: { entry_id: entryId } });

      setEntries(prev => prev.map(e =>
        e.id === entryId ? { ...e, ...updates, learning_text: learningText !== undefined ? learningText : e.learning_text, updated_at: new Date().toISOString() } : e
      ));

      return true;
    } catch (err: any) {
      Logger.error('[ErrorNotebook] Update error:', err);
      setError('Erro ao atualizar registro');
      return false;
    }
  }, [user?.id, trackEvent]);

  const deleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: deleteError } = await supabase
        .from('error_notebook_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      trackEvent({ eventName: 'ce_entry_deleted', category: 'interaction', data: { entry_id: entryId } });

      setEntries(prev => prev.filter(e => e.id !== entryId));
      return true;
    } catch (err: any) {
      Logger.error('[ErrorNotebook] Delete error:', err);
      setError('Erro ao excluir registro');
      return false;
    }
  }, [user?.id, trackEvent]);

  const restoreEntry = useCallback(async (entryId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: restoreError } = await supabase
        .from('error_notebook_entries')
        .update({ deleted_at: null })
        .eq('id', entryId)
        .eq('user_id', user.id);

      if (restoreError) throw restoreError;

      trackEvent({ eventName: 'ce_entry_restored', category: 'interaction', data: { entry_id: entryId } });
      return true;
    } catch (err: any) {
      Logger.error('[ErrorNotebook] Restore error:', err);
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
        .is('deleted_at', null)
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
    fetchQuestionDetails,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    checkIfAdded,
    clearError: () => setError(null),
  };
};
