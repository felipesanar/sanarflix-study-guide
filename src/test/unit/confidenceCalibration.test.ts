import { describe, it, expect } from 'vitest';
import { computeCalibration, type CalibrationInput } from '@/lib/confidenceCalibration';

const rows = (...rs: CalibrationInput[]) => rs;

describe('computeCalibration', () => {
  it('agrupa por confiança com total/acertos/acurácia', () => {
    const r = computeCalibration(rows(
      { confidence: 'alta', wasCorrect: true },
      { confidence: 'alta', wasCorrect: false },
      { confidence: 'media', wasCorrect: true },
      { confidence: 'baixa', wasCorrect: false },
    ));
    expect(r.total).toBe(4);
    const alta = r.buckets.find((b) => b.confidence === 'alta')!;
    expect(alta.total).toBe(2);
    expect(alta.correct).toBe(1);
    expect(alta.accuracy).toBeCloseTo(0.5, 5);
  });

  it('conta overconfidence (alta mas errou) e underconfidence (baixa mas acertou)', () => {
    const r = computeCalibration(rows(
      { confidence: 'alta', wasCorrect: false },
      { confidence: 'alta', wasCorrect: false },
      { confidence: 'baixa', wasCorrect: true },
    ));
    expect(r.altaButWrong).toBe(2);
    expect(r.baixaButCorrect).toBe(1);
  });

  it('retorna estrutura vazia coerente quando não há revisões', () => {
    const r = computeCalibration([]);
    expect(r.total).toBe(0);
    expect(r.altaButWrong).toBe(0);
    expect(r.baixaButCorrect).toBe(0);
    // sempre os 3 buckets, mesmo zerados, em ordem baixa→media→alta
    expect(r.buckets.map((b) => b.confidence)).toEqual(['baixa', 'media', 'alta']);
    expect(r.buckets.every((b) => b.total === 0 && b.accuracy === 0)).toBe(true);
  });

  it('acurácia de bucket vazio é 0 (não NaN)', () => {
    const r = computeCalibration(rows({ confidence: 'media', wasCorrect: true }));
    const baixa = r.buckets.find((b) => b.confidence === 'baixa')!;
    expect(baixa.accuracy).toBe(0);
  });
});
