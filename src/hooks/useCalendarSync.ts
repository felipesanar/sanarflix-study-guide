import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CalendarSubject {
  id?: string;
  name: string;
  color: string;
  dayOfWeek: number;
}

interface StoredData {
  subjects: CalendarSubject[];
  lastUpdated: number;
  version: string;
}

const STORAGE_KEY = 'user_calendar_subjects';
const SYNC_VERSION = '2.0';

export const useCalendarSync = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<CalendarSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Carregar do Local Storage (instantâneo) - apenas como fallback
  const loadFromLocalStorage = useCallback((): CalendarSubject[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const data: StoredData = JSON.parse(stored);
      return data.subjects || [];
    } catch (error) {
      console.error('Erro ao carregar do localStorage:', error);
      return [];
    }
  }, []);

  // Salvar no Local Storage (cache local)
  const saveToLocalStorage = useCallback((subjects: CalendarSubject[]) => {
    try {
      const data: StoredData = {
        subjects,
        lastUpdated: Date.now(),
        version: SYNC_VERSION
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  }, []);

  // Carregar do banco de dados (fonte de verdade)
  const loadFromDatabase = useCallback(async (): Promise<CalendarSubject[]> => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true });

      if (error) throw error;

      return data?.map(row => ({
        id: row.id,
        name: row.name,
        color: row.color,
        dayOfWeek: row.day_of_week
      })) || [];
    } catch (error) {
      console.error('Erro ao carregar do banco:', error);
      return [];
    }
  }, [user]);

  // Salvar no banco usando UPSERT + DELETE para itens removidos
  const saveToDatabase = useCallback(async (newSubjects: CalendarSubject[], currentServerIds: string[]) => {
    if (!user?.id) return;

    try {
      // 1. UPSERT: inserir/atualizar matérias
      if (newSubjects.length > 0) {
        const { error: upsertError } = await supabase
          .from('calendar_subjects')
          .upsert(
            newSubjects.map(subject => ({
              id: subject.id, // Mantém ID existente se houver
              user_id: user.id,
              name: subject.name,
              color: subject.color,
              day_of_week: subject.dayOfWeek
            })),
            { 
              onConflict: 'user_id,name,day_of_week',
              ignoreDuplicates: false 
            }
          );

        if (upsertError) throw upsertError;
      }

      // 2. DELETE: remover matérias que não estão mais na lista
      const newSubjectKeys = new Set(
        newSubjects.map(s => `${s.name}|${s.dayOfWeek}`)
      );
      
      const idsToRemove = currentServerIds.filter((id, index) => {
        // Precisamos verificar quais IDs do servidor não estão na nova lista
        // Isso é feito comparando com os subjects originais
        return false; // Placeholder - será resolvido na lógica de saveSubjects
      });

      // Deletar matérias removidas pelo usuário (matérias que estavam no servidor mas não estão mais)
      const { data: currentData } = await supabase
        .from('calendar_subjects')
        .select('id, name, day_of_week')
        .eq('user_id', user.id);

      if (currentData) {
        const idsToDelete = currentData
          .filter(row => !newSubjectKeys.has(`${row.name}|${row.day_of_week}`))
          .map(row => row.id);

        if (idsToDelete.length > 0) {
          await supabase
            .from('calendar_subjects')
            .delete()
            .in('id', idsToDelete);
        }
      }

    } catch (error) {
      console.error('Erro ao salvar no banco:', error);
      throw error;
    }
  }, [user]);

  // Inicialização: SERVER-FIRST - buscar dados do servidor como fonte de verdade
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      
      if (user?.id) {
        // SERVER-FIRST: Buscar do banco como fonte de verdade
        const serverSubjects = await loadFromDatabase();
        setSubjects(serverSubjects);
        saveToLocalStorage(serverSubjects);
      } else {
        // Fallback: usuário não autenticado, usar localStorage
        const localSubjects = loadFromLocalStorage();
        setSubjects(localSubjects);
      }
      
      setLoading(false);
    };

    initialize();
  }, [user, loadFromDatabase, loadFromLocalStorage, saveToLocalStorage]);

  // Realtime subscription para sincronização multi-aba
  useEffect(() => {
    if (!user?.id) return;

    // Limpar channel anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`calendar-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_subjects',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          // Recarregar dados do servidor quando houver mudanças
          const serverSubjects = await loadFromDatabase();
          setSubjects(serverSubjects);
          saveToLocalStorage(serverSubjects);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, loadFromDatabase, saveToLocalStorage]);

  // Salvar matérias (com UPSERT atômico)
  const saveSubjects = useCallback(async (newSubjects: CalendarSubject[]) => {
    try {
      // 1. Atualizar estado e localStorage instantaneamente (otimista)
      setSubjects(newSubjects);
      saveToLocalStorage(newSubjects);

      // 2. Salvar no banco
      if (user?.id) {
        setSyncing(true);
        
        // Buscar IDs atuais do servidor para comparação
        const { data: currentData } = await supabase
          .from('calendar_subjects')
          .select('id, name, day_of_week')
          .eq('user_id', user.id);

        const currentServerIds = currentData?.map(row => row.id) || [];
        
        await saveToDatabase(newSubjects, currentServerIds);
        
        setSyncing(false);
        toast.success('Matérias salvas com sucesso!');
      } else {
        toast.success('Matérias salvas localmente');
      }
    } catch (error) {
      console.error('Erro ao salvar matérias:', error);
      setSyncing(false);
      toast.error('Erro ao sincronizar com o servidor');
      
      // Reverter para dados do servidor em caso de erro
      if (user?.id) {
        const serverSubjects = await loadFromDatabase();
        setSubjects(serverSubjects);
        saveToLocalStorage(serverSubjects);
      }
    }
  }, [user, saveToLocalStorage, saveToDatabase, loadFromDatabase]);

  // Adicionar matéria com deduplicação
  const addSubject = useCallback(async (subject: CalendarSubject) => {
    // Verificar se já existe no dia (deduplicação no cliente)
    const exists = subjects.some(
      s => s.name === subject.name && s.dayOfWeek === subject.dayOfWeek
    );
    
    if (exists) {
      toast.info('Esta matéria já está agendada para este dia');
      return;
    }
    
    const newSubjects = [...subjects, subject];
    await saveSubjects(newSubjects);
  }, [subjects, saveSubjects]);

  // Remover matéria
  const removeSubject = useCallback(async (dayOfWeek: number, subjectName: string) => {
    const newSubjects = subjects.filter(
      s => !(s.dayOfWeek === dayOfWeek && s.name === subjectName)
    );
    await saveSubjects(newSubjects);
  }, [subjects, saveSubjects]);

  // Limpar todas as matérias
  const clearAllSubjects = useCallback(async () => {
    await saveSubjects([]);
    toast.success('Calendário limpo com sucesso!');
  }, [saveSubjects]);

  // Forçar refresh dos dados do servidor
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    const serverSubjects = await loadFromDatabase();
    setSubjects(serverSubjects);
    saveToLocalStorage(serverSubjects);
    setLoading(false);
  }, [user, loadFromDatabase, saveToLocalStorage]);

  return {
    subjects,
    loading,
    syncing,
    saveSubjects,
    addSubject,
    removeSubject,
    clearAllSubjects,
    refresh
  };
};
