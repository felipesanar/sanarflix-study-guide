
export interface User {
  id: string;           // campo 'id' da tabela users
  email: string;
  nome: string;         // renomear de 'name' para 'nome'
  // cpf removed for security - sensitive PII should not be in frontend state
  id_ies: string;       // UUID da instituição
  ies_nome: string;     // nome da IES (obtido via JOIN)
  semestre?: number;
}

export interface AccessRules {
  studyGuide: boolean;
  enamed: boolean;
  dashboard: boolean;
  SimuladoDesempenho: boolean;
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
