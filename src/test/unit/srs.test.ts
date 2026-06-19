import { describe, it, expect } from 'vitest';
import { computeNextReview, type SrsState } from '@/lib/srs';

/**
 * SM-2-lite engine — ported from enamed-arena (docs/specs/02-srs-engine.md),
 * adapted to the academy's 4 error reasons.
 *
 * Reason → initial ease / interval ladder:
 *   did_not_know                  → 2.1 (lacuna),    standard ladder (1, 4, ...)
 *   did_not_remember              → 2.5 (memória),   standard ladder (1, 4, ...)
 *   did_not_understand_statement  → 2.8 (atenção),   atenção ladder  (2, 6, ...)
 *   answered_without_confidence   → 2.1 (chute),     standard ladder + chute promotion
 */

const base = (over: Partial<SrsState> = {}): SrsState => ({
  srsEase: 2.5,
  srsInterval: 1,
  srsReps: 0,
  srsLapses: 0,
  reason: 'did_not_remember',
  lastTwoConfidences: [],
  ...over,
});

describe('computeNextReview — first review (standard reason)', () => {
  it('first "bom" on did_not_remember: reps 0→1, interval 1, ease unchanged (2.5)', () => {
    const r = computeNextReview(base(), { outcome: 'bom', confidence: 'media' });
    expect(r.srsReps).toBe(1);
    expect(r.srsInterval).toBe(1);
    expect(r.srsEase).toBeCloseTo(2.5, 5);
    expect(r.mastered).toBe(false);
    expect(r.isLeech).toBe(false);
  });

  it('first "bom" on did_not_know uses lacuna ease 2.1 (first-ever sentinel)', () => {
    const r = computeNextReview(base({ reason: 'did_not_know' }), { outcome: 'bom', confidence: 'media' });
    expect(r.srsEase).toBeCloseTo(2.1, 5);
    expect(r.srsInterval).toBe(1);
  });
});

describe('computeNextReview — atenção ladder', () => {
  it('did_not_understand_statement: reps1 interval 2, reps2 interval 6, ease base 2.8', () => {
    const first = computeNextReview(
      base({ reason: 'did_not_understand_statement' }),
      { outcome: 'bom', confidence: 'media' },
    );
    expect(first.srsEase).toBeCloseTo(2.8, 5);
    expect(first.srsInterval).toBe(2);

    const second = computeNextReview(
      base({ reason: 'did_not_understand_statement', srsEase: 2.8, srsReps: 1, srsInterval: 2 }),
      { outcome: 'bom', confidence: 'media' },
    );
    expect(second.srsReps).toBe(2);
    expect(second.srsInterval).toBe(6);
  });
});

describe('computeNextReview — facil ease bump', () => {
  it('"facil" raises ease by 0.1; interval = round(interval * ease)', () => {
    const r = computeNextReview(
      base({ srsEase: 2.5, srsInterval: 4, srsReps: 2, lastTwoConfidences: ['alta'] }),
      { outcome: 'facil', confidence: 'alta' },
    );
    expect(r.srsReps).toBe(3);
    expect(r.srsEase).toBeCloseTo(2.6, 5);
    expect(r.srsInterval).toBe(10); // round(4 * 2.6)
    expect(r.mastered).toBe(false); // interval 10 < 21
  });
});

describe('computeNextReview — lapse path', () => {
  it('"errei" resets reps, increments lapses, penalises ease and interval', () => {
    const r = computeNextReview(
      base({ srsEase: 2.5, srsInterval: 10, srsReps: 2, srsLapses: 0 }),
      { outcome: 'errei', confidence: 'media' },
    );
    expect(r.srsReps).toBe(0);
    expect(r.srsLapses).toBe(1);
    expect(r.srsEase).toBeCloseTo(2.3, 5);   // 2.5 - 0.2
    expect(r.srsInterval).toBe(2);            // max(1, round(10 * 0.2))
    expect(r.mastered).toBe(false);
  });

  it('ease never drops below 1.3 on repeated lapses', () => {
    const r = computeNextReview(
      base({ srsEase: 1.4, srsInterval: 1, srsReps: 0, srsLapses: 1 }),
      { outcome: 'errei', confidence: 'media' },
    );
    expect(r.srsEase).toBeCloseTo(1.3, 5); // clamp at min, not 1.2
  });
});

describe('computeNextReview — confidence baixa override', () => {
  it('confidence "baixa" caps quality at 2 (dificil) even when self-grade is facil', () => {
    const r = computeNextReview(
      base({ srsEase: 2.5, srsInterval: 1, srsReps: 0 }),
      { outcome: 'facil', confidence: 'baixa' },
    );
    // q forced to 2: delta = 0.1 - 2*(0.08 + 0.04) = -0.14
    expect(r.srsEase).toBeCloseTo(2.36, 5);
    expect(r.srsReps).toBe(1);
  });
});

describe('computeNextReview — leech detection', () => {
  it('flags leech when lapses reach the threshold of 4', () => {
    const r = computeNextReview(
      base({ srsEase: 1.5, srsInterval: 5, srsReps: 1, srsLapses: 3 }),
      { outcome: 'errei', confidence: 'media' },
    );
    expect(r.srsLapses).toBe(4);
    expect(r.isLeech).toBe(true);
  });
});

describe('computeNextReview — mastery', () => {
  it('masters when reps≥3, interval≥21, outcome bom/facil, last two confidences ≥ media, no lapses', () => {
    const r = computeNextReview(
      base({ srsEase: 2.5, srsInterval: 15, srsReps: 2, srsLapses: 0, lastTwoConfidences: ['alta'] }),
      { outcome: 'bom', confidence: 'alta' },
    );
    expect(r.srsReps).toBe(3);
    expect(r.srsInterval).toBe(38); // round(15 * 2.5)
    expect(r.mastered).toBe(true);
  });

  it('does NOT master with a recent lapse in the streak', () => {
    const r = computeNextReview(
      base({ srsEase: 2.5, srsInterval: 15, srsReps: 2, srsLapses: 1, lastTwoConfidences: ['alta'] }),
      { outcome: 'bom', confidence: 'alta' },
    );
    expect(r.mastered).toBe(false);
  });

  it('does NOT master when last confidence is baixa', () => {
    const r = computeNextReview(
      base({ srsEase: 2.5, srsInterval: 15, srsReps: 2, srsLapses: 0, lastTwoConfidences: ['baixa'] }),
      { outcome: 'bom', confidence: 'alta' },
    );
    expect(r.mastered).toBe(false);
  });
});

describe('computeNextReview — chute promotion (answered_without_confidence)', () => {
  it('boosts ease to 2.5 when reps≥2 and last two confidences ≥ media', () => {
    const r = computeNextReview(
      base({ reason: 'answered_without_confidence', srsEase: 2.1, srsInterval: 4, srsReps: 1, lastTwoConfidences: ['media'] }),
      { outcome: 'bom', confidence: 'alta' },
    );
    expect(r.srsReps).toBe(2);
    expect(r.srsEase).toBeCloseTo(2.5, 5); // promoted from 2.1
    expect(r.srsInterval).toBe(4);          // standard reps2 ladder
  });

  it('does NOT promote when a prior confidence was baixa', () => {
    const r = computeNextReview(
      base({ reason: 'answered_without_confidence', srsEase: 2.1, srsInterval: 4, srsReps: 1, lastTwoConfidences: ['baixa'] }),
      { outcome: 'bom', confidence: 'alta' },
    );
    expect(r.srsEase).toBeCloseTo(2.1, 5); // q=3 delta 0, no promotion
  });
});
