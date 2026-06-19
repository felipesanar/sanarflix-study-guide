import { describe, it, expect } from 'vitest';
import { computeInsights, type InsightInput } from '@/lib/cadernoInsights';
import type { ErrorReason } from '@/hooks/useErrorNotebook';

const entry = (over: Partial<InsightInput['entries'][number]> = {}) => ({
  reason: 'did_not_know' as ErrorReason,
  grandeArea: 'Clínica Médica' as string | null,
  tema: null as string | null,
  masteredAt: null as string | null,
  ...over,
});

const baseEntries = (n: number, over = {}) => Array.from({ length: n }, () => entry(over));

describe('computeInsights — gate de dados', () => {
  it('retorna vazio com menos de 5 entradas', () => {
    expect(computeInsights({ entries: baseEntries(4), reviews: [] })).toEqual([]);
  });
});

describe('computeInsights — área fraca', () => {
  it('gera weak_area quando uma área concentra >= 30% dos erros', () => {
    const entries = [
      ...baseEntries(6, { grandeArea: 'Pediatria' }),
      ...baseEntries(4, { grandeArea: 'Cirurgia' }),
    ];
    const insights = computeInsights({ entries, reviews: [] });
    const weak = insights.find((i) => i.type === 'weak_area');
    expect(weak).toBeTruthy();
    expect(weak!.title).toContain('Pediatria');
  });
});

describe('computeInsights — causa dominante', () => {
  it('gera dominant_cause quando uma causa passa de 40%', () => {
    const entries = [
      ...baseEntries(7, { reason: 'did_not_remember', grandeArea: 'Clínica Médica' }),
      ...baseEntries(3, { reason: 'did_not_know', grandeArea: 'Cirurgia' }),
    ];
    const insights = computeInsights({ entries, reviews: [] });
    expect(insights.some((i) => i.type === 'dominant_cause')).toBe(true);
  });
});

describe('computeInsights — confusão recorrente', () => {
  it('gera recurring_confusion quando um tema tem >= 3 erros de interpretação', () => {
    const entries = [
      ...baseEntries(3, { reason: 'did_not_understand_statement', tema: 'ECG', grandeArea: 'Clínica Médica' }),
      ...baseEntries(2, { reason: 'did_not_know', tema: 'Sepse', grandeArea: 'Clínica Médica' }),
    ];
    const insights = computeInsights({ entries, reviews: [] });
    const conf = insights.find((i) => i.type === 'recurring_confusion');
    expect(conf).toBeTruthy();
    expect(conf!.title + conf!.body).toContain('ECG');
  });
});

describe('computeInsights — overconfidence', () => {
  it('gera overconfidence quando muitas revisões "alta" foram erradas', () => {
    const reviews = [
      { confidence: 'alta' as const, wasCorrect: false },
      { confidence: 'alta' as const, wasCorrect: false },
      { confidence: 'alta' as const, wasCorrect: true },
    ];
    const insights = computeInsights({ entries: baseEntries(6), reviews });
    expect(insights.some((i) => i.type === 'overconfidence')).toBe(true);
  });
});

describe('computeInsights — ROI', () => {
  it('gera roi positivo quando há questões dominadas', () => {
    const entries = [
      ...baseEntries(2, { masteredAt: '2026-06-10T00:00:00Z' }),
      ...baseEntries(5),
    ];
    const insights = computeInsights({ entries, reviews: [] });
    const roi = insights.find((i) => i.type === 'roi');
    expect(roi).toBeTruthy();
    expect(roi!.severity).toBe('positive');
  });

  it('ordena críticos antes de positivos', () => {
    const entries = [
      ...baseEntries(8, { grandeArea: 'Pediatria', masteredAt: '2026-06-10T00:00:00Z' }),
      ...baseEntries(2, { grandeArea: 'Cirurgia' }),
    ];
    const insights = computeInsights({ entries, reviews: [] });
    const firstPositive = insights.findIndex((i) => i.severity === 'positive');
    const firstCritical = insights.findIndex((i) => i.severity === 'critical' || i.severity === 'attention');
    if (firstPositive !== -1 && firstCritical !== -1) {
      expect(firstCritical).toBeLessThan(firstPositive);
    }
  });
});
