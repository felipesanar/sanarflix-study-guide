import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ProgressHubData } from '@/types/progressHub';
import Logger from '@/utils/logger';

const CACHE_KEY = 'progress_hub_data';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface CachedData {
  data: ProgressHubData;
  timestamp: number;
}

// Sync cache read (avoid skeleton on revisit)
const readCacheSync = (): ProgressHubData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedData = JSON.parse(cached);
    if (Date.now() - parsed.timestamp < CACHE_TTL) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
};

export function useProgressHub() {
  const { user, isImpersonating, impersonatedUser } = useAuth();
  
  // Initialize with cached data if available
  const cachedData = useMemo(() => readCacheSync(), []);
  
  const [data, setData] = useState<ProgressHubData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [streakGoal, setStreakGoal] = useState<number>(cachedData?.streak.goal || 3);
  const fetchedRef = useRef(false);

  const saveToCache = useCallback((data: ProgressHubData) => {
    try {
      const cached: CachedData = { data, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch (e) {
      console.warn('Failed to cache progress hub data:', e);
    }
  }, []);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!user?.id) return;

    try {
      // Verificar sessão antes de chamar a edge function
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        return;
      }

      if (showLoading && !cachedData) {
        setLoading(true);
      } else {
        setSyncing(true);
      }
      setError(null);

      // When impersonating, use admin-user-support to fetch the student's data
      let response: any;
      let fetchError: any;

      if (isImpersonating && impersonatedUser?.id) {
        Logger.debug('useProgressHub: fetching via impersonation', { userId: impersonatedUser.id });
        const result = await supabase.functions.invoke('admin-user-support', {
          body: { userId: impersonatedUser.id, section: 'progress_hub' },
        });
        response = result.data;
        fetchError = result.error;
      } else {
        const result = await supabase.functions.invoke('get-progress-hub');
        response = result.data;
        fetchError = result.error;
      }

      if (fetchError) {
        console.error('Progress hub fetch error:', fetchError);
        setError('Não foi possível carregar os dados');
        return;
      }

      if (response?.error) {
        console.error('Progress hub response error:', response.error);
        setError(response.error);
        return;
      }

      // Apply local streak goal override and ensure compatibility
      const responseWithGoal = {
        ...response,
        streak: {
          ...response.streak,
          goal: streakGoal,
          // Fallback for compatibility if API doesn't return active_days_of_week
          active_days_of_week: response.streak.active_days_of_week ?? []
        }
      };

      setData(responseWithGoal);
      saveToCache(responseWithGoal);
    } catch (err) {
      console.error('Progress hub unexpected error:', err);
      setError('Erro inesperado ao carregar dados');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user?.id, cachedData, saveToCache, streakGoal]);

  // Initial fetch
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    if (user?.id) {
      // If we have cached data, do a background refresh
      if (cachedData) {
        fetchData(false);
      } else {
        fetchData(true);
      }
    }
  }, [user?.id, cachedData, fetchData]);

  // Complete a theme (batch complete all lessons)
  const completeTheme = useCallback(async (materia: string, tema: string, subtema?: string) => {
    if (!user?.id) return { success: false };

    try {
      setSyncing(true);

      const { data: result, error } = await supabase.rpc('complete_theme', {
        p_materia: materia,
        p_tema: tema,
        p_subtema: subtema || null
      });

      if (error) {
        console.error('Complete theme error:', error);
        toast.error('Erro ao marcar tema como concluído');
        return { success: false };
      }

      // Parse result safely
      const resultObj = result as { success?: boolean; aulas_completed?: number; node_id?: string } | null;
      const aulasCompleted = resultObj?.aulas_completed || 0;

      // Optimistic update
      if (data) {
        const updatedData = { ...data };
        const temaIndex = updatedData.by_tema.findIndex(
          t => t.materia === materia && t.tema === tema
        );
        if (temaIndex >= 0) {
          const temaData = updatedData.by_tema[temaIndex];
          updatedData.by_tema[temaIndex] = {
            ...temaData,
            completed: temaData.total,
            percentage: 100
          };
        }
        
        // Update materia
        const materiaIndex = updatedData.by_materia.findIndex(m => m.materia === materia);
        if (materiaIndex >= 0) {
          const materiaData = updatedData.by_materia[materiaIndex];
          updatedData.by_materia[materiaIndex] = {
            ...materiaData,
            completed: materiaData.completed + aulasCompleted,
            percentage: Math.round(((materiaData.completed + aulasCompleted) / materiaData.total) * 100)
          };
        }
        
        // Update overview
        updatedData.overview = {
          ...updatedData.overview,
          completed: updatedData.overview.completed + aulasCompleted,
          percentage: Math.round(((updatedData.overview.completed + aulasCompleted) / updatedData.overview.total) * 100)
        };
        
        setData(updatedData);
        saveToCache(updatedData);
      }

      toast.success(`${tema} concluído! 🎉`, {
        description: `${aulasCompleted} aulas marcadas`,
        action: {
          label: 'Desfazer',
          onClick: () => uncompleteTheme(materia, tema, subtema)
        }
      });

      // Background refresh for accurate data
      setTimeout(() => fetchData(false), 1000);

      return { success: true, aulas_completed: aulasCompleted };
    } catch (err) {
      console.error('Complete theme unexpected error:', err);
      toast.error('Erro ao marcar tema');
      return { success: false };
    } finally {
      setSyncing(false);
    }
  }, [user?.id, data, saveToCache, fetchData]);

  // Uncomplete a theme
  const uncompleteTheme = useCallback(async (materia: string, tema: string, subtema?: string) => {
    if (!user?.id) return { success: false };

    try {
      setSyncing(true);

      const { error } = await supabase.rpc('uncomplete_theme', {
        p_materia: materia,
        p_tema: tema,
        p_subtema: subtema || null
      });

      if (error) {
        console.error('Uncomplete theme error:', error);
        toast.error('Erro ao desfazer conclusão');
        return { success: false };
      }

      toast.success('Conclusão desfeita');

      // Refresh data
      await fetchData(false);

      return { success: true };
    } catch (err) {
      console.error('Uncomplete theme unexpected error:', err);
      toast.error('Erro ao desfazer');
      return { success: false };
    } finally {
      setSyncing(false);
    }
  }, [user?.id, fetchData]);

  // Refresh data
  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Update streak goal (local state + cache)
  const updateStreakGoal = useCallback((goal: number) => {
    setStreakGoal(goal);
    
    // Update data with new goal
    if (data) {
      const updatedData = {
        ...data,
        streak: {
          ...data.streak,
          goal
        }
      };
      setData(updatedData);
      saveToCache(updatedData);
    }
    
    // TODO: Persist to backend when user preferences table is ready
  }, [data, saveToCache]);

  // Clear cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    data,
    loading,
    error,
    syncing,
    refresh,
    completeTheme,
    uncompleteTheme,
    updateStreakGoal,
    clearCache
  };
}
