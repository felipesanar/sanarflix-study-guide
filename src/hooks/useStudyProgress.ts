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
}

export const useStudyProgress = (): UseStudyProgressResult => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);

  const getProgressKey = (contentType: string, contentId: string, materiaId: string) => {
    return `${contentType}-${contentId}-${materiaId}`;
  };

  const loadProgress = async (materiaId: string, semestre: number, iesNome: string) => {
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
      });

      setProgress(progressMap);
      } catch (error) {
        // Error loading study progress
      toast({
        title: "Erro",
        description: "Não foi possível carregar o progresso dos estudos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleContentCompletion = async (
    contentType: 'aula' | 'subtema' | 'tema',
    contentId: string,
    materiaId: string,
    semestre: number,
    iesNome: string
  ) => {
    if (!user?.id || !user?.email) return;

    const key = getProgressKey(contentType, contentId, materiaId);
    const currentStatus = progress.get(key) || false;
    const newStatus = !currentStatus;

    // Atualização otimista
    const newProgress = new Map(progress);
    newProgress.set(key, newStatus);
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
        // Reverter atualização otimista em caso de erro
        setProgress(progress);
        throw error;
      }

      toast({
        title: newStatus ? "Conteúdo marcado como concluído" : "Conteúdo marcado como pendente",
        description: `O conteúdo foi ${newStatus ? 'concluído' : 'marcado como pendente'} com sucesso`,
      });
      } catch (error) {
        // Error updating study progress
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o progresso",
        variant: "destructive",
      });
    }
  };

  return {
    progress,
    loading,
    toggleContentCompletion,
    loadProgress,
  };
};