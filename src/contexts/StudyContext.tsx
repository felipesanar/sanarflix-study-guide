import React, { createContext, useContext, useState, useEffect } from 'react';
import { StudyContextType, StudyContent, Progress } from '@/types';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const StudyContext = createContext<StudyContextType | null>(null);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [studyContents, setStudyContents] = useState<StudyContent[]>([]);
  const [progress, setProgress] = useState<Progress>({
    userId: '',
    completedItems: [],
    totalItems: 0,
    progressByDiscipline: {}
  });

  useEffect(() => {
    if (user && user.id_ies && user.semestre) {
      loadStudyContents();
    }
  }, [user]);

  const loadStudyContents = async () => {
    if (!user || !user.id_ies || !user.semestre) return;

    try {
      // Bypass TS typing on Supabase RPC since generated types are empty
      const { data: conteudosData, error } = await (supabase as any)
        .rpc('get_conteudos_for_user', {
          user_id_ies: user.id_ies,
          user_semestre: user.semestre
        });

      if (error) {
        console.error('Error loading study contents:', error);
        setStudyContents([]);
        return;
      }

      if (!conteudosData || conteudosData.length === 0) {
        console.log('No content found for this IES and semester');
        setStudyContents([]);
        return;
      }

      // Process JSONB content
      const processedContents = processConteudosJsonb(conteudosData[0]?.conteudos);
      setStudyContents(processedContents);

      // Load progress from database
      await loadUserProgress(processedContents, user.id);
    } catch (error) {
      console.error('Error loading study contents:', error);
      setStudyContents([]);
    }
  };

  const loadUserProgress = async (contents: StudyContent[], userId: string) => {
    try {
      const { data: progressData, error } = await supabase
        .from('user_progress')
        .select('content_id')
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading user progress:', error);
        // Fallback to localStorage if database fails
        const savedProgress = localStorage.getItem('study-progress');
        if (savedProgress) {
          const parsedProgress = JSON.parse(savedProgress);
          if (parsedProgress.userId === userId) {
            setProgress(parsedProgress);
            updateContentCompletionStatus(contents, parsedProgress.completedItems);
            return;
          }
        }
        initializeProgress(contents, userId);
        return;
      }

      const completedItems = progressData?.map(item => item.content_id) || [];
      const disciplineProgress = calculateDisciplineProgress(contents, completedItems);
      
      const progress: Progress = {
        userId,
        completedItems,
        totalItems: contents.length,
        progressByDiscipline: disciplineProgress
      };

      setProgress(progress);
      updateContentCompletionStatus(contents, completedItems);
      
      // Sync with localStorage for offline access
      localStorage.setItem('study-progress', JSON.stringify(progress));
    } catch (error) {
      console.error('Error loading user progress:', error);
      initializeProgress(contents, userId);
    }
  };

  const updateContentCompletionStatus = (contents: StudyContent[], completedItems: string[]) => {
    const updatedContents = contents.map(content => ({
      ...content,
      completed: completedItems.includes(content.id)
    }));
    setStudyContents(updatedContents);
  };

  const calculateDisciplineProgress = (contents: StudyContent[], completedItems: string[]) => {
    const disciplineProgress: Record<string, { completed: number; total: number; percentage: number }> = {};
    
    contents.forEach(content => {
      if (!disciplineProgress[content.discipline]) {
        disciplineProgress[content.discipline] = { completed: 0, total: 0, percentage: 0 };
      }
      disciplineProgress[content.discipline].total++;
      if (completedItems.includes(content.id)) {
        disciplineProgress[content.discipline].completed++;
      }
    });

    // Calculate percentages
    Object.keys(disciplineProgress).forEach(discipline => {
      const { completed, total } = disciplineProgress[discipline];
      disciplineProgress[discipline].percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    });

    return disciplineProgress;
  };

  const processConteudosJsonb = (conteudosJsonb: any): StudyContent[] => {
    if (!conteudosJsonb || typeof conteudosJsonb !== 'object') {
      return [];
    }

    const contents: StudyContent[] = [];
    
    // Process the JSONB structure
    // Assuming structure like: { "week_1": [{ "name": "...", "discipline": "...", ... }], ... }
    Object.keys(conteudosJsonb).forEach(weekKey => {
      const weekNumber = parseInt(weekKey.replace('week_', '') || '1');
      const weekContents = conteudosJsonb[weekKey];
      
      if (Array.isArray(weekContents)) {
        weekContents.forEach((item, index) => {
          contents.push({
            id: `${weekKey}_${index}`,
            name: item.name || item.titulo || 'Conteúdo sem título',
            discipline: item.discipline || item.disciplina || 'Geral',
            week: weekNumber,
            sanarflixUrl: item.url || item.sanarflixUrl || '#',
            completed: false,
            type: item.type || item.tipo || 'video'
          });
        });
      }
    });

    return contents;
  };

  const initializeProgress = (contents: StudyContent[], userId: string) => {
    const disciplineProgress: Record<string, { completed: number; total: number; percentage: number }> = {};
    
    contents.forEach(content => {
      if (!disciplineProgress[content.discipline]) {
        disciplineProgress[content.discipline] = { completed: 0, total: 0, percentage: 0 };
      }
      disciplineProgress[content.discipline].total++;
    });

    const newProgress: Progress = {
      userId,
      completedItems: [],
      totalItems: contents.length,
      progressByDiscipline: disciplineProgress
    };

    setProgress(newProgress);
    localStorage.setItem('study-progress', JSON.stringify(newProgress));
  };

  const toggleContentCompletion = async (contentId: string) => {
    if (!user) return;

    const content = studyContents.find(c => c.id === contentId);
    if (!content) return;

    const isCompleting = !content.completed;

    // Optimistic update - update UI immediately
    const updatedContents = studyContents.map(c => 
      c.id === contentId ? { ...c, completed: !c.completed } : c
    );
    setStudyContents(updatedContents);

    // Update progress state
    const completedItems = content.completed 
      ? progress.completedItems.filter(id => id !== contentId)
      : [...progress.completedItems, contentId];

    const disciplineProgress = calculateDisciplineProgress(updatedContents, completedItems);

    const updatedProgress: Progress = {
      ...progress,
      completedItems,
      progressByDiscipline: disciplineProgress
    };

    setProgress(updatedProgress);
    localStorage.setItem('study-progress', JSON.stringify(updatedProgress));

    // Sync with database
    try {
      if (isCompleting) {
        // Add to database
        const { error } = await supabase
          .from('user_progress')
          .upsert({ 
            user_id: user.id, 
            content_id: contentId 
          });
        
        if (error) {
          console.error('Error saving progress to database:', error);
          toast({
            title: "Erro",
            description: "Não foi possível salvar o progresso. Tente novamente.",
            duration: 3000,
          });
          // Revert optimistic update
          const revertedContents = studyContents.map(c => 
            c.id === contentId ? { ...c, completed: content.completed } : c
          );
          setStudyContents(revertedContents);
          return;
        }
      } else {
        // Remove from database
        const { error } = await supabase
          .from('user_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('content_id', contentId);
        
        if (error) {
          console.error('Error removing progress from database:', error);
          toast({
            title: "Erro",
            description: "Não foi possível remover o progresso. Tente novamente.",
            duration: 3000,
          });
          // Revert optimistic update
          const revertedContents = studyContents.map(c => 
            c.id === contentId ? { ...c, completed: content.completed } : c
          );
          setStudyContents(revertedContents);
          return;
        }
      }

      // Show success toast
      toast({
        title: isCompleting ? "Parabéns! 🎉" : "Item desmarcado",
        description: isCompleting 
          ? `"${content.name}" foi concluído!` 
          : `"${content.name}" foi desmarcado`,
        duration: 2000,
      });
    } catch (error) {
      console.error('Error syncing progress:', error);
      toast({
        title: "Erro",
        description: "Erro ao sincronizar progresso. Verifique sua conexão.",
        duration: 3000,
      });
    }
  };

  const getFilteredContents = (discipline?: string, status?: 'completed' | 'pending'): StudyContent[] => {
    let filtered = studyContents;

    if (discipline && discipline !== 'all') {
      filtered = filtered.filter(content => content.discipline === discipline);
    }

    if (status) {
      filtered = filtered.filter(content => 
        status === 'completed' ? content.completed : !content.completed
      );
    }

    return filtered;
  };

  return (
    <StudyContext.Provider value={{
      studyContents,
      progress,
      toggleContentCompletion,
      getFilteredContents
    }}>
      {children}
    </StudyContext.Provider>
  );
};

export const useStudy = () => {
  const context = useContext(StudyContext);
  if (!context) {
    throw new Error('useStudy must be used within StudyProvider');
  }
  return context;
};