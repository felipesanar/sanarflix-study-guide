// ============================================
// Types for Progress Hub / Central de Progresso
// ============================================

export interface ProgressOverview {
  total: number;
  completed: number;
  percentage: number;
  total_materias: number;
  total_temas: number;
  status_level: 'starting' | 'recovering' | 'consistent' | 'accelerating' | 'dominating';
  status_message: string;
}

export interface ProgressStreak {
  current: number;
  active_days_week: number;
  goal: number;
  /** Number of consecutive weeks where goal was met */
  weeks_achieved?: number;
}

export interface MateriaProgress {
  materia: string;
  total: number;
  completed: number;
  percentage: number;
}

export interface TemaProgress {
  materia: string;
  tema: string;
  total: number;
  completed: number;
  percentage: number;
  last_activity_at?: string | null;
  days_inactive?: number;
}

export interface SubtemaProgress {
  materia: string;
  tema: string;
  subtema: string;
  total: number;
  completed: number;
  percentage: number;
}

export interface WeeklyEvolution {
  week_start: string;
  completed_count: number;
}

export interface LastActivity {
  content_id: string;
  materia: string;
  tema: string | null;
  aula: string | null;
  completed_at: string;
}

export interface NextAction {
  id: string;
  materia: string;
  tema: string | null;
  subtema: string | null;
  aula: string | null;
  link_aula: string | null;
  link_pdf: string | null;
  link_quiz: string | null;
  reason: string;
  priority: number;
  type: 'today_focus' | 'quick_win' | 'unlock_progress';
  /** Estimated duration in minutes (null if unknown) */
  estimated_minutes?: number | null;
}

export interface RiskAlert {
  id: string;
  materia: string;
  tema: string;
  days_inactive: number;
  percentage: number;
}

export interface ProgressHubUser {
  nome: string;
  semestre: number | null;
  streak_goal?: number;
  exam_date?: string | null;
}

export interface ProgressHubData {
  overview: ProgressOverview;
  streak: ProgressStreak;
  by_materia: MateriaProgress[];
  by_tema: TemaProgress[];
  by_subtema: SubtemaProgress[];
  weekly_evolution: WeeklyEvolution[];
  last_activity: LastActivity | null;
  next_actions: NextAction[];
  risk_alerts: RiskAlert[];
  today_subjects: string[];
  user: ProgressHubUser;
}

// Status badge colors and icons mapping
export const STATUS_CONFIG = {
  starting: {
    label: 'Começando',
    color: 'bg-muted text-muted-foreground',
    icon: 'Rocket'
  },
  recovering: {
    label: 'Retomando',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'RefreshCw'
  },
  consistent: {
    label: 'Consistente',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'TrendingUp'
  },
  accelerating: {
    label: 'Acelerando',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: 'Zap'
  },
  dominating: {
    label: 'Dominando',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    icon: 'Crown'
  }
} as const;

// Theme status tag config
export const TEMA_STATUS = {
  atrasado: {
    label: 'Precisa atenção',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    threshold: 30
  },
  em_dia: {
    label: 'Em dia',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    threshold: 70
  },
  dominando: {
    label: 'Dominando',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    threshold: 100
  }
} as const;

export function getTemaStatus(percentage: number): keyof typeof TEMA_STATUS {
  if (percentage < TEMA_STATUS.atrasado.threshold) return 'atrasado';
  if (percentage < TEMA_STATUS.em_dia.threshold) return 'em_dia';
  return 'dominando';
}
