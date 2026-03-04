export interface StudentSnapshot {
  semester: number | null;
  streakDays: number;
  lastActiveAt: string | null;
  exams: {
    title: string;
    materia: string;
    date: string;
    daysUntil: number;
  }[];
  progress: {
    percentage: number;
    completed: number;
    total: number;
  };
  topGaps: {
    materia: string;
    tema: string | null;
    percentage: number;
    total: number;
    completed: number;
  }[];
  simuladoPerformance: {
    area: string;
    acertos: number;
    total: number;
    percentage: number;
  }[];
  topWeaknesses: {
    tema: string;
    area: string | null;
    acertos: number;
    total: number;
  }[];
  byMateria: {
    materia: string;
    percentage: number;
    completed: number;
    total: number;
  }[];
}

export interface TutorPlanStep {
  title: string;
  detail: string;
  check: string;
}

export interface TutorPlanResponse {
  headline: string;
  whyThisMatters: string;
  todayPlan: {
    durationMin: number;
    steps: TutorPlanStep[];
  };
  weekPlan: {
    dayLabel: string;
    focus: string;
    outcome: string;
  }[];
  priorities: {
    item: string;
    reason: string;
    impact: 'high' | 'med' | 'low';
  }[];
  risks: {
    risk: string;
    mitigation: string;
  }[];
  studyMethods: {
    method: string;
    whenToUse: string;
  }[];
  references?: string[];
  meta?: {
    model?: string;
    latencyMs?: number;
    usedOnlineResearch?: boolean;
  };
}
