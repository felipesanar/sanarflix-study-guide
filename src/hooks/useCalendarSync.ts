import { useState, useEffect, useCallback } from 'react';
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
const SYNC_VERSION = '1.0';

export const useCalendarSync = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<CalendarSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Carregar do Local Storage (instantâneo)
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

  // Salvar no Local Storage (instantâneo)
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

  // Salvar no banco de dados (background)
  const saveToDatabase = useCallback(async (subjects: CalendarSubject[]) => {
    if (!user?.id) return;

    try {
      // Deletar todos os registros existentes do usuário
      await supabase
        .from('calendar_subjects')
        .delete()
        .eq('user_id', user.id);

      // Inserir novos registros
      if (subjects.length > 0) {
        const { error } = await supabase
          .from('calendar_subjects')
          .insert(
            subjects.map(subject => ({
              user_id: user.id,
              name: subject.name,
              color: subject.color,
              day_of_week: subject.dayOfWeek
            }))
          );

        if (error) throw error;
      }

      
    } catch (error) {
      console.error('Erro ao salvar no banco:', error);
      throw error;
    }
  }, [user]);

  // Carregar do banco de dados
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

  // Sincronizar: merge entre local e banco
  const syncWithDatabase = useCallback(async (localSubjects: CalendarSubject[]) => {
    if (!user?.id) return;

    try {
      setSyncing(true);
      const serverSubjects = await loadFromDatabase();

      // Se o servidor tem dados e o local não, usar dados do servidor
      if (serverSubjects.length > 0 && localSubjects.length === 0) {
        setSubjects(serverSubjects);
        saveToLocalStorage(serverSubjects);
        return;
      }

      // Se o local tem dados e o servidor não, enviar para o servidor
      if (localSubjects.length > 0 && serverSubjects.length === 0) {
        await saveToDatabase(localSubjects);
        return;
      }

      // Se ambos têm dados, priorizar dados locais (mais recentes)
      if (localSubjects.length > 0) {
        await saveToDatabase(localSubjects);
      }
    } catch (error) {
      console.error('Erro na sincronização:', error);
    } finally {
      setSyncing(false);
    }
  }, [user, loadFromDatabase, saveToLocalStorage, saveToDatabase]);

  // Inicialização: carregar e sincronizar
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      
      // 1. Carregar instantaneamente do cache local
      const localSubjects = loadFromLocalStorage();
      setSubjects(localSubjects);
      setLoading(false);

      // 2. Sincronizar com banco em background (se autenticado)
      if (user?.id) {
        setTimeout(() => {
          syncWithDatabase(localSubjects);
        }, 500);
      }
    };

    initialize();
  }, [user, loadFromLocalStorage, syncWithDatabase]);

  // Salvar matérias (híbrido: local + banco)
  const saveSubjects = useCallback(async (newSubjects: CalendarSubject[]) => {
    try {
      // 1. Atualizar estado e salvar no localStorage instantaneamente
      setSubjects(newSubjects);
      saveToLocalStorage(newSubjects);

      // 2. Tentar salvar no banco em background
      if (user?.id) {
        setSyncing(true);
        await saveToDatabase(newSubjects);
        setSyncing(false);
        toast.success('Matérias salvas com sucesso!');
      } else {
        toast.success('Matérias salvas localmente');
      }
    } catch (error) {
      console.error('Erro ao salvar matérias:', error);
      toast.error('Erro ao sincronizar com o servidor');
      // Mantém os dados salvos localmente mesmo se o banco falhar
    }
  }, [user, saveToLocalStorage, saveToDatabase]);

  // Adicionar matéria
  const addSubject = useCallback(async (subject: CalendarSubject) => {
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

  return {
    subjects,
    loading,
    syncing,
    saveSubjects,
    addSubject,
    removeSubject,
    clearAllSubjects
  };
};
