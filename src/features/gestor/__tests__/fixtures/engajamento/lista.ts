import type { CategoriaLista, LinhaListaEngajamento, ListaEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_gestor_engajamento_lista` (spec §8.3). Só as chaves que a RPC
 * emite: `categoria`, `data[]` (id, nome, semestre, ultimaAtividade,
 * diasSemAtividade, diasAtivos30, melhorMes, melhorMesDias, detalhe), `page`,
 * `pageSize`, `total` e `totalPages`.
 */

export const linhaLista = (extra: Partial<LinhaListaEngajamento> = {}): LinhaListaEngajamento => ({
  id: 'u-1',
  nome: 'Ana Clara Ribeiro',
  semestre: 8,
  ultimaAtividade: '2026-10-19',
  diasSemAtividade: 3,
  diasAtivos30: 9,
  diasAtivosMes: 6,
  melhorMes: '2026-09',
  melhorMesDias: 18,
  detalhe: { dia: '2026-10-19', tipo: 'questoes', especialidade: 'Cardiologia' },
  ...extra,
});

export function listaEngajamento(
  categoria: CategoriaLista,
  linhas: LinhaListaEngajamento[],
  extra: Partial<Omit<ListaEngajamento, 'categoria' | 'data'>> = {},
): ListaEngajamento {
  const pageSize = extra.pageSize ?? 20;
  const total = extra.total ?? linhas.length;
  return {
    categoria,
    data: linhas,
    page: 1,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    ...extra,
  };
}
