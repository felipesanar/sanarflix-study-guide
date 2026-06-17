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
  const selected = (filters.semestres ?? [])
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  if (selected.length > 0) {
    const ordered = [...selected].sort((a, b) => a - b);
    const label = ordered.length === 1
      ? `${ordered[0]}º semestre`
      : `Semestres ${ordered.join(', ')}`;
    return { semestres: ordered, mode: 'semestres', label };
  }

  if (filters.conceitoGeral) {
    return { semestres: null, mode: 'general', label: 'IES inteira' };
  }

  return { semestres: SIXTH_YEAR_SEMESTRES, mode: 'sixth-year', label: '6º ano (11º e 12º semestres)' };
}
