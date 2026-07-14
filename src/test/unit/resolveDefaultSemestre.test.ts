import { describe, it, expect } from 'vitest';
import { resolveDefaultSemestre } from '@/lib/resolveDefaultSemestre';

describe('resolveDefaultSemestre', () => {
  it('seleciona o semestre do próprio aluno quando existe guia para ele', () => {
    const semestres = ['1', '2', '3', '4', '5'];
    expect(resolveDefaultSemestre(semestres, 3)).toBe('3');
  });

  it('aceita o semestre do aluno vindo como string', () => {
    const semestres = ['1', '2', '3'];
    expect(resolveDefaultSemestre(semestres, '2')).toBe('2');
  });

  it('cai para o primeiro semestre disponível quando não há guia do semestre do aluno', () => {
    const semestres = ['1', '2', '3'];
    expect(resolveDefaultSemestre(semestres, 7)).toBe('1');
  });

  it('cai para o primeiro disponível quando o aluno não tem semestre definido', () => {
    const semestres = ['2', '3', '4'];
    expect(resolveDefaultSemestre(semestres, undefined)).toBe('2');
    expect(resolveDefaultSemestre(semestres, null)).toBe('2');
  });

  it('usa INTERNATO como fallback para alunos de 9º-12º sem guia numérico', () => {
    const semestres = ['1', '2', '3', 'INTERNATO'];
    expect(resolveDefaultSemestre(semestres, 10)).toBe('INTERNATO');
  });

  it('prefere o semestre numérico do aluno de 9º-12º quando ele existe', () => {
    const semestres = ['9', '10', 'INTERNATO'];
    expect(resolveDefaultSemestre(semestres, 10)).toBe('10');
  });

  it('cai para o primeiro disponível para 9º-12º quando não há INTERNATO nem numérico', () => {
    const semestres = ['1', '2', '3'];
    expect(resolveDefaultSemestre(semestres, 11)).toBe('1');
  });

  it('casa INTERNATO independente de caixa', () => {
    const semestres = ['1', 'internato'];
    expect(resolveDefaultSemestre(semestres, 9)).toBe('internato');
  });

  it('retorna string vazia quando não há semestres disponíveis', () => {
    expect(resolveDefaultSemestre([], 3)).toBe('');
    expect(resolveDefaultSemestre([], undefined)).toBe('');
  });
});
