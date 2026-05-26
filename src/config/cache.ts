// TTLs centralizados de caches locais e React Query.
// Centralizar evita os magic numbers espalhados que dificultam ajuste global.

const MINUTE = 60_000;

export const CACHE_TTL = {
  /** Home: dados consolidados do dia/semana. */
  HOME: 10 * MINUTE,
  /** Progress Hub: streak, metas, conquistas. */
  PROGRESS: 15 * MINUTE,
  /** Lista de simulados / analytics agregados. */
  SIMULADOS: 5 * MINUTE,
  /** Cards de IA / insights pré-computados. */
  CAI: 30 * MINUTE,
  /** Guia de estudos (conteúdos por semestre). */
  STUDY_GUIDE: 15 * MINUTE,
  /** Calendário pessoal. */
  CALENDAR: 30 * MINUTE,
} as const;

export type CacheKey = keyof typeof CACHE_TTL;
