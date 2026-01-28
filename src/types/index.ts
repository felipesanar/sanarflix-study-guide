
export interface User {
  id: string;           // campo 'id' da tabela users
  email: string;
  nome: string;         // renomear de 'name' para 'nome'
  id_ies: string;       // UUID da instituição
  ies_nome: string;     // nome da IES (obtido via JOIN)
  semestre?: number;
  roles?: string[];     // User roles from user_roles table
}

export interface AccessRules {
  home: boolean;
  studyGuide: boolean;
  enamed: boolean;
  cronogramaEnamed: boolean;
  dashboard: boolean;
  SimuladoDesempenho: boolean;
  userManagement: boolean;
  intensivoUSCS: boolean;
  sanarclass: boolean;
  simulados: boolean;
  analytics: boolean;
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
  needsPasswordChange: boolean;
  changePassword: (newPassword: string) => Promise<boolean>;
}

export interface StudyContextType {
  studyContents: StudyContent[];
  progress: Progress;
  toggleContentCompletion: (contentId: string) => Promise<void>;
  getFilteredContents: (discipline?: string, status?: 'completed' | 'pending') => StudyContent[];
}
