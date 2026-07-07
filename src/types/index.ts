import type { Access } from '@/experiences/access';

export interface AccessibleIes {
  id: string;
  nome: string;
}

export interface UserGroup {
  id: string;
  name: string;
  ies: AccessibleIes[];
}

export interface User {
  id: string;           // campo 'id' da tabela users
  email: string;
  nome: string;         // renomear de 'name' para 'nome'
  id_ies: string;       // UUID da instituição "principal" do usuário (pode ser vazio para gestor_grupo puro)
  ies_nome: string;     // nome da IES (obtido via JOIN)
  semestre?: number;
  roles?: string[];     // User roles from user_roles table
  /**
   * Lista de IES acessíveis pelo usuário: união entre `id_ies` próprio e
   * IES vinculadas via grupos educacionais (gestor_grupo). Para Admin e
   * B2B Partner, costuma vir vazia e o cliente lista todas via tabela `ies`.
   */
  accessible_ies?: AccessibleIes[];
  /**
   * Grupos educacionais aos quais o usuário pertence (gestor_grupo).
   */
  groups?: UserGroup[];
}

export interface AccessRules {
  home: boolean;
  studyGuide: boolean;
  dashboard: boolean;
  SimuladoDesempenho: boolean;
  userManagement: boolean;
  sanarclass: boolean;
  simulados: boolean;
  analytics: boolean;
  desempenhoInstitucional: boolean;
  errorNotebook: boolean;
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
  /**
   * Acesso por experiências + capabilities do usuário atualmente exposto
   * (segue impersonation quando ativa). Nunca undefined com user logado;
   * ver src/experiences/access.ts (EMPTY_ACCESS como fallback neutro).
   */
  access: Access;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  needsPasswordChange: boolean;
  changePassword: (newPassword: string) => Promise<boolean>;
  forceRefreshProfile: () => Promise<void>;
  // Impersonation
  impersonatedUser: User | null;
  isImpersonating: boolean;
  realAdminUser: User | null;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

export interface StudyContextType {
  studyContents: StudyContent[];
  progress: Progress;
  toggleContentCompletion: (contentId: string) => Promise<void>;
  getFilteredContents: (discipline?: string, status?: 'completed' | 'pending') => StudyContent[];
}
