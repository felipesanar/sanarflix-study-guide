/** Returns 0 if value is NaN, undefined, null, or not a finite number */
export function safeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Formats a percentage safely, returning "0%" for invalid values */
export function safePercent(value: unknown, decimals = 1): string {
  const n = safeNumber(value);
  return `${n.toFixed(decimals)}%`;
}
