import type { QueryClient } from '@tanstack/react-query';
import { chamarRpcGestor, GESTOR_STALE_TIME } from '@/features/gestor/api/queries';
import type {
  AlunoSimuladoEntry,
  FiltroSemestre,
  GrupoEvolucao,
  LinhaAluno,
  NoDiagnostico,
  Paginado,
  VisaoGeral,
} from '@/features/gestor/api/types';

/**
 * Recurso canônico da Visão Geral na queryKey do portal: 'visao-geral'.
 * Bate com a tupla que `useVisaoGeral` observa via `useEnvelope` em
 * `api/queries.ts` — que insere o `user.id` logo após o namespace `'gestor'`
 * (card 107 da revisão de 03/08: `[namespace, user?.id, ...resto]`). Por
 * isso `userId` é o PRIMEIRO parâmetro aqui, não um acréscimo no final — se
 * a posição divergir, o prefetch aquece um cache que a tela nunca lê (achado
 * 1 da revisão de 03/08).
 */
export const visaoGeralQueryKey = (
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
) => ['gestor', userId, 'visao-geral', iesId, semestre] as const;

/**
 * Aquece a Visão Geral antes do clique (handoff docs/08 §Prefetch), reusando
 * `chamarRpcGestor` — a mesma função que `useVisaoGeral` chama por dentro —
 * em vez de duplicar a chamada de RPC e o cast do envelope.
 *
 * `userId` deve ser o `user?.id` do `useAuth()` de quem chama (o mesmo valor
 * que `useEnvelope` lê internamente), para a chave aquecida aqui bater com a
 * que `useVisaoGeral` vai observar na tela seguinte.
 */
export function prefetchVisaoGeral(
  queryClient: QueryClient,
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: visaoGeralQueryKey(userId, iesId, semestre),
    queryFn: () =>
      chamarRpcGestor<VisaoGeral>('get_gestor_visao_geral', {
        p_ies_id: iesId,
        p_semestre: semestre,
      }),
    staleTime: GESTOR_STALE_TIME,
  });
}

/**
 * Mesma ordenação de `ordenados` em `api/queries.ts` (não exportada de lá):
 * `useAluno` ordena a lista de simulados ANTES de colocá-la na queryKey, para
 * que `[a, b]` e `[b, a]` (mesmo conjunto, ordem de seleção diferente na UI)
 * caiam no MESMO cache. Duplicado aqui — em vez de importado — porque
 * `queries.ts` não exporta o helper e este arquivo já documenta (ver
 * `prefetchVisaoGeral` acima) que prefetch nunca passa por `useEnvelope`;
 * qualquer divergência entre as duas cópias quebraria a queryKey, e é
 * exatamente o que os testes deste arquivo travam.
 */
const ordenados = (ids: string[]): string[] => [...ids].sort();

/**
 * QueryKey de `useAluno` (`api/queries.ts`), na forma final que `useEnvelope`
 * produz: `userId` logo após o namespace `'gestor'` (mesmo card 107 de
 * `visaoGeralQueryKey`), com `lista` já ordenada.
 */
export const alunoQueryKey = (
  userId: string | undefined,
  iesId: string | null,
  alunoId: string,
  simulados: string[],
) => ['gestor', userId, 'aluno', iesId, alunoId, ordenados(simulados)] as const;

/**
 * Aquece a ficha do aluno (`get_gestor_aluno`) antes do clique — gatilho da
 * Parte VIII/§22 do handoff: "hover na linha de aluno... prefetch do
 * detalhe". Reusa `chamarRpcGestor` direto, sem `useEnvelope` (prefetch roda
 * fora de um componente React, em `onMouseEnter`).
 *
 * `manterDadoAnterior` não existe aqui porque prefetch não lê `data` nenhum
 * — só popula o cache que `useAluno` vai observar depois. O
 * `placeholderData`/`isPlaceholderData` de `useAluno` continuam sendo
 * decisão exclusiva daquele hook (`manterDadoAnterior = false`, porque
 * `alunoId` identifica o objeto exibido — ver comentário em `api/queries.ts`).
 */
