import { describe, it, expect } from 'vitest';
import { maskPhone, onlyDigits, isValidBrPhone, whatsappLink } from '@/utils/phone';

describe('phone utils', () => {
  it('mascara celular e fixo', () => {
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskPhone('')).toBe('');
  });

  it('onlyDigits limpa a máscara', () => {
    expect(onlyDigits('(11) 98765-4321')).toBe('11987654321');
  });

  it('valida DDD + 8 ou 9 dígitos', () => {
    expect(isValidBrPhone('11987654321')).toBe(true);
    expect(isValidBrPhone('1133334444')).toBe(true);
    expect(isValidBrPhone('119876543')).toBe(false);
  });

  describe('whatsappLink', () => {
    it('prefixa 55 em número BR sem DDI', () => {
      expect(whatsappLink('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
      expect(whatsappLink('1133334444')).toBe('https://wa.me/551133334444');
    });

    it('respeita número que já vem com o 55', () => {
      expect(whatsappLink('+55 11 98765-4321')).toBe('https://wa.me/5511987654321');
      expect(whatsappLink('551133334444')).toBe('https://wa.me/551133334444');
    });

    it('devolve null quando não há número discável', () => {
      expect(whatsappLink(null)).toBeNull();
      expect(whatsappLink(undefined)).toBeNull();
      expect(whatsappLink('')).toBeNull();
      expect(whatsappLink('98765')).toBeNull();
    });
  });
});
