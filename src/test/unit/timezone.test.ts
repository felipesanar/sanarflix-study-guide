import { describe, it, expect, vi, afterEach } from 'vitest';
import { getBrazilDayOfWeek, getBrazilDate } from '@/utils/timezone';

describe('utils/timezone', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getBrazilDayOfWeek', () => {
    it('retorna o dia correto em horário neutro (12h BRT)', () => {
      // 2026-05-26 é uma terça-feira (dia 2 — Sun=0)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-26T15:00:00Z')); // 12:00 BRT
      expect(getBrazilDayOfWeek()).toBe(2);
    });

    it('respeita América/São_Paulo em horário-limite UTC (regressão bug timezone)', () => {
      // Antes o bug: às 21h UTC do domingo (= 18h BRT domingo), getDay() em UTC
      // já considerava segunda-feira para algumas localidades. Confirma BRT.
      vi.useFakeTimers();
      // Domingo 24/05/2026 23:00 BRT (= 26/05 02:00 UTC) — ainda domingo no BRT
      vi.setSystemTime(new Date('2026-05-25T02:00:00Z'));
      expect(getBrazilDayOfWeek()).toBe(0); // Domingo
    });

    it('retorna número entre 0 e 6', () => {
      const day = getBrazilDayOfWeek();
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(6);
    });
  });

  describe('getBrazilDate', () => {
    it('retorna Date válido', () => {
      const d = getBrazilDate();
      expect(d).toBeInstanceOf(Date);
      expect(Number.isFinite(d.getTime())).toBe(true);
    });
  });
});
