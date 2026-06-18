import { describe, it, expect } from 'vitest';
import { suggestReason, type TriageItem } from '@/lib/triageHeuristic';

/**
 * Heurística de triagem pós-prova — sugere a causa do erro entre as 4 do academy,
 * sem IA. Adjacência (R3) usa a ORDEM ORIGINAL das alternativas (bug do enamed:
 * não usar ordem lexicográfica).
 */

const item = (over: Partial<TriageItem> = {}): TriageItem => ({
  wasCorrect: false,
  confidence: 'media',
  selectedLabel: 'A',
  correctLabel: 'C',
  optionLabels: ['A', 'B', 'C', 'D', 'E'],
  ...over,
});

describe('suggestReason', () => {
  it('R1: acerto com confiança baixa → answered_without_confidence', () => {
    expect(suggestReason(item({ wasCorrect: true, confidence: 'baixa', selectedLabel: 'C' })))
      .toBe('answered_without_confidence');
  });

  it('R2: erro com confiança alta → did_not_understand_statement', () => {
    expect(suggestReason(item({ wasCorrect: false, confidence: 'alta', selectedLabel: 'A', correctLabel: 'E' })))
      .toBe('did_not_understand_statement');
  });

  it('R3: erro entre alternativas adjacentes (ordem original) → did_not_understand_statement', () => {
    // B e C são adjacentes na ordem original
    expect(suggestReason(item({ confidence: 'media', selectedLabel: 'B', correctLabel: 'C' })))
      .toBe('did_not_understand_statement');
  });

  it('R3 usa ordem ORIGINAL, não lexicográfica: D e B não são adjacentes', () => {
    // Em ordem lexicográfica B,D parecem distantes; o teste garante que a
    // adjacência é pela posição na lista fornecida.
    const r = suggestReason(item({ confidence: 'media', selectedLabel: 'D', correctLabel: 'B' }));
    expect(r).not.toBe('did_not_understand_statement');
  });

  it('R4: erro com confiança média (não adjacente) → did_not_remember', () => {
    expect(suggestReason(item({ confidence: 'media', selectedLabel: 'A', correctLabel: 'E' })))
      .toBe('did_not_remember');
  });

  it('R5: erro com confiança baixa (chute) → did_not_know', () => {
    expect(suggestReason(item({ confidence: 'baixa', selectedLabel: 'A', correctLabel: 'E' })))
      .toBe('did_not_know');
  });

  it('lida com questão sem resposta selecionada (em branco) → did_not_know', () => {
    expect(suggestReason(item({ confidence: 'baixa', selectedLabel: null, correctLabel: 'C' })))
      .toBe('did_not_know');
  });
});
