import { describe, it, expect } from 'vitest';
import {
  IES_COM_BLOQUEIO_POR_SAIDA,
  LIMITE_SAIDAS_DE_ABA,
  iesTemBloqueioPorSaida,
  deveBloquearPorSaidas,
} from '@/config/antiCola';

const CLARETIANO_ID = IES_COM_BLOQUEIO_POR_SAIDA[0];
const OUTRA_IES_ID = 'ies-sem-regra-estrita';

describe('config/antiCola', () => {
  describe('iesTemBloqueioPorSaida', () => {
    it('retorna true para a IES com regra estrita (Claretiano)', () => {
      expect(iesTemBloqueioPorSaida(CLARETIANO_ID)).toBe(true);
    });

    it('retorna false para outra IES', () => {
      expect(iesTemBloqueioPorSaida(OUTRA_IES_ID)).toBe(false);
    });

    it('retorna false para undefined/null/vazio', () => {
      expect(iesTemBloqueioPorSaida(undefined)).toBe(false);
      expect(iesTemBloqueioPorSaida(null)).toBe(false);
      expect(iesTemBloqueioPorSaida('')).toBe(false);
    });
  });

  describe('deveBloquearPorSaidas', () => {
    it('IES do Claretiano com 0 saídas: não bloqueia', () => {
      expect(deveBloquearPorSaidas(CLARETIANO_ID, 0)).toBe(false);
    });

    it('IES do Claretiano com 1 saída (limite tolerado): não bloqueia', () => {
      expect(deveBloquearPorSaidas(CLARETIANO_ID, LIMITE_SAIDAS_DE_ABA)).toBe(false);
      expect(deveBloquearPorSaidas(CLARETIANO_ID, 1)).toBe(false);
    });

    it('IES do Claretiano com 2 saídas (acima do limite): bloqueia', () => {
      expect(deveBloquearPorSaidas(CLARETIANO_ID, 2)).toBe(true);
    });

    it('outra IES com 5 saídas: nunca bloqueia', () => {
      expect(deveBloquearPorSaidas(OUTRA_IES_ID, 5)).toBe(false);
    });

    it('undefined/null: nunca bloqueia, mesmo com muitas saídas', () => {
      expect(deveBloquearPorSaidas(undefined, 10)).toBe(false);
      expect(deveBloquearPorSaidas(null, 10)).toBe(false);
    });
  });
});
