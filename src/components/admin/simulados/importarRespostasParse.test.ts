import { describe, it, expect } from 'vitest';
import { isRespostaValida, parseMatrizRespostas } from '@/components/admin/simulados/importar-respostas-types';

describe('isRespostaValida', () => {
  it.each(['A', 'a', '(A,B)', 'A/D', ' c '])('aceita %s', (v) => expect(isRespostaValida(v)).toBe(true));
  it.each(['BLANK', 'EM BRANCO', 'BRANCO', 'X', '*', '-', '1', ''])('rejeita %s', (v) => expect(isRespostaValida(v)).toBe(false));
});

describe('parseMatrizRespostas', () => {
  it('lê por posição ignorando nomes de cabeçalho e trata texto como branco', () => {
    const m = [
      ['RA', 'Questão 1', 'Q2', 'questao 3', null],
      ['123', 'A', 'BLANK', '(A/D)', null],
    ];
    const r = parseMatrizRespostas(m, 3);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toEqual({ rowIndex: 2, matricula_ra: '123', answers: { '1': 'A', '2': null, '3': '(A/D)' } });
    expect(r.textAsBlank).toBe(1);
  });

  it('recusa quantidade de colunas diferente', () => {
    const r = parseMatrizRespostas([['RA', 'Q1'], ['1', 'A']], 3);
    expect(r.ok).toBe(false);
  });
});
