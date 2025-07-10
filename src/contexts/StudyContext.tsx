
import React, { createContext, useContext, useState, useEffect } from 'react';
import { StudyContextType, StudyContent, Progress } from '@/types';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

const StudyContext = createContext<StudyContextType | null>(null);

// Mock study content data based on faculty and semester
const mockStudyContents: Record<string, Record<number, StudyContent[]>> = {
  'Claretiano': {
    3: [
      {
        id: '1',
        name: 'Anatomia do Sistema Cardiovascular',
        discipline: 'Anatomia',
        week: 1,
        sanarflixUrl: 'https://sanarflix.com.br/anatomia-cardiovascular',
        completed: false,
        type: 'video'
      },
      {
        id: '2',
        name: 'Fisiologia Cardíaca - Ciclo Cardíaco',
        discipline: 'Fisiologia',
        week: 1,
        sanarflixUrl: 'https://sanarflix.com.br/fisiologia-cardiaca',
        completed: false,
        type: 'video'
      },
      {
        id: '3',
        name: 'Exercícios de Anatomia Cardiovascular',
        discipline: 'Anatomia',
        week: 1,
        sanarflixUrl: 'https://sanarflix.com.br/exercicios-anatomia',
        completed: false,
        type: 'exercise'
      },
      {
        id: '4',
        name: 'Farmacologia Cardiovascular',
        discipline: 'Farmacologia',
        week: 2,
        sanarflixUrl: 'https://sanarflix.com.br/farmaco-cardiovascular',
        completed: false,
        type: 'video'
      },
      {
        id: '5',
        name: 'Patologia Cardíaca',
        discipline: 'Patologia',
        week: 2,
        sanarflixUrl: 'https://sanarflix.com.br/patologia-cardiaca',
        completed: false,
        type: 'video'
      },
      {
        id: '6',
        name: 'Sistema Respiratório - Anatomia',
        discipline: 'Anatomia',
        week: 3,
        sanarflixUrl: 'https://sanarflix.com.br/anatomia-respiratorio',
        completed: false,
        type: 'video'
      },
      {
        id: '7',
        name: 'Fisiologia Respiratória',
        discipline: 'Fisiologia',
        week: 3,
        sanarflixUrl: 'https://sanarflix.com.br/fisiologia-respiratoria',
        completed: false,
        type: 'video'
      },
      {
        id: '8',
        name: 'Questões de Fisiologia',
        discipline: 'Fisiologia',
        week: 3,
        sanarflixUrl: 'https://sanarflix.com.br/questoes-fisiologia',
        completed: false,
        type: 'exercise'
      }
    ]
  },
  'USP': {
    2: [
      {
        id: '9',
        name: 'Introdução à Histologia',
        discipline: 'Histologia',
        week: 1,
        sanarflixUrl: 'https://sanarflix.com.br/intro-histologia',
        completed: false,
        type: 'video'
      },
      {
        id: '10',
        name: 'Tecidos Básicos',
        discipline: 'Histologia',
        week: 1,
        sanarflixUrl: 'https://sanarflix.com.br/tecidos-basicos',
        completed: false,
        type: 'video'
      }
    ]
  }
};

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
    if (user) {
      // Load study contents based on user's faculty and semester
      const contents = mockStudyContents[user.faculty]?.[user.semester] || [];
      setStudyContents(contents);

      // Load saved progress
      const savedProgress = localStorage.getItem('study-progress');
      if (savedProgress) {
        const parsedProgress = JSON.parse(savedProgress);
        if (parsedProgress.userId === user.email) {
          setProgress(parsedProgress);
          
          // Update content completion status
          const updatedContents = contents.map(content => ({
            ...content,
            completed: parsedProgress.completedItems.includes(content.id)
          }));
          setStudyContents(updatedContents);
        }
      }

      // Initialize progress if not exists
      if (!savedProgress || JSON.parse(savedProgress).userId !== user.email) {
        initializeProgress(contents, user.email);
      }
    }
  }, [user]);

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
