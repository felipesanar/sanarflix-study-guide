/**
 * SM-2-lite reference implementation — Caderno de Erros (SanarFlix Academy)
 *
 * Ported from enamed-arena (docs/specs/02-srs-engine.md), adapted to the
 * academy's 4 error reasons. Pure-TypeScript mirror of the
 * `schedule_next_review_guarded` SQL RPC.
 *
 * IMPORTANT: at runtime the SQL RPC is the source of truth. This module
 * replicates its logic for (1) unit tests / spec validation and (2) client-side
 * "preview next review" hints. Any divergence between this file and the RPC is a
 * bug — fix both.
 *
 * Plan: docs/caderno-de-erros-port-plan.md · SQL: docs/caderno-de-erros-port-sql.md
 */

export type SrsOutcome = 'errei' | 'dificil' | 'bom' | 'facil';
export type SrsConfidence = 'baixa' | 'media' | 'alta';

/** The 4 error reasons used by the academy's error notebook. */
export type SrsReason =
  | 'did_not_know'
  | 'did_not_remember'
  | 'did_not_understand_statement'
  | 'answered_without_confidence';

/** SRS state fields stored in `error_notebook_entries`. */
export interface SrsState {
  srsEase: number;       // float, default 2.5
  srsInterval: number;   // int, days
  srsReps: number;       // int, consecutive successful reviews
  srsLapses: number;     // int, accumulated lapses
  reason: SrsReason;
  /**
   * The last two review confidences, most-recent first, from `review_attempts`.
   * Used for the mastery check and chute promotion. Pass [] when none exist.
   */
  lastTwoConfidences?: SrsConfidence[];
}

export interface SrsReviewInput {
  outcome: SrsOutcome;
  confidence: SrsConfidence;
}

export interface SrsResult {
  srsEase: number;
  srsInterval: number;
  srsReps: number;
  srsLapses: number;
  /** Relative interval is `srsInterval` days; caller sets due_at = now + interval. */
  mastered: boolean;
  isLeech: boolean;
}

// ---------------------------------------------------------------------------
// Constants (mirror docs/caderno-de-erros-port-sql.md)
// ---------------------------------------------------------------------------

const EASE_DEFAULT = 2.5;   // did_not_remember (memória)
const EASE_LACUNA = 2.1;    // did_not_know + answered_without_confidence (chute)
const EASE_ATENCAO = 2.8;   // did_not_understand_statement
const EASE_MIN = 1.3;
const EASE_MAX = 3.5;

const LAPSE_INTERVAL_FACTOR = 0.2;
const LAPSE_EASE_PENALTY = 0.2;

const INTERVAL_REPS_1 = 1;          // standard ladder
const INTERVAL_REPS_2 = 4;
const INTERVAL_ATENCAO_REPS_1 = 2;  // did_not_understand_statement ladder
const INTERVAL_ATENCAO_REPS_2 = 6;
const INTERVAL_MAX = 365;

const LEECH_THRESHOLD = 4;
const MASTERY_MIN_REPS = 3;
const MASTERY_MIN_INTERVAL = 21;
const CHUTE_PROMOTION_REPS = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outcomeToQuality(outcome: SrsOutcome): number {
  switch (outcome) {
    case 'errei':   return 0;
    case 'dificil': return 2;
    case 'bom':     return 3;
    case 'facil':   return 4;
  }
}

/** Ease base when reps = 0 (first-ever review) — modulated by reason. */
function initialEaseForReason(reason: SrsReason): number {
  switch (reason) {
    case 'did_not_know':
    case 'answered_without_confidence':
      return EASE_LACUNA;   // 2.1
    case 'did_not_understand_statement':
      return EASE_ATENCAO;  // 2.8
    case 'did_not_remember':
    default:
      return EASE_DEFAULT;  // 2.5
  }
}

/** Round half-up, matching SQL ROUND(). */
function sqlRound(x: number): number {
  return Math.round(x);
}

function clampEase(value: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, value));
}

const confidenceOk = (c: SrsConfidence) => c === 'media' || c === 'alta';

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Computes the next SRS state given the current state and a review event.
 * Mirrors `schedule_next_review_guarded`.
 */
export function computeNextReview(state: SrsState, review: SrsReviewInput): SrsResult {
  const { outcome, confidence } = review;
  const { srsEase, srsInterval, srsReps, srsLapses, reason, lastTwoConfidences = [] } = state;

  // Step 1: resolve ease base. For a brand-new entry (never reviewed and ease
  // still at the DB default 2.5), apply the reason-specific initial ease.
  // After any review/lapse, srsEase already holds the live value.
  const isFirstEverReview = srsReps === 0 && srsEase === EASE_DEFAULT;
  const easeBase = isFirstEverReview ? initialEaseForReason(reason) : srsEase;

  // Step 2: outcome → quality; low-confidence override caps quality at 2.
  let q = outcomeToQuality(outcome);
  if (confidence === 'baixa' && q > 2) q = 2;

  const isAtencao = reason === 'did_not_understand_statement';

  let newReps: number;
  let newLapses: number;
  let newEase: number;
  let newInterval: number;

  if (q === 0) {
    // Lapse path
    newReps = 0;
    newLapses = srsLapses + 1;
    newEase = clampEase(easeBase - LAPSE_EASE_PENALTY);
    newInterval = Math.max(1, sqlRound(srsInterval * LAPSE_INTERVAL_FACTOR));
  } else {
    // Success path
    newReps = srsReps + 1;
    newLapses = srsLapses;

    const deltaEase = 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02);
    newEase = clampEase(easeBase + deltaEase);

    if (isAtencao) {
      newInterval =
        newReps === 1 ? INTERVAL_ATENCAO_REPS_1
        : newReps === 2 ? INTERVAL_ATENCAO_REPS_2
        : sqlRound(srsInterval * newEase);
    } else {
      newInterval =
        newReps === 1 ? INTERVAL_REPS_1
        : newReps === 2 ? INTERVAL_REPS_2
        : sqlRound(srsInterval * newEase);
    }
    newInterval = Math.min(INTERVAL_MAX, Math.max(1, newInterval));

    // Step 4: chute promotion — answered_without_confidence answered confidently twice.
    if (reason === 'answered_without_confidence' && newReps >= CHUTE_PROMOTION_REPS) {
      const prevOk = lastTwoConfidences.length >= 1 && confidenceOk(lastTwoConfidences[0]);
      if (confidenceOk(confidence) && prevOk && newEase < EASE_DEFAULT) {
        newEase = EASE_DEFAULT;
      }
    }
  }

  // Step 5: leech
  const isLeech = newLapses >= LEECH_THRESHOLD;

  // Step 6: mastery (success only, not leech-blocked)
  let mastered = false;
  if (q > 0 && !isLeech) {
    const condA = newReps >= MASTERY_MIN_REPS;
    const condB = srsLapses === 0;                       // no lapse in current streak
    const condC = confidenceOk(confidence);              // current review
    const condD = lastTwoConfidences.length >= 1 && confidenceOk(lastTwoConfidences[0]);
    const condE = newInterval >= MASTERY_MIN_INTERVAL;
    const condF = outcome === 'bom' || outcome === 'facil';
    mastered = condA && condB && condC && condD && condE && condF;
  }

  return { srsEase: newEase, srsInterval: newInterval, srsReps: newReps, srsLapses: newLapses, mastered, isLeech };
}
