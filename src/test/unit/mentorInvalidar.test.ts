import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidarMentor } from '@/services/mentor/invalidar';
import { chavesDesempenho } from '@/services/mentor/desempenho';

describe('invalidarMentor', () => {
  it('invalida todas as queries do mentor, menos o contexto, e não toca em outras', async () => {
    const qc = new QueryClient();
    const mentor = [
      ['mentor', 'turma'],
      ['mentor', 'aluno', 'a@x.com'],
      ['mentor', 'aluno-notas', 'a@x.com'],
      ['mentor', 'mural', 'posts', '', ''],
      ['mentor', 'mural', 'tags'],
      ['mentor', 'sessoes', 'todas'],
      ['mentor', 'agenda-liberacoes', 'm1'],
      ['mentor', 'link-agendamento', 'm1'],
      ['mentor', 'intervencoes', null, null],
      ['mentor', 'desempenho', 'todos'],
      ['mentor', 'detalhamento', ['s1']],
    ];
    const outras = [['gestor', 'turma'], ['user'], ['mentores', 'lista']];
    for (const k of [...mentor, ...outras, ['mentor', 'contexto']]) qc.setQueryData(k, 1);

    await invalidarMentor(qc);

    for (const k of mentor) expect(qc.getQueryState(k)?.isInvalidated, JSON.stringify(k)).toBe(true);
    expect(qc.getQueryState(['mentor', 'contexto'])?.isInvalidated).toBe(false);
    for (const k of outras) expect(qc.getQueryState(k)?.isInvalidated, JSON.stringify(k)).toBe(false);
  });
});

describe('chavesDesempenho.turma', () => {
  it('sem ids ou com lista vazia é a chave "todos"', () => {
    expect(chavesDesempenho.turma()).toEqual(['mentor', 'desempenho', 'todos']);
    expect(chavesDesempenho.turma(null)).toEqual(['mentor', 'desempenho', 'todos']);
    expect(chavesDesempenho.turma([])).toEqual(['mentor', 'desempenho', 'todos']);
  });

  it('ordena os ids e não muta a entrada, então Turma e Detalhamento compartilham a chave', () => {
    const ids = ['s3', 's1', 's2'];
    expect(chavesDesempenho.turma(ids)).toEqual(['mentor', 'desempenho', ['s1', 's2', 's3']]);
    expect(ids).toEqual(['s3', 's1', 's2']);
    expect(chavesDesempenho.turma(['s2', 's1'])).toEqual(chavesDesempenho.turma(['s1', 's2']));
  });
});
