import { describe, it, expect } from 'vitest';
import { buildRetaFinalPlan, type PlanEntryInput } from '@/lib/retaFinalPlan';

const NOW = '2026-06-19T12:00:00Z';

const e = (over: Partial<PlanEntryInput> = {}): PlanEntryInput => ({
  id: Math.random().toString(36).slice(2),
  grandeArea: 'Clínica Médica',
  tema: null,
  srsDueAt: NOW, // due agora
  srsLapses: 0,
  srsReps: 1,
  ...over,
});

describe('buildRetaFinalPlan — ranking', () => {
  it('prioriza item atrasado + muitos lapsos + área pesada sobre item leve', () => {
    const heavy = e({ id: 'heavy', grandeArea: 'Clínica Médica', srsDueAt: '2026-06-01T00:00:00Z', srsLapses: 3, srsReps: 0 });
    const light = e({ id: 'light', grandeArea: 'Área Desconhecida', srsDueAt: '2026-07-01T00:00:00Z', srsLapses: 0, srsReps: 5 });
    const { ranked } = buildRetaFinalPlan([light, heavy], { now: NOW, daysUntilExam: 7, dailyCapacity: 10 });
    expect(ranked[0].entry.id).toBe('heavy');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('dá bônus para itens nunca revisados (reps = 0)', () => {
    const fresh = e({ id: 'fresh', srsReps: 0 });
    const seen = e({ id: 'seen', srsReps: 3 });
    const { ranked } = buildRetaFinalPlan([seen, fresh], { now: NOW, daysUntilExam: 7, dailyCapacity: 10 });
    const fr = ranked.find((r) => r.entry.id === 'fresh')!;
    const sn = ranked.find((r) => r.entry.id === 'seen')!;
    expect(fr.score).toBeGreaterThan(sn.score);
  });
});

describe('buildRetaFinalPlan — distribuição', () => {
  it('distribui itens em dias respeitando a capacidade diária', () => {
    const entries = Array.from({ length: 10 }, (_, i) => e({ id: `q${i}` }));
    const { days } = buildRetaFinalPlan(entries, { now: NOW, daysUntilExam: 5, dailyCapacity: 3 });
    expect(days.length).toBeLessThanOrEqual(5);
    expect(days.every((d) => d.items.length <= 3)).toBe(true);
    const totalDistributed = days.reduce((acc, d) => acc + d.items.length, 0);
    expect(totalDistributed).toBe(10);
  });

  it('não excede o número de dias até a prova (corta o excedente)', () => {
    const entries = Array.from({ length: 20 }, (_, i) => e({ id: `q${i}` }));
    const { days, ranked } = buildRetaFinalPlan(entries, { now: NOW, daysUntilExam: 2, dailyCapacity: 3 });
    expect(days.length).toBeLessThanOrEqual(2);
    // capacidade total = 2 dias × 3 = 6; ranked mantém todos, days só os que cabem
    const distributed = days.reduce((acc, d) => acc + d.items.length, 0);
    expect(distributed).toBe(6);
    expect(ranked.length).toBe(20);
  });

  it('retorna vazio para lista vazia', () => {
    const { ranked, days } = buildRetaFinalPlan([], { now: NOW, daysUntilExam: 5, dailyCapacity: 3 });
    expect(ranked).toEqual([]);
    expect(days).toEqual([]);
  });
});
