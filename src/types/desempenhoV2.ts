export type DesempenhoV2Tab =
  | 'visao-institucional'
  | 'diagnostico-curricular'
  | 'visao-alunos'
  | 'insights-pedagogicos'
  | 'inteligencia-decisoria';

export interface DesempenhoV2Filters {
  iesId: string;
  simuladoId: string;
  periodo: string;
  turmas: string[];
}

export const DEFAULT_FILTERS: DesempenhoV2Filters = {
  iesId: '',
  simuladoId: '',
  periodo: '',
  turmas: [],
};

export const TAB_CONFIG: { value: DesempenhoV2Tab; label: string }[] = [
  { value: 'visao-institucional', label: 'Visão Institucional' },
  { value: 'diagnostico-curricular', label: 'Diagnóstico Curricular' },
  { value: 'visao-alunos', label: 'Visão de Alunos' },
  { value: 'insights-pedagogicos', label: 'Insights Pedagógicos' },
  { value: 'inteligencia-decisoria', label: 'Inteligência Decisória' },
];

// ── View Model types consumed by UI components ──

export interface SimuladoOption {
  id: string;
  nome: string;
}

export interface IesOption {
  id: string;
  nome: string;
}

export interface InstitutionalViewModel {
  kpis: import('@/mocks/desempenhoInstitucionalV2').KpiData[];
  faixas: import('@/mocks/desempenhoInstitucionalV2').FaixaDistribuicao[];
  meta: import('@/mocks/desempenhoInstitucionalV2').MetaInstitucional;
  evolucao: import('@/mocks/desempenhoInstitucionalV2').EvolucaoSimulado[];
  distanciaFaixa: import('@/mocks/desempenhoInstitucionalV2').DistanciaFaixa[];
  alunosAbaixo: StudentScore[];
  headerSummary: HeaderSummary;
}

export interface StudentScore {
  nome: string;
  semestre: number;
  acertos: number;
  total: number;
  percentual: number;
  scoresByArea: Record<string, number>;
}

export interface HeaderSummary {
  totalAlunos: number;
  percentProficientes: number;
  alunosFaltamMeta: number;
  sancao: string | null;
}

// ── Raw RPC response types ──

export interface RpcOverallStats {
  total: number;
  acertos: number;
  totalStudents: number;
}

export interface RpcAreaData {
  name: string;
  total: number;
  acertos: number;
}

export interface RpcPerformanceResponse {
  overallStats: RpcOverallStats;
  bySemester: { semestre: number; total: number; acertos: number; num_students: number }[];
  byArea: RpcAreaData[];
  bySpecialty: (RpcAreaData & { area_name: string })[];
  bySubspecialty: (RpcAreaData & { specialty_name: string; area_name: string })[];
  byDifficulty: RpcAreaData[];
}

export interface RpcEvolutionEntry {
  simulado_id: string;
  simulado_nome: string;
  created_at: string;
  areas: { area: string; total: number; acertos: number; percentual: number }[];
}

export interface RpcStudentScoresResponse {
  areas: string[];
  students: {
    nome: string;
    semestre: number;
    score_total: number;
    total_questions: number;
    scores_by_area: Record<string, number> | null;
  }[];
}
