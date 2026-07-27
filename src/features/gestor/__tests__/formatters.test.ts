import { describe, it, expect } from 'vitest';
import {
  TRACO,
  formatPct,
  formatNumero,
  formatConceito,
  formatData,
  formatDelta,
} from '@/features/gestor/lib/formatters';

describe('TRACO', () => {
  it('é o em-dash, não hífen nem "N/A"', () => {
    expect(TRACO).toBe('—');
  });
});

describe('formatPct (spec §4.10 — null nunca vira 0%)', () => {
  it('null devolve TRACO', () => {
    expect(formatPct(null)).toBe(TRACO);
  });

  it('zero é zero, NÃO é TRACO', () => {
    expect(formatPct(0)).toBe('0%');
  });

  it('sem decimais por padrão, com % colado', () => {
    expect(formatPct(60)).toBe('60%');
    expect(formatPct(100)).toBe('100%');
  });

  it('arredonda para inteiro por padrão', () => {
    expect(formatPct(58.6)).toBe('59%');
    expect(formatPct(58.4)).toBe('58%');
  });

  it('respeita o número de decimais pedido, com vírgula pt-BR', () => {
    expect(formatPct(12.5, 1)).toBe('12,5%');
    expect(formatPct(60, 1)).toBe('60,0%');
    expect(formatPct(7.25, 2)).toBe('7,25%');
  });
});

describe('formatNumero', () => {
  it('null devolve TRACO', () => {
    expect(formatNumero(null)).toBe(TRACO);
  });

  it('zero é zero', () => {
    expect(formatNumero(0)).toBe('0');
  });

  it('usa separador de milhar pt-BR', () => {
    expect(formatNumero(1234)).toBe('1.234');
    expect(formatNumero(1234567)).toBe('1.234.567');
  });

  it('preserva decimal com vírgula', () => {
    expect(formatNumero(1234.5)).toBe('1.234,5');
  });
});

describe('formatConceito (spec §4.1 — escala 1 a 5, nunca média)', () => {
  it('null devolve TRACO', () => {
    expect(formatConceito(null)).toBe(TRACO);
  });

  it('devolve N/5', () => {
    expect(formatConceito(3)).toBe('3/5');
    expect(formatConceito(1)).toBe('1/5');
    expect(formatConceito(5)).toBe('5/5');
  });
});

describe('formatData', () => {
  it('null devolve TRACO', () => {
    expect(formatData(null)).toBe(TRACO);
  });

  it('formata date em dd/MM/yyyy', () => {
    expect(formatData('2026-07-24')).toBe('24/07/2026');
    expect(formatData('2026-01-05')).toBe('05/01/2026');
  });

  it('formata timestamptz usando a data que o servidor mandou, sem deslocar por fuso', () => {
    expect(formatData('2026-07-24T03:00:00+00:00')).toBe('24/07/2026');
    expect(formatData('2026-07-24T23:59:00Z')).toBe('24/07/2026');
  });

  it('string inválida devolve TRACO em vez de "Invalid Date"', () => {
    expect(formatData('')).toBe(TRACO);
    expect(formatData('nao-e-data')).toBe(TRACO);
  });
});

describe('formatDelta (régua 1º · anterior · atual, spec §4.8)', () => {
  it('null devolve TRACO', () => {
    expect(formatDelta(null)).toBe(TRACO);
  });

  it('positivo ganha sinal explícito', () => {
    expect(formatDelta(3)).toBe('+3');
    expect(formatDelta(2.5)).toBe('+2,5');
  });

  it('negativo mantém o sinal', () => {
    expect(formatDelta(-2)).toBe('-2');
    expect(formatDelta(-2.5)).toBe('-2,5');
  });

  it('zero é "0", sem sinal', () => {
    expect(formatDelta(0)).toBe('0');
  });
});
