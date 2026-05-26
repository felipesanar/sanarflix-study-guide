import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Logger } from '@/utils/logger';
import { calendarService, type CalendarSubject } from '@/services/calendarService';

export type { CalendarSubject };

interface StoredData {
  subjects: CalendarSubject[];
  lastUpdated: number;
  version: string;
}

const STORAGE_KEY = 'user_calendar_subjects';
const SYNC_VERSION = '2.0';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// Leitura síncrona do cache ANTES do useState (similar ao readCacheSync da Home)
const readCacheSync = (): CalendarSubject[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const data: StoredData = JSON.parse(stored);

    // Migration check: descarta cache de versão antiga para evitar
    // estruturas incompatíveis após mudanças de schema.
    if (data.version !== SYNC_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    // Verificar se o cache é recente
    if (data.subjects && data.lastUpdated && (Date.now() - data.lastUpdated) < CACHE_TTL) {
      return data.subjects;
    }
    return [];
  } catch {
    // JSON corrompido: limpa para evitar loop de erro nas próximas leituras.
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    return [];
  }
};

export const useCalendarSync = () => {
  const { user } = useAuth();
  
  // Leitura síncrona do cache ANTES do useState (evita loading desnecessário)
  const cachedSubjects = useMemo(() => readCacheSync(), []);
  
  // Inicializar estado COM dados do cache (evita skeleton em revisitas)
  const [subjects, setSubjects] = useState<CalendarSubject[]>(cachedSubjects);
  const [loading, setLoading] = useState(cachedSubjects.length === 0);
  const [syncing, setSyncing] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Chave de inicialização por user.id: garante re-inicialização quando o
  // usuário muda (ex: impersonation admin). Antes era boolean global,
  // travando o estado do primeiro usuário carregado.
  const initializedRef = useRef<string | null>(null);

  // Carregar do Local Storage (instantâneo) - apenas como fallback
  const loadFromLocalStorage = useCallback((): CalendarSubject[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const data: StoredData = JSON.parse(stored);
      return data.subjects || [];
    } catch (error) {
      Logger.error('Erro ao carregar do localStorage:', error);
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
      Logger.error('Erro ao salvar no localStorage:', error);
    }
  }, []);

  // Carregar do banco de dados — delega para calendarService.
  const loadFromDatabase = useCallback(async (): Promise<CalendarSubject[]> => {
    if (!user?.id) return [];
    return calendarService.listSubjects(user.id);
  }, [user]);

  // Salvar no banco — delega para calendarService.
  const saveToDatabase = useCallback(async (newSubjects: CalendarSubject[]) => {
    if (!user?.id) return;
    await calendarService.replaceSubjects(user.id, newSubjects);
  }, [user]);

  // Inicialização: SERVER-FIRST com cache instantâneo
  useEffect(() => {
    const initKey = user?.id ?? '__anonymous__';
    // Evitar múltiplas inicializações para o mesmo usuário, mas permitir
    // re-inicialização quando user.id muda (impersonation/logout/login).
    if (initializedRef.current === initKey) return;
    initializedRef.current = initKey;
    
    const initialize = async () => {
      if (user?.id) {
        // Se já tem cache válido, não mostrar loading (atualiza em background)
        if (cachedSubjects.length > 0) {
          // Background refresh sem loading
          const serverSubjects = await loadFromDatabase();
          setSubjects(serverSubjects);
          saveToLocalStorage(serverSubjects);
        } else {
          // Sem cache: loading normal
          setLoading(true);
          const serverSubjects = await loadFromDatabase();
          setSubjects(serverSubjects);
          saveToLocalStorage(serverSubjects);
          setLoading(false);
        }
      } else {
        // Usuário não autenticado: usar localStorage como fallback
        if (cachedSubjects.length === 0) {
          const localSubjects = loadFromLocalStorage();
          setSubjects(localSubjects);
        }
        setLoading(false);
      }
    };

    initialize();
  }, [user, cachedSubjects, loadFromDatabase, loadFromLocalStorage, saveToLocalStorage]);

  // Realtime subscription para sincronização multi-aba — via service.
  useEffect(() => {
    if (!user?.id) return;

    // Limpar subscription anterior se existir
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    unsubscribeRef.current = calendarService.subscribeToChanges(user.id, async () => {
      const serverSubjects = await loadFromDatabase();
      setSubjects(serverSubjects);
      saveToLocalStorage(serverSubjects);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.id, loadFromDatabase, saveToLocalStorage]);

  // Salvar matérias (com UPSERT atômico)
  const saveSubjects = useCallback(async (newSubjects: CalendarSubject[]) => {
    try {
      // 1. Atualizar estado e localStorage instantaneamente (otimista)
      setSubjects(newSubjects);
      saveToLocalStorage(newSubjects);

      // 2. Salvar no banco (delete + upsert atômico vivem no service)
      if (user?.id) {
        setSyncing(true);
        await saveToDatabase(newSubjects);
        setSyncing(false);
      }
    } catch (error) {
      Logger.error('Erro ao salvar matérias:', error);
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

  // Adicionar matéria com deduplicação.
  // Usa subjectsRef para ler estado atual síncronamente, evitando stale
  // closure quando dois cliques rápidos viam o mesmo `subjects` antigo
  // e ambos passavam pelo check de dedupe (gerando duplicatas).
  // A defesa em profundidade real é a UNIQUE constraint server-side
  // (migration §4 do runbook).
  const subjectsRef = useRef(subjects);
  subjectsRef.current = subjects;

  const addSubject = useCallback(async (subject: CalendarSubject) => {
    const current = subjectsRef.current;
    const exists = current.some(
      s => s.name === subject.name && s.dayOfWeek === subject.dayOfWeek
    );

    if (exists) {
      toast.info('Esta matéria já está agendada para este dia');
      return;
    }

    const newSubjects = [...current, subject];
    await saveSubjects(newSubjects);
  }, [saveSubjects]);

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
