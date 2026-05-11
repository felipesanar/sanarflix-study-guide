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
  semestres: string[];
  areas: string[];
  especialidades: string[];
  temas: string[];
}

export const DEFAULT_FILTERS: DesempenhoV2Filters = {
  iesId: '',
  simuladoId: '',
  periodo: '',
  turmas: [],
  semestres: [],
  areas: [],
  especialidades: [],
  temas: [],
};

/** Count how many filters are actively set (non-default) */
export function countActiveFilters(filters: DesempenhoV2Filters): number {
  let count = 0;
  if (filters.iesId) count++;
  if (filters.simuladoId) count++;
  if (filters.periodo) count++;
  if (filters.turmas.length) count++;
  if (filters.semestres.length) count++;
  if (filters.areas.length) count++;
  if (filters.especialidades.length) count++;
  if (filters.temas.length) count++;
  return count;
}

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

export interface CurricularNode {
  name: string;
  total: number;
  acertos: number;
  percentual: number;
  /** How many students answered questions in this node */
  prevalencia?: number;
}

export interface CurricularAreaNode extends CurricularNode {
  specialties: CurricularSpecialtyNode[];
}

export interface CurricularSpecialtyNode extends CurricularNode {
  areaName: string;
  temas: CurricularTemaNode[];
}

export interface CurricularTemaNode extends CurricularNode {
  areaName: string;
  specialtyName: string;
}

export interface CurricularBreakdown {
  areas: CurricularAreaNode[];
}

export interface InstitutionalViewModel {
  kpis: import('@/mocks/desempenhoInstitucionalV2').KpiData[];
  faixas: import('@/mocks/desempenhoInstitucionalV2').FaixaDistribuicao[];
  meta: import('@/mocks/desempenhoInstitucionalV2').MetaInstitucional;
  evolucao: import('@/mocks/desempenhoInstitucionalV2').EvolucaoSimulado[];
  distanciaFaixa: import('@/mocks/desempenhoInstitucionalV2').DistanciaFaixa[];
  /** @deprecated Use allStudents instead. Kept for backward compat — contains only below-threshold students */
  alunosAbaixo: StudentScore[];
  /** All students (proficient + below threshold) */
  allStudents: StudentScore[];
  headerSummary: HeaderSummary;
  curricular: CurricularBreakdown;
}

export interface StudentScore {
  studentId?: string;
  nome: string;
  semestre: number;
  acertos: number;
  total: number;
  percentual: number;
  scoresByArea: Record<string, number>;
  /** TRI score (score_enamed) from resultados_alunos_tri, when available */
  triScore?: number | null;
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
    student_id?: string;
    nome: string;
    semestre: number;
    score_total: number;
    total_questions: number;
    scores_by_area: Record<string, number> | null;
  }[];
}
