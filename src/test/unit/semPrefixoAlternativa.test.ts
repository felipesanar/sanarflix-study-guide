import { describe, it, expect } from 'vitest';
import { semPrefixoAlternativa } from '@/features/mentor/lib/textoSeguro';

describe('semPrefixoAlternativa', () => {
  it('tira "A)" quando bate com o rótulo', () => {
    expect(semPrefixoAlternativa('A) Suspeitar de coledocolitíase', 'A')).toBe('Suspeitar de coledocolitíase');
  });
  it('aceita minúscula e ponto ("a. ")', () => {
    expect(semPrefixoAlternativa('a. Metformina', 'A')).toBe('Metformina');
    expect(semPrefixoAlternativa('A. Metformina', 'a')).toBe('Metformina');
  });
  it('aceita travessão e dois-pontos ("B – ", "B:")', () => {
    expect(semPrefixoAlternativa('B – Insulina', 'B')).toBe('Insulina');
    expect(semPrefixoAlternativa('B- Insulina', 'B')).toBe('Insulina');
    expect(semPrefixoAlternativa('B: Insulina', 'B')).toBe('Insulina');
  });
  it('não mexe em texto sem prefixo', () => {
    expect(semPrefixoAlternativa('Metformina', 'A')).toBe('Metformina');
    expect(semPrefixoAlternativa('Aspirina 100 mg', 'A')).toBe('Aspirina 100 mg');
  });
  it('não tira o prefixo de outra letra', () => {
    expect(semPrefixoAlternativa('B) Insulina', 'A')).toBe('B) Insulina');
  });
  it('tira só uma vez', () => {
    expect(semPrefixoAlternativa('A) A) repetido', 'A')).toBe('A) repetido');
  });
  it('rótulo com caractere especial não quebra a regex', () => {
    expect(semPrefixoAlternativa('(1) texto', '(1')).toBe('texto');
    expect(semPrefixoAlternativa('texto', '.*')).toBe('texto');
  });
  it('null/undefined viram string vazia; rótulo vazio devolve o texto', () => {
    expect(semPrefixoAlternativa(null, 'A')).toBe('');
    expect(semPrefixoAlternativa(undefined, 'A')).toBe('');
    expect(semPrefixoAlternativa('A) x', null)).toBe('A) x');
    expect(semPrefixoAlternativa('A) x', '')).toBe('A) x');
  });
});