export function prefetchAluno(
  queryClient: QueryClient,
  userId: string | undefined,
  iesId: string | null,
  alunoId: string,
  simulados: string[],
): Promise<void> {
  const lista = ordenados(simulados);
  return queryClient.prefetchQuery({
    queryKey: alunoQueryKey(userId, iesId, alunoId, simulados),
    queryFn: () =>
      chamarRpcGestor<AlunoSimuladoEntry[]>('get_gestor_aluno', {
        p_ies_id: iesId,
        p_aluno_id: alunoId,
        p_simulados: lista,
      }),
    staleTime: GESTOR_STALE_TIME,
  });
}

/**
 * QueryKey de `useDiagnostico` (`api/queries.ts`), na forma final que
 * `useEnvelope` produz.
 */
export const diagnosticoQueryKey = (
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
  node: string | null,
) => ['gestor', userId, 'diagnostico', iesId, semestre, node] as const;

/**
 * Aquece o próximo nível da cascata do Diagnóstico (`get_gestor_diagnostico`)
 * no hover do nó — gatilho "hover no nó da cascata → prefetch do próximo
 * nível" (Parte VIII/§22). `node` é o id do nó sobre o qual o mouse está,
 * exatamente o `p_node` que `useDiagnostico` envia ao expandir aquele nó.
 */
export function prefetchDiagnosticoNivel(
  queryClient: QueryClient,
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
  node: string | null,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: diagnosticoQueryKey(userId, iesId, semestre, node),
    queryFn: () =>
      chamarRpcGestor<NoDiagnostico[]>('get_gestor_diagnostico', {
        p_ies_id: iesId,
        p_semestre: semestre,
        p_node: node,
      }),
    staleTime: GESTOR_STALE_TIME,
  });
}

/**
 * QueryKey de `useAlunos` (`api/queries.ts`), na forma final que
 * `useEnvelope` produz — mesma ordem de campos de paginação/ordenação que o
 * hook usa (`page, pageSize, sort, order, q, grupo ?? null`).
 */
export const alunosQueryKey = (
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
  pagina: number,
  pageSize: number,
  sort: string | undefined,
  order: 'asc' | 'desc' | undefined,
  q: string | undefined,
  grupo: GrupoEvolucao | null | undefined,
) =>
  ['gestor', userId, 'alunos', iesId, semestre, pagina, pageSize, sort, order, q, grupo ?? null] as const;

/**
 * Aquece a próxima página da tabela de alunos (`get_gestor_alunos`) no hover
 * do controle de paginação — gatilho "hover na página seguinte da paginação
 * → prefetch daquela página" (Parte VIII/§22). Os oito parâmetros de recorte
 * espelham exatamente os que `useAlunos` envia (`filtros.iesId`,
 * `filtros.semestre`, e cada campo de `PaginacaoGestor`) — a mesma RPC, só
 * que com `p_page` apontando para a página seguinte à exibida.
 */
export function prefetchProximaPaginaAlunos(
  queryClient: QueryClient,
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
  pagina: number,
  pageSize: number,
  sort: string | undefined,
  order: 'asc' | 'desc' | undefined,
  q: string | undefined,
  grupo: GrupoEvolucao | null | undefined,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: alunosQueryKey(userId, iesId, semestre, pagina, pageSize, sort, order, q, grupo),
    queryFn: () =>
      chamarRpcGestor<Paginado<LinhaAluno>>('get_gestor_alunos', {
        p_ies_id: iesId,
        p_semestre: semestre,
        p_page: pagina,
        p_page_size: pageSize,
        p_sort: sort,
        p_order: order,
        p_q: q,
        p_grupo: grupo ?? null,
      }),
    staleTime: GESTOR_STALE_TIME,
  });
}
