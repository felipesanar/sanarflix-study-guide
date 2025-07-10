
export interface User {
  email: string;
  name: string;
  faculty: string;
  semester: number;
}

export interface StudyContent {
  id: string;
  name: string;
  discipline: string;
  week: number;
  sanarflixUrl: string;
  completed: boolean;
  type: 'video' | 'exercise' | 'reading';
}

export interface Progress {
  userId: string;
  completedItems: string[];
  totalItems: number;
  progressByDiscipline: Record<string, {
    completed: number;
    total: number;
    percentage: number;
  }>;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

export interface StudyContextType {
  studyContents: StudyContent[];
  progress: Progress;
  toggleContentCompletion: (contentId: string) => void;
  getFilteredContents: (discipline?: string, status?: 'completed' | 'pending') => StudyContent[];
}
