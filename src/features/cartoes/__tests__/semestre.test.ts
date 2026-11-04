import { describe, expect, it } from 'vitest';
import { nomeDoArquivo } from '../emitir.ts';
import { SEM_SEMESTRE, chaveSemestre, filtrarPorSemestre, semestresDisponiveis, sufixoDeSemestres } from '../semestre.ts';

const ALUNOS = [
  { nome: 'A', semestre: 7 },
  { nome: 'B', semestre: 6 },
  { nome: 'C', semestre: 10 },
  { nome: 'D', semestre: null },
  { nome: 'E' },
  { nome: 'F', semestre: 7 },
];

describe('semestre', () => {
  it('lista os semestres em ordem numérica, com "Sem semestre" por último e a contagem', () => {
    expect(semestresDisponiveis(ALUNOS)).toEqual([
      { chave: '6', rotulo: '6º', qtd: 1 },
      { chave: '7', rotulo: '7º', qtd: 2 },
      { chave: '10', rotulo: '10º', qtd: 1 },
      { chave: SEM_SEMESTRE, rotulo: 'Sem semestre', qtd: 2 },
    ]);
    expect(semestresDisponiveis([])).toEqual([]);
  });

  it('sem filtro devolve todos; com filtro devolve só os escolhidos (um ou vários)', () => {
    expect(filtrarPorSemestre(ALUNOS, new Set())).toBe(ALUNOS);
    expect(filtrarPorSemestre(ALUNOS, new Set(['7'])).map((a) => a.nome)).toEqual(['A', 'F']);
    expect(filtrarPorSemestre(ALUNOS, new Set(['6', '10'])).map((a) => a.nome)).toEqual(['B', 'C']);
    expect(filtrarPorSemestre(ALUNOS, new Set([SEM_SEMESTRE])).map((a) => a.nome)).toEqual(['D', 'E']);
    expect(filtrarPorSemestre(ALUNOS, new Set(['3']))).toEqual([]);
  });

  it('chave: semestre 0 conta como semestre; null e ausente são "sem semestre"', () => {
    expect(chaveSemestre({ semestre: 0 })).toBe('0');
    expect(chaveSemestre({ semestre: null })).toBe(SEM_SEMESTRE);
    expect(chaveSemestre({})).toBe(SEM_SEMESTRE);
  });

  it('sufixo do nome do arquivo', () => {
    expect(sufixoDeSemestres(new Set())).toBe('');
    expect(sufixoDeSemestres(new Set(['10', '6', '7']))).toBe('sem-6-7-10');
    expect(sufixoDeSemestres(new Set(['7', SEM_SEMESTRE]))).toBe('sem-7-sem-info');
    expect(nomeDoArquivo('UVA', '1º Simulado', sufixoDeSemestres(new Set(['6', '7'])))).toBe('cartoes_uva_1o-simulado_sem-6-7.pdf');
    expect(nomeDoArquivo('UVA', '1º Simulado')).toBe('cartoes_uva_1o-simulado.pdf');
  });
});
