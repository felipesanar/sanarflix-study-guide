import type { DesempenhoV2Filters } from '@/types/desempenhoV2';

export type ActiveBaseMode = 'semestres' | 'general' | 'sixth-year';

export interface ActiveBase {
  /** null = todos os semestres (geral); array = lista explícita */
  semestres: number[] | null;
  mode: ActiveBaseMode;
  /** Rótulo curto para selos / textos */
  label: string;
}

export const SIXTH_YEAR_SEMESTRES = [11, 12];

/**
 * Resolve a base ativa para a aba "Visão Institucional" com a seguinte precedência:
 * 1) Se houver semestres selecionados → use-os.
 * 2) Senão, se "Conceito Geral" estiver ON → base geral (todos).
 * 3) Senão (padrão) → 6º ano [11, 12].
 */
export function resolveActiveBase(filters: DesempenhoV2Filters): ActiveBase {
  // Compat: query-string antiga pode ainda trazer `conceitoGeral=1` sem `baseMode`.
  const mode = filters.baseMode
    ?? (filters.conceitoGeral
      ? 'general'
      : (filters.semestres && filters.semestres.length > 0 ? 'semestres' : 'sixth-year'));

  if (mode === 'semestres') {
    const selected = (filters.semestres ?? [])
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    const ordered = [...selected].sort((a, b) => a - b);
    if (ordered.length === 0) {
      return { semestres: [], mode: 'semestres', label: 'Selecione ao menos um semestre' };
    }
    const label = ordered.length === 1
      ? `${ordered[0]}º semestre`
      : `Semestres ${ordered.join(', ')}`;
    return { semestres: ordered, mode: 'semestres', label };
  }

  if (mode === 'general') {
    return { semestres: null, mode: 'general', label: 'Geral — todos os alunos que fizeram a prova' };
  }

  return { semestres: SIXTH_YEAR_SEMESTRES, mode: 'sixth-year', label: '6º ano (11º e 12º semestres)' };
}
