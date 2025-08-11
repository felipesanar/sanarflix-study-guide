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
        // If no content found, set empty array
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

      // Load saved progress
      const savedProgress = localStorage.getItem('study-progress');
      if (savedProgress) {
        const parsedProgress = JSON.parse(savedProgress);
        if (parsedProgress.userId === user.id) {
          setProgress(parsedProgress);
          
          // Update content completion status
          const updatedContents = processedContents.map(content => ({
            ...content,
            completed: parsedProgress.completedItems.includes(content.id)
          }));
          setStudyContents(updatedContents);
        }
      }

      // Initialize progress if not exists
      if (!savedProgress || JSON.parse(savedProgress).userId !== user.id) {
        initializeProgress(processedContents, user.id);
      }
    } catch (error) {
      console.error('Error loading study contents:', error);
      setStudyContents([]);
    }
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

  const toggleContentCompletion = (contentId: string) => {
    if (!user) return;

    const content = studyContents.find(c => c.id === contentId);
    if (!content) return;

    const updatedContents = studyContents.map(c => 
      c.id === contentId ? { ...c, completed: !c.completed } : c
    );
    
    setStudyContents(updatedContents);

    // Update progress
    const completedItems = content.completed 
      ? progress.completedItems.filter(id => id !== contentId)
      : [...progress.completedItems, contentId];

    const disciplineProgress = { ...progress.progressByDiscipline };
    
    // Recalculate discipline progress
    Object.keys(disciplineProgress).forEach(discipline => {
      const disciplineContents = updatedContents.filter(c => c.discipline === discipline);
      const completed = disciplineContents.filter(c => c.completed).length;
      disciplineProgress[discipline] = {
        completed,
        total: disciplineContents.length,
        percentage: disciplineContents.length > 0 ? Math.round((completed / disciplineContents.length) * 100) : 0
      };
    });

    const updatedProgress: Progress = {
      ...progress,
      completedItems,
      progressByDiscipline: disciplineProgress
    };

    setProgress(updatedProgress);
    localStorage.setItem('study-progress', JSON.stringify(updatedProgress));

    // Show toast notification
    toast({
      title: content.completed ? "Item desmarcado" : "Parabéns! 🎉",
      description: content.completed 
        ? `"${content.name}" foi desmarcado` 
        : `"${content.name}" foi concluído!`,
      duration: 2000,
    });
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