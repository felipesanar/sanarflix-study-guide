/**
 * Cor por nota do conceito MEC — mesma paleta de
 * `src/components/gestor/panorama/ConceitoMecCard.tsx` (1-2 red / 3 amber /
 * 4 blue / 5 emerald). Centralizado aqui para reuso entre o card por IES e o
 * BarChart do comparativo.
 */
export const CONCEPT_TEXT_COLOR: Record<number, string> = {
  1: 'text-red-600 dark:text-red-400',
  2: 'text-red-600 dark:text-red-400',
  3: 'text-amber-600 dark:text-amber-400',
  4: 'text-blue-600 dark:text-blue-400',
  5: 'text-emerald-600 dark:text-emerald-400',
};

/** Cor hex (HSL) equivalente, para uso em `fill` do recharts. */
export const CONCEPT_HEX_COLOR: Record<number, string> = {
  1: 'hsl(0 84% 60%)',
  2: 'hsl(0 84% 60%)',
  3: 'hsl(38 92% 50%)',
  4: 'hsl(217 91% 60%)',
  5: 'hsl(142 71% 45%)',
};

/** Cor por faixa de % de proficientes (barras do BarChart) — ≥60 emerald, ≥40 amber, <40 red. */
export function pcpBarColor(pcp: number): string {
  if (pcp >= 60) return 'hsl(142 71% 45%)';
  if (pcp >= 40) return 'hsl(38 92% 50%)';
  return 'hsl(0 84% 60%)';
}
