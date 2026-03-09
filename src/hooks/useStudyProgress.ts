import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface StudyProgressItem {
  id: string;
  user_id: string;
  user_email: string;
  content_type: 'aula' | 'subtema' | 'tema';
  content_id: string;
  materia_id: string;
  semestre: number;
  ies_nome: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UseStudyProgressResult {
  progress: Map<string, boolean>;
  loading: boolean;
  toggleContentCompletion: (
    contentType: 'aula' | 'subtema' | 'tema',
    contentId: string,
    materiaId: string,
    semestre: number,
    iesNome: string
  ) => Promise<void>;
  loadProgress: (materiaId: string, semestre: number, iesNome: string) => Promise<void>;
  loadAllProgress: (semestre: number, iesNome: string) => Promise<void>;
  isCompleted: (contentId: string) => boolean;
}

const LOCALSTORAGE_KEY = 'study-progress';
const MIGRATION_FLAG_KEY = 'study-progress-migrated';

export const useStudyProgress = (): UseStudyProgressResult => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const hasMigrated = useRef(false);

  // Migrate localStorage to Supabase on first load
  useEffect(() => {
    const migrateLocalStorageToSupabase = async () => {
      if (!user?.id || !user?.email || hasMigrated.current) return;
      
      // Check if already migrated
      const migrationFlag = localStorage.getItem(MIGRATION_FLAG_KEY);
      if (migrationFlag === 'true') {
        hasMigrated.current = true;
        return;
      }

      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (!stored) {
        hasMigrated.current = true;
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        return;
      }
      
      try {
        const items = JSON.parse(stored);
        if (Array.isArray(items) && items.length > 0) {
          console.log(`[StudyProgress] Migrating ${items.length} items from localStorage to Supabase`);
          
          // Parse IDs and create records
          const records = items.map((id: string) => {
            const parts = id.split('-');
            // Format: semestre-materia-tema-subtema-aula
            const semestre = parseInt(parts[0]) || user.semestre || 1;
            const materia = parts[1] || 'unknown';
            
            return {
              user_id: user.id,
              user_email: user.email,
              content_type: 'aula' as const,
              content_id: id,
              materia_id: materia,
              semestre: semestre,
              ies_nome: user.ies_nome || '',
              completed: true,
              completed_at: new Date().toISOString(),
            };
          });
          
          // Batch insert
          const { error } = await supabase
            .from('study_progress')
            .upsert(records, {
              onConflict: 'user_id,content_type,content_id,materia_id',
            });
          
          if (error) {
            console.error('[StudyProgress] Migration error:', error);
          } else {
            console.log('[StudyProgress] Migration successful');
            localStorage.removeItem(LOCALSTORAGE_KEY);
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          }
        }
      } catch (e) {
        console.error('[StudyProgress] Migration failed:', e);
      }
      
      hasMigrated.current = true;
    };
    
    migrateLocalStorageToSupabase();
  }, [user?.id, user?.email, user?.semestre, user?.ies_nome]);

  const getProgressKey = (contentType: string, contentId: string, materiaId: string) => {
    return `${contentType}-${contentId}-${materiaId}`;
  };

  const loadProgress = useCallback(async (materiaId: string, semestre: number, iesNome: string) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('materia_id', materiaId)
        .eq('semestre', semestre)
        .eq('ies_nome', iesNome);

      if (error) {
        throw error;
      }

      const progressMap = new Map<string, boolean>();
      data?.forEach((item: any) => {
        const key = getProgressKey(item.content_type, item.content_id, item.materia_id);
        progressMap.set(key, item.completed);
        // Also store by content_id only for simpler lookups
        progressMap.set(item.content_id, item.completed);
      });

      setProgress(progressMap);
    } catch (error) {
      console.error('[StudyProgress] Error loading progress:', error);
      toast.error('Não foi possível carregar o progresso dos estudos');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load ALL progress for a semester (not filtered by materia)
  const loadAllProgress = useCallback(async (semestre: number, iesNome: string) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('study_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('semestre', semestre);

      if (error) {
        throw error;
      }

      const progressMap = new Map<string, boolean>();
      data?.forEach((item: any) => {
        // Store by full key
        const key = getProgressKey(item.content_type, item.content_id, item.materia_id);
        progressMap.set(key, item.completed);
        // Also store by content_id only for simpler lookups
        progressMap.set(item.content_id, item.completed);
      });

      setProgress(progressMap);
      console.log(`[StudyProgress] Loaded ${data?.length || 0} progress items for semester ${semestre}`);
    } catch (error) {
      console.error('[StudyProgress] Error loading all progress:', error);
      toast.error('Não foi possível carregar o progresso dos estudos');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const toggleContentCompletion = useCallback(async (
    contentType: 'aula' | 'subtema' | 'tema',
    contentId: string,
    materiaId: string,
    semestre: number,
    iesNome: string
  ) => {
    if (!user?.id || !user?.email) return;

    const key = getProgressKey(contentType, contentId, materiaId);
    const currentStatus = progress.get(contentId) || progress.get(key) || false;
    const newStatus = !currentStatus;

    // Optimistic update
    const newProgress = new Map(progress);
    newProgress.set(key, newStatus);
    newProgress.set(contentId, newStatus);
    setProgress(newProgress);

    try {
      const { error } = await supabase
        .from('study_progress')
        .upsert({
          user_id: user.id,
          user_email: user.email,
          content_type: contentType,
          content_id: contentId,
          materia_id: materiaId,
          semestre: semestre,
          ies_nome: iesNome,
          completed: newStatus,
          completed_at: newStatus ? new Date().toISOString() : null,
        }, {
          onConflict: 'user_id,content_type,content_id,materia_id',
        });

      if (error) {
        // Rollback optimistic update on error
        setProgress(progress);
        throw error;
      }

      // Show success toast with CTA (only when completing)
      if (newStatus) {
        toast.success('Aula concluída! 🎉', {
          description: 'Seu progresso foi atualizado',
          action: {
            label: 'Ver impacto',
            onClick: () => {
              window.location.href = '/dashboard';
            }
          },
          duration: 5000,
        });
      } else {
        toast.info('Conteúdo marcado como pendente');
      }
    } catch (error) {
      console.error('[StudyProgress] Error updating progress:', error);
      toast.error('Não foi possível atualizar o progresso');
    }
  }, [user?.id, user?.email, progress]);

  const isCompleted = useCallback((contentId: string) => {
    return progress.get(contentId) || false;
  }, [progress]);

  return {
    progress,
    loading,
    toggleContentCompletion,
    loadProgress,
    loadAllProgress,
    isCompleted,
  };
};
