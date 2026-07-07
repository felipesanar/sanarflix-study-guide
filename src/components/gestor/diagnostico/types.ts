import type {
  CurricularAreaNode,
  CurricularSpecialtyNode,
  CurricularTemaNode,
} from '@/types/desempenhoV2';

/** Nível atual do drill-down: exame (grandes áreas) → área → especialidade. */
export type DiagnosticoLevel = 'areas' | 'especialidades' | 'temas';

export interface DiagnosticoDrillState {
  level: DiagnosticoLevel;
  area?: CurricularAreaNode;
  especialidade?: CurricularSpecialtyNode;
}

/** Item normalizado de uma linha da lista drill-down (área, especialidade ou tema). */
export interface DrillRowItem {
  key: string;
  name: string;
  percentual: number;
  total: number;
  /** Presente apenas quando o item tem filhos navegáveis (área → especialidades, especialidade → temas). */
  navigable: boolean;
}

export const toAreaRow = (area: CurricularAreaNode): DrillRowItem => ({
  key: area.name,
  name: area.name,
  percentual: area.percentual,
  total: area.total,
  navigable: true,
});

export const toEspecialidadeRow = (sp: CurricularSpecialtyNode): DrillRowItem => ({
  key: sp.name,
  name: sp.name,
  percentual: sp.percentual,
  total: sp.total,
  navigable: true,
});

export const toTemaRow = (tema: CurricularTemaNode): DrillRowItem => ({
  key: tema.name,
  name: tema.name,
  percentual: tema.percentual,
  total: tema.total,
  navigable: false,
});
