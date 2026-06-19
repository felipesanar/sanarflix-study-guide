/**
 * Plano de Reta Final — Caderno de Erros (SanarFlix Academy).
 *
 * Prioriza as entradas do caderno por urgência/impacto e distribui em dias até a
 * prova. Pure-TS (testável). Portado do enamed-arena (retaFinalPlan.ts), adaptado.
 *
 * NOTA: pesos de área são PROVISÓRIOS — validar com Conteúdo (blueprint ENAMED).
 */

export interface PlanEntryInput {
  id: string;
  grandeArea: string | null;
  tema: string | null;
  srsDueAt: string | null;
  srsLapses: number;
  srsReps: number;
}

export interface PlanItem {
  entry: PlanEntryInput;
  score: number;
}

export interface DayPlan {
  day: number; // 1-based
  items: PlanItem[];
}

export interface RetaFinalOptions {
  now: string;            // ISO; injetado para ser testável
  daysUntilExam: number;
  dailyCapacity?: number; // default 15
}

// Pesos provisórios por área (somam ~1). Chave normalizada em minúsculas. TODO: validar com Conteúdo.
const AREA_WEIGHTS: Record<string, number> = {
  'clínica médica': 0.35,
  'clinica medica': 0.35,
  'cirurgia': 0.2,
  'ginecologia e obstetrícia': 0.15,
  'ginecologia e obstetricia': 0.15,
  'pediatria': 0.15,
  'medicina da família': 0.15,
  'medicina preventiva': 0.15,
  'preventiva': 0.15,
};
const DEFAULT_AREA_WEIGHT = 0.05;

function areaWeight(area: string | null): number {
  if (!area) return DEFAULT_AREA_WEIGHT;
  return AREA_WEIGHTS[area.trim().toLowerCase()] ?? DEFAULT_AREA_WEIGHT;
}

export function buildRetaFinalPlan(
  entries: PlanEntryInput[],
  opts: RetaFinalOptions,
): { ranked: PlanItem[]; days: DayPlan[] } {
  if (entries.length === 0) return { ranked: [], days: [] };

  const nowMs = new Date(opts.now).getTime();
  const dailyCapacity = Math.max(1, opts.dailyCapacity ?? 15);
  const maxDays = Math.max(0, opts.daysUntilExam);

  // frequência por área (para o componente de frequência do score)
  const areaCounts = new Map<string, number>();
  for (const e of entries) {
    const key = (e.grandeArea ?? '—').toLowerCase();
    areaCounts.set(key, (areaCounts.get(key) ?? 0) + 1);
  }
  const maxAreaCount = Math.max(...areaCounts.values());

  const ranked: PlanItem[] = entries
    .map((entry) => {
      let score = 0;
      // atraso
      if (entry.srsDueAt == null) score += 4;
      else if (new Date(entry.srsDueAt).getTime() <= nowMs) score += 5;
      // lapsos
      score += entry.srsLapses * 0.8;
      // peso da área
      score += areaWeight(entry.grandeArea) * 4;
      // frequência relativa da área
      const freq = areaCounts.get((entry.grandeArea ?? '—').toLowerCase()) ?? 0;
      score += (maxAreaCount > 0 ? freq / maxAreaCount : 0) * 2;
      // nunca revisado
      if (entry.srsReps === 0) score += 1.5;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);

  // distribuição gulosa até a capacidade total (maxDays × dailyCapacity)
  const days: DayPlan[] = [];
  const capacity = maxDays * dailyCapacity;
  const toDistribute = ranked.slice(0, capacity);
  for (let i = 0; i < toDistribute.length; i++) {
    const dayIndex = Math.floor(i / dailyCapacity);
    if (!days[dayIndex]) days[dayIndex] = { day: dayIndex + 1, items: [] };
    days[dayIndex].items.push(toDistribute[i]);
  }

  return { ranked, days };
}
