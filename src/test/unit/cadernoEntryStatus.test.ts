import { describe, it, expect } from 'vitest';
import { cadernoEntryStatus, easeForReason, type EntryStatusInput } from '@/lib/cadernoEntryStatus';

const NOW = Date.parse('2026-06-19T12:00:00Z');
const past = '2026-06-18T12:00:00Z';
const future = '2026-06-25T12:00:00Z';

const base = (over: Partial<EntryStatusInput> = {}): EntryStatusInput => ({
  srs_due_at: past,
  mastered_at: null,
  srs_lapses: 0,
  last_review_outcome: null,
  ...over,
});

describe('cadernoEntryStatus', () => {
  it('mastered tem prioridade máxima', () => {
    expect(cadernoEntryStatus(base({ mastered_at: past, srs_due_at: past }), NOW)).toBe('mastered');
  });

  it('leech quando lapses >= 4', () => {
    expect(cadernoEntryStatus(base({ srs_lapses: 4 }), NOW)).toBe('leech');
  });

  it('leech quando last_review_outcome = leech_blocked', () => {
    expect(cadernoEntryStatus(base({ last_review_outcome: 'leech_blocked' }), NOW)).toBe('leech');
  });

  it('awaiting_lesson quando bloqueado por lição', () => {
    expect(cadernoEntryStatus(base({ last_review_outcome: 'awaiting_lesson' }), NOW)).toBe('awaiting_lesson');
  });

  it('due quando srs_due_at <= agora', () => {
    expect(cadernoEntryStatus(base({ srs_due_at: past }), NOW)).toBe('due');
  });

  it('due quando srs_due_at é null (nunca agendado)', () => {
    expect(cadernoEntryStatus(base({ srs_due_at: null }), NOW)).toBe('due');
  });

  it('scheduled quando due no futuro', () => {
    expect(cadernoEntryStatus(base({ srs_due_at: future }), NOW)).toBe('scheduled');
  });
});

describe('easeForReason', () => {
  it('mapeia as 4 causas do academy', () => {
    expect(easeForReason('did_not_know')).toBeCloseTo(2.1, 5);
    expect(easeForReason('answered_without_confidence')).toBeCloseTo(2.1, 5);
    expect(easeForReason('did_not_understand_statement')).toBeCloseTo(2.8, 5);
    expect(easeForReason('did_not_remember')).toBeCloseTo(2.5, 5);
  });
});
