/**
 * Camada de serviço para o calendário pessoal do usuário.
 *
 * Componentes/hooks NÃO devem chamar supabase diretamente — vão por aqui.
 * Facilita testes (mockar este módulo), refatoração de schema e troca
 * futura de backend.
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

export interface CalendarSubject {
  id?: string;
  name: string;
  color: string;
  dayOfWeek: number; // 0 = Domingo (BRT)
}

interface CalendarSubjectRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  day_of_week: number;
}

function rowToSubject(row: CalendarSubjectRow): CalendarSubject {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    dayOfWeek: row.day_of_week,
  };
}

export const calendarService = {
  /**
   * Lista as matérias do calendário do usuário, ordenadas por dia da semana.
   */
  async listSubjects(userId: string): Promise<CalendarSubject[]> {
    const { data, error } = await supabase
      .from('calendar_subjects')
      .select('*')
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true });

    if (error) {
      Logger.error('[calendarService.listSubjects] db error', error);
      return [];
    }
    return (data ?? []).map(rowToSubject as (row: unknown) => CalendarSubject);
  },

  /**
   * Substitui o calendário do usuário pelo conjunto fornecido.
   * Faz UPSERT atômico + DELETE de itens removidos. Idempotente em
   * relação à composição: chamar duas vezes com a mesma lista é no-op.
   */
  async replaceSubjects(userId: string, subjects: CalendarSubject[]): Promise<void> {
    if (subjects.length > 0) {
      const rows = subjects.map((s) => ({
        id: s.id || crypto.randomUUID(),
        user_id: userId,
        name: s.name,
        color: s.color,
        day_of_week: s.dayOfWeek,
      }));

      const { error } = await supabase
        .from('calendar_subjects')
        .upsert(rows, {
          onConflict: 'user_id,name,day_of_week',
          ignoreDuplicates: false,
        });

      if (error) {
        Logger.error('[calendarService.replaceSubjects] upsert error', error);
        throw error;
      }
    }

    // Remove matérias que não estão mais na lista nova
    const keys = new Set(subjects.map((s) => `${s.name}|${s.dayOfWeek}`));

    const { data: current } = await supabase
      .from('calendar_subjects')
      .select('id, name, day_of_week')
      .eq('user_id', userId);

    if (current) {
      const toDelete = current
        .filter((r) => !keys.has(`${r.name}|${r.day_of_week}`))
        .map((r) => r.id);

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('calendar_subjects')
          .delete()
          .in('id', toDelete);
        if (error) {
          Logger.error('[calendarService.replaceSubjects] delete error', error);
          throw error;
        }
      }
    }
  },

  /**
   * Realtime subscription para mudanças no calendário do usuário.
   * Retorna função de cleanup para remover o canal.
   */
  subscribeToChanges(userId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`calendar-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_subjects',
          filter: `user_id=eq.${userId}`,
        },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
