/**
 * Heurística de triagem pós-prova — Caderno de Erros (SanarFlix Academy).
 *
 * Sugere a causa do erro entre as 4 do academy SEM IA, para preencher a triagem
 * de forma otimista (o aluno pode ajustar). Portada do enamed-arena
 * (src/lib/triageHeuristic.ts), adaptada às 4 causas.
 *
 * IMPORTANTE (bug do enamed): a adjacência (R3) usa a ORDEM ORIGINAL das
 * alternativas fornecidas, não ordem lexicográfica.
 */

import type { ErrorReason } from '@/hooks/useErrorNotebook';

export interface TriageItem {
  wasCorrect: boolean;
  confidence: 'baixa' | 'media' | 'alta';
  /** Rótulo da alternativa marcada (ex.: 'A'); null quando em branco. */
  selectedLabel: string | null;
  /** Rótulo da alternativa correta (ex.: 'C'). */
  correctLabel: string;
  /** Rótulos na ORDEM ORIGINAL em que aparecem na questão. */
  optionLabels: string[];
}

/** Duas alternativas são adjacentes se estão lado a lado na ordem original. */
function areAdjacent(a: string | null, b: string, order: string[]): boolean {
  if (!a) return false;
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return false;
  return Math.abs(ia - ib) === 1;
}

/**
 * Regras (primeira que casar vence):
 *  R1  acerto                              → answered_without_confidence (só entra na triagem se baixa confiança)
 *  R2  erro + confiança alta               → did_not_understand_statement (achava que sabia)
 *  R3  erro + alternativas adjacentes      → did_not_understand_statement (confundiu próximas)
 *  R4  erro + confiança média              → did_not_remember
 *  R5  erro (restante: baixa/chute)        → did_not_know
 */
export function suggestReason(item: TriageItem): ErrorReason {
  const { wasCorrect, confidence, selectedLabel, correctLabel, optionLabels } = item;

  if (wasCorrect) return 'answered_without_confidence';                 // R1
  if (confidence === 'alta') return 'did_not_understand_statement';     // R2
  if (areAdjacent(selectedLabel, correctLabel, optionLabels)) {         // R3
    return 'did_not_understand_statement';
  }
  if (confidence === 'media') return 'did_not_remember';                // R4
  return 'did_not_know';                                                // R5
}
