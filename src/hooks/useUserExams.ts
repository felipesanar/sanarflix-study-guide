import { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { UserExam, ExamInsight, MateriaProgress } from '@/types/progressHub';
import { Logger } from '@/utils/logger';

const STORAGE_KEY = 'progress_hub_exam_date'; // Legacy key for migration

export function useUserExams() {
  // Always call useContext (unconditional hook call)
  const authContext = useContext(AuthContext);
  
  // Safely extract user - will be null if context is null
  const user = authContext?.user ?? null;
  const hasContext = authContext !== null;
  
  const [exams, setExams] = useState<UserExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    hasContext ? null : 'Auth context not available'
  );
  const migratedRef = useRef(false);

  // Fetch exams from database
  const fetchExams = useCallback(async () => {
    // Guard: no context or no user
    if (!hasContext || !user?.id) {
      setExams([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const todayStr = new Date().toISOString().split('T')[0];
      
      const { data, error: fetchError } = await supabase
        .from('user_exams')
        .select('*')
        .eq('user_id', user.id)
        .gte('exam_date', todayStr)
        .order('exam_date', { ascending: true });

      if (fetchError) {
        Logger.error('useUserExams: Fetch error:', fetchError);
        setError('Erro ao carregar provas');
        return;
      }

      setExams(data || []);
    } catch (err) {
      Logger.error('useUserExams: Unexpected error:', err);
      setError('Erro inesperado');
    } finally {
      setLoading(false);
    }
  }, [user?.id, hasContext]);

  // Migrate legacy localStorage data to database
  const migrateFromLocalStorage = useCallback(async () => {
    if (migratedRef.current || !user?.id) return;
    migratedRef.current = true;

    try {
      const oldDate = localStorage.getItem(STORAGE_KEY);
      if (!oldDate) return;

      Logger.info('useUserExams: Migrating legacy exam date from localStorage');
      
      // Create a generic exam for the old date
      const { error: insertError } = await supabase
        .from('user_exams')
        .insert({
          user_id: user.id,
          materia: 'Geral',
          exam_name: 'Prova',
          exam_date: oldDate
        });

      if (!insertError) {
        localStorage.removeItem(STORAGE_KEY);
        Logger.info('useUserExams: Migration complete');
        await fetchExams();
      }
    } catch (err) {
      Logger.error('useUserExams: Migration error:', err);
    }
  }, [user?.id, fetchExams]);

  // Initial fetch and migration
  useEffect(() => {
    if (user?.id) {
      fetchExams().then(() => {
        migrateFromLocalStorage();
      });
    }
  }, [user?.id, fetchExams, migrateFromLocalStorage]);

  // Add new exam
  const addExam = useCallback(async (materia: string, examName: string, examDate: string) => {
    if (!user?.id) return { data: null, error: 'User not authenticated' };

    try {
      const { data, error: insertError } = await supabase
        .from('user_exams')
        .insert({
          user_id: user.id,
          materia,
          exam_name: examName || 'Prova',
          exam_date: examDate
        })
        .select()
        .single();

      if (insertError) {
        Logger.error('useUserExams: Insert error:', insertError);
        
        if (insertError.code === '23505') {
          toast.error('Já existe uma prova desta matéria nesta data');
        } else {
          toast.error('Erro ao adicionar prova');
        }
        
        return { data: null, error: insertError.message };
      }

      // Optimistically update local state
      setExams(prev => [...prev, data as UserExam].sort((a, b) => 
        new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
      ));
      
      toast.success('Prova adicionada!');
      return { data, error: null };
    } catch (err) {
      Logger.error('useUserExams: Unexpected insert error:', err);
      toast.error('Erro ao adicionar prova');
      return { data: null, error: 'Unexpected error' };
    }
  }, [user?.id]);

  // Remove exam
  const removeExam = useCallback(async (examId: string) => {
    if (!user?.id) return { error: 'User not authenticated' };

    try {
      const { error: deleteError } = await supabase
        .from('user_exams')
        .delete()
        .eq('id', examId)
        .eq('user_id', user.id);

      if (deleteError) {
        Logger.error('useUserExams: Delete error:', deleteError);
        toast.error('Erro ao remover prova');
        return { error: deleteError.message };
      }

      setExams(prev => prev.filter(e => e.id !== examId));
      toast.success('Prova removida');
      return { error: null };
    } catch (err) {
      Logger.error('useUserExams: Unexpected delete error:', err);
      toast.error('Erro ao remover prova');
      return { error: 'Unexpected error' };
    }
  }, [user?.id]);

  // Update exam
  const updateExam = useCallback(async (examId: string, updates: Partial<Omit<UserExam, 'id' | 'user_id' | 'created_at'>>) => {
    if (!user?.id) return { error: 'User not authenticated' };

    try {
      const { error: updateError } = await supabase
        .from('user_exams')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', examId)
        .eq('user_id', user.id);

      if (updateError) {
        Logger.error('useUserExams: Update error:', updateError);
        toast.error('Erro ao atualizar prova');
        return { error: updateError.message };
      }

      setExams(prev => prev.map(e => 
        e.id === examId ? { ...e, ...updates } : e
      ).sort((a, b) => 
        new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
      ));
      
      toast.success('Prova atualizada');
      return { error: null };
    } catch (err) {
      Logger.error('useUserExams: Unexpected update error:', err);
      toast.error('Erro ao atualizar prova');
      return { error: 'Unexpected error' };
    }
  }, [user?.id]);

  return {
    exams,
    loading,
    error,
    addExam,
    removeExam,
    updateExam,
    refresh: fetchExams
  };
}

// Calculate insights for a single exam
export function calculateExamInsight(
  exam: UserExam, 
  materiaProgress: MateriaProgress | null
): ExamInsight {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Parse exam date correctly to avoid timezone issues
  const [year, month, day] = exam.exam_date.split('-').map(Number);
  const examDate = new Date(year, month - 1, day);
  examDate.setHours(0, 0, 0, 0);
  
  const daysRemaining = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // No progress data for this subject
  if (!materiaProgress) {
    return {
      exam,
      materia_progress: null,
      days_remaining: daysRemaining,
      lessons_remaining: 0,
      lessons_per_day: 0,
      quizzes_completed: 0,
      status: daysRemaining <= 7 ? 'critical' : 'warning',
      message: 'Você ainda não começou esta matéria',
      cta_label: 'Começar a estudar',
      cta_action: 'study'
    };
  }

  const lessonsRemaining = materiaProgress.total - materiaProgress.completed;
  const lessonsPerDay = daysRemaining > 0 ? lessonsRemaining / daysRemaining : lessonsRemaining;
  const percentage = materiaProgress.percentage;

  let status: ExamInsight['status'];
  let message: string;
  let ctaLabel: string;
  let ctaAction: ExamInsight['cta_action'];

  if (percentage >= 90) {
    status = 'excellent';
    message = '🎯 Quase lá! Foque na revisão final';
    ctaLabel = 'Revisar';
    ctaAction = 'review';
  } else if (percentage >= 70 || (daysRemaining > 14 && lessonsPerDay <= 2)) {
    status = 'on_track';
    message = '✅ Bom ritmo! Continue assim';
    ctaLabel = 'Continuar';
    ctaAction = 'study';
  } else if (daysRemaining <= 7 && percentage < 50) {
    status = 'critical';
    message = `⚠️ Atenção! ${Math.ceil(lessonsPerDay)} aulas/dia necessárias`;
    ctaLabel = 'Acelerar';
    ctaAction = 'study';
  } else {
    status = 'warning';
    message = `📊 Mantenha o foco. ${lessonsRemaining} aulas restantes`;
    ctaLabel = 'Estudar';
    ctaAction = 'study';
  }

  return {
    exam,
    materia_progress: materiaProgress,
    days_remaining: daysRemaining,
    lessons_remaining: lessonsRemaining,
    lessons_per_day: lessonsPerDay,
    quizzes_completed: 0,
    status,
    message,
    cta_label: ctaLabel,
    cta_action: ctaAction
  };
}
