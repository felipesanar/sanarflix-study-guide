import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

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

export const useStudyProgress = (materiaId?: string, semestre?: number) => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Record<string, StudyProgressItem>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load progress for current materia/semester
  useEffect(() => {
    const loadProgress = async () => {
      if (!user?.id || !materiaId || !semestre) {
        setProgress({});
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('study_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('materia_id', materiaId)
          .eq('semestre', semestre);

        if (error) {
          console.error('Error loading study progress:', error);
          return;
        }

        const progressMap = (data || []).reduce((acc, item) => {
          const key = `${item.content_type}-${item.content_id}`;
          acc[key] = {
            ...item,
            content_type: item.content_type as 'aula' | 'subtema' | 'tema'
          };
          return acc;
        }, {} as Record<string, StudyProgressItem>);

        setProgress(progressMap);
      } catch (error) {
        console.error('Error loading study progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [user?.id, materiaId, semestre]);

  const isCompleted = (contentType: 'aula' | 'subtema' | 'tema', contentId: string): boolean => {
    const key = `${contentType}-${contentId}`;
    return progress[key]?.completed || false;
  };

  const toggleCompletion = async (
    contentType: 'aula' | 'subtema' | 'tema',
    contentId: string,
    materiaId: string
  ): Promise<boolean> => {
    if (!user?.id || !user?.email || !semestre) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return false;
    }

    const key = `${contentType}-${contentId}`;
    const currentItem = progress[key];
    const newCompleted = !currentItem?.completed;

    try {
      // Optimistic update
      setProgress(prev => ({
        ...prev,
        [key]: {
          ...currentItem,
          id: currentItem?.id || '',
          user_id: user.id,
          user_email: user.email,
          content_type: contentType,
          content_id: contentId,
          materia_id: materiaId,
          semestre: semestre,
          ies_nome: user.ies_nome || '',
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : undefined,
          created_at: currentItem?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }));

      if (currentItem) {
        // Update existing record
        const { error } = await supabase
          .from('study_progress')
          .update({
            completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentItem.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('study_progress')
          .insert({
            user_id: user.id,
            user_email: user.email,
            content_type: contentType,
            content_id: contentId,
            materia_id: materiaId,
            semestre: semestre,
            ies_nome: user.ies_nome || '',
            completed: newCompleted,
            completed_at: newCompleted ? new Date().toISOString() : null,
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error toggling completion:', error);
      
      // Revert optimistic update
      setProgress(prev => ({
        ...prev,
        [key]: currentItem || { ...prev[key], completed: !newCompleted }
      }));

      toast({
        title: "Erro",
        description: "Não foi possível atualizar o progresso",
        variant: "destructive",
      });
      
      return false;
    }
  };

  return {
    progress,
    isLoading,
    isCompleted,
    toggleCompletion,
  };
};