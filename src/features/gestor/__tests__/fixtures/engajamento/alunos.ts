import type { AlunosEngajamento, LinhaAlunoEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_gestor_engajamento_alunos` (spec §8.2), derivada do exemplo:
 * `{"id":"…","nome":"Ana Clara Ribeiro","semestre":12,"questoes":1284,"acertoPct":74.0,
 * "videos":142,"documentos":61,"ultimaAtividade":"2026-10-22","diasSemAtividade":0}`,
 * página 1 de 27 (521 alunos, 20 por página).
 */

export const linhaAluno = (extra: Partial<LinhaAlunoEngajamento> = {}): LinhaAlunoEngajamento => ({
  id: 'aluno-1',
  nome: 'Ana Clara Ribeiro',
  semestre: 12,
  questoes: 1284,
  acertoPct: 74.0,
  videos: 142,
  documentos: 61,
  ultimaAtividade: '2026-10-22',
  diasSemAtividade: 0,
  ...extra,
});

export function alunosEngajamento(
  linhas: LinhaAlunoEngajamento[] = [linhaAluno()],
  extra: Partial<Omit<AlunosEngajamento, 'data'>> = {},
): AlunosEngajamento {
  const pageSize = extra.pageSize ?? 20;
  const total = extra.total ?? 521;
  return {
    data: linhas,
    page: 1,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    ...extra,
  };
}

/** Três alunos que cobrem os alertas da tabela: ok, acerto crítico e sem atividade. */
export const TRES_ALUNOS: LinhaAlunoEngajamento[] = [
  linhaAluno(),
  linhaAluno({ id: 'aluno-2', nome: 'Bruno Alves', semestre: 7, questoes: 900, acertoPct: 41.0, videos: 10, documentos: 3, ultimaAtividade: '2026-10-01', diasSemAtividade: 21 }),
  linhaAluno({ id: 'aluno-3', nome: 'Camila Souza', semestre: 3, questoes: 0, acertoPct: null, videos: 0, documentos: 0, ultimaAtividade: null, diasSemAtividade: null }),
];
