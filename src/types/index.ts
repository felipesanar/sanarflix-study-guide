
export interface User {
  id: string;
  email: string;
  name: string;
  faculty: string;
  semester: number;
  requiresPasswordChange?: boolean;
}

export interface AccessRules {
  studyGuide: boolean;
  enamed: boolean;
  dashboard: boolean;
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
  changePassword: (newPassword: string) => Promise<boolean>;
  isLoading: boolean;
}

export interface StudyContextType {
  studyContents: StudyContent[];
  progress: Progress;
  toggleContentCompletion: (contentId: string) => void;
  getFilteredContents: (discipline?: string, status?: 'completed' | 'pending') => StudyContent[];
}
