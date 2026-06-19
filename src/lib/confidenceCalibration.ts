/**
 * Calibração de confiança — Caderno de Erros (SanarFlix Academy).
 *
 * Compara a confiança declarada na revisão com o acerto real, expondo
 * overconfidence (declarou "alta" e errou) e underconfidence (declarou "baixa"
 * e acertou). Computado client-side a partir de review_attempts (RLS own).
 */
import type { SrsConfidence } from '@/lib/srs';

export interface CalibrationInput {
  confidence: SrsConfidence;
  wasCorrect: boolean;
}

export interface CalibrationBucket {
  confidence: SrsConfidence;
  total: number;
  correct: number;
  accuracy: number; // 0..1
}

export interface CalibrationResult {
  buckets: CalibrationBucket[]; // sempre baixa, media, alta nesta ordem
  total: number;
  altaButWrong: number;
  baixaButCorrect: number;
}

const ORDER: SrsConfidence[] = ['baixa', 'media', 'alta'];

export function computeCalibration(rows: CalibrationInput[]): CalibrationResult {
  const buckets: CalibrationBucket[] = ORDER.map((confidence) => {
    const inBucket = rows.filter((r) => r.confidence === confidence);
    const correct = inBucket.filter((r) => r.wasCorrect).length;
    const total = inBucket.length;
    return { confidence, total, correct, accuracy: total > 0 ? correct / total : 0 };
  });

  return {
    buckets,
    total: rows.length,
    altaButWrong: rows.filter((r) => r.confidence === 'alta' && !r.wasCorrect).length,
    baixaButCorrect: rows.filter((r) => r.confidence === 'baixa' && r.wasCorrect).length,
  };
}
