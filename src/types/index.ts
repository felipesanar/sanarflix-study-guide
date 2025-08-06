
export interface User {
  id: string;
  email: string;
  name: string;
  faculty: string;
  semester: number;
  cpf?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  cpf?: string;
  email: string;
  id_ies: string;
  semestre?: number;
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  nome: string;
  cpf?: string;
  id_ies: string;
  semestre?: number;
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
  profile: Profile | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, userData: SignUpData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

export interface StudyContextType {
  studyContents: StudyContent[];
  progress: Progress;
  toggleContentCompletion: (contentId: string) => void;
  getFilteredContents: (discipline?: string, status?: 'completed' | 'pending') => StudyContent[];
}
