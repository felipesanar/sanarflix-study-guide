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
  iesId: 'b2b',
  simuladoId: 'simulado-teste',
  periodo: '2024.2',
  turmas: [],
};

export const TAB_CONFIG: { value: DesempenhoV2Tab; label: string }[] = [
  { value: 'visao-institucional', label: 'Visão Institucional' },
  { value: 'diagnostico-curricular', label: 'Diagnóstico Curricular' },
  { value: 'visao-alunos', label: 'Visão de Alunos' },
  { value: 'insights-pedagogicos', label: 'Insights Pedagógicos' },
  { value: 'inteligencia-decisoria', label: 'Inteligência Decisória' },
];
