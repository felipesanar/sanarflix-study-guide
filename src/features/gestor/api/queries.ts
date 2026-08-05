import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import type {
  AlunoSimuladoEntry,
  Aviso,
  ContextoGestor,
  Detalhamento,
  Envelope,
  FiltrosGestor,
  ItemCronograma,
  LinhaAluno,
  Meta,
  NoDiagnostico,
  Paginado,
  PaginacaoGestor,
  ProficienciaSimulado,
  Questao,
  TemaCritico,
  VisaoGeral,
} from '@/features/gestor/api/types';

/** Dado do gestor é fresco por 5 minutos (spec §8.2). */
export const GESTOR_STALE_TIME = 5 * 60 * 1000;

type ArgsRpc = Record<string, unknown>;

/**
 * Chama uma RPC `get_gestor_*` e devolve o envelope `{ data, meta }`.
 *
 * As RPCs novas ainda não estão nos tipos gerados do Supabase — cast local
 * documentado, mesmo padrão de `src/hooks/useEffectiveFeatures.ts`.
 */
export async function chamarRpcGestor<T>(fn: string, args?: ArgsRpc): Promise<Envelope<T>> {
  const { data, error } = await (supabase.rpc as (
    fn: string,
    args?: ArgsRpc,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(fn, args);

  if (error) throw new Error(`${fn}: ${error.message}`);
  if (data == null) throw new Error(`${fn}: resposta vazia`);
  return data as Envelope<T>;
}

/** Resultado padrão de todo hook do portal: envelope desembrulhado. */
export interface ResultadoGestor<T> {
  data: T | undefined;
  meta: Meta | undefined;
  isLoading: boolean;
  isError: boolean;
  /**
   * `true` quando `data`/`meta` são o dado do recorte ANTERIOR, servido pelo
   * `placeholderData` de `useEnvelope` enquanto o recorte novo ainda está em
   * voo (achado alto, revisão 03/08: sem este sinal, nenhum consumidor da
   * tela tem como saber que está olhando dado velho sob um seletor já
   * trocado). Componentes que exibem `meta`/`data` devem tratar
   * `isPlaceholderData === true` como estado de transição, nunca como 'ok'.
   */
  isPlaceholderData: boolean;
  /** Em voo AGORA — inclui background refetch, quando `isLoading` já é `false`. */
  isFetching: boolean;
  refetch: () => void;
}

/**
 * Base de todo hook do portal: uma RPC agregadora por tela, envelope
 * desembrulhado, cache de 5min e — quando `manterDadoAnterior` (default) —
 * o dado anterior preservado na troca de filtro.
 *
 * `placeholderData: (anterior) => anterior` — `keepPreviousData` não existe
 * mais no React Query v5. O flag correspondente (`query.isPlaceholderData`)
 * é sempre devolvido em `ResultadoGestor`, mesmo quando `manterDadoAnterior`
 * é `false` (nesse caso ele nunca fica `true`, mas o campo continua presente
 * e o consumidor não precisa distinguir os dois casos).
 *
 * `manterDadoAnterior = false` é para hooks cujo parâmetro IDENTIFICA o
 * objeto exibido — ex.: `especialidade` em `useDiagnosticoTemas`, `alunoId`
 * em `useAluno`. Para esses, "manter o anterior" nunca é o comportamento
 * desejado: o placeholder serviria os temas/dados de UM objeto sob o
 * título/nome de OUTRO (achado alto, revisão 03/08 — o drawer de temas e o
 * drawer do aluno). Para os demais hooks (recorte de IES/semestre/página,
 * não um objeto individual), o placeholder continua o padrão: a tela mostra
 * o recorte anterior, marcado por `isPlaceholderData`, em vez de piscar para
 * vazio a cada troca de filtro.
 *
 * A queryKey leva o id do usuário logado, inserido logo após o namespace
 * `'gestor'` (card 107 da revisão de 03/08): o QueryClient é module-scoped
 * (`App.tsx`), o logout não o limpa e o `gcTime` é 1h — sem o id do usuário
 * na chave, um logout→login na mesma aba serviria o cache do usuário
 * ANTERIOR (ex.: a lista completa de IES, se o anterior era admin). Preferido
 * a limpar o QueryClient inteiro no logout, que afetaria toda query do app;
 * aqui o raio da mudança é só o das queries do gestor.
 *
 * `refetchOnMount`/`refetchOnWindowFocus` ligados (card 110): o QueryClient
 * global (`App.tsx`) desliga os três `refetchOnX` para o app inteiro, então
 * o `staleTime` de 5min sozinho nunca dispara um refetch — mesmo padrão de
 * `useEffectiveFeatures.ts`, aqui escopado só às queries do gestor em vez de
 * mudar a configuração global.
 */
function useEnvelope<T>(
  queryKey: readonly unknown[],
  fn: string,
  args?: ArgsRpc,
  habilitado = true,
  manterDadoAnterior = true,
): ResultadoGestor<T> {
  const { user } = useAuth();
  const [namespace, ...resto] = queryKey;
  const query = useQuery({
    queryKey: [namespace, user?.id, ...resto],
    queryFn: () => chamarRpcGestor<T>(fn, args),
    staleTime: GESTOR_STALE_TIME,
    placeholderData: manterDadoAnterior ? (anterior) => anterior : undefined,
    enabled: habilitado,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}

/** Ordem estável da lista de simulados — queryKey determinística. */
const ordenados = (ids: string[]): string[] => [...ids].sort();

/** Contexto do shell (spec §5.2). */
export function useGestorContexto(): ResultadoGestor<ContextoGestor> {
  return useEnvelope<ContextoGestor>(['gestor', 'contexto'], 'get_gestor_contexto');
}

/** Cronograma de simulados contratados — âncora do Início (spec §6.4). */
export function useCronograma(iesId: string | null): ResultadoGestor<ItemCronograma[]> {
  return useEnvelope<ItemCronograma[]>(
    ['gestor', 'cronograma', iesId],
    'get_gestor_cronograma',
    { p_ies_id: iesId },
    iesId !== null,
  );
}

/** Avisos da Sanar para o público "gestor" (spec §6.2). */
export function useAvisos(iesId: string | null): ResultadoGestor<Aviso[]> {
  return useEnvelope<Aviso[]>(
    ['gestor', 'avisos', iesId],
    'get_gestor_avisos',
    { p_ies_id: iesId },
    iesId !== null,
  );
}

/**
 * Visão Geral inteira em um round-trip: 4 KPIs + as 3 séries do gráfico
 * protagonista + resumo do diagnóstico + distribuição + dispersão (spec §4.8).
 * Trocar o modo do gráfico NÃO refaz requisição (caso de teste 15).
 */
export function useVisaoGeral(filtros: FiltrosGestor): ResultadoGestor<VisaoGeral> {
  return useEnvelope<VisaoGeral>(
    ['gestor', 'visao-geral', filtros.iesId, filtros.semestre],
    'get_gestor_visao_geral',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre },
    filtros.iesId !== null,
  );
}

/** Um nível da cascata do Diagnóstico Curricular, lazy por nó (spec §4.8). */
export function useDiagnostico(
  filtros: FiltrosGestor,
  node: string | null,
): ResultadoGestor<NoDiagnostico[]> {
  return useEnvelope<NoDiagnostico[]>(
    ['gestor', 'diagnostico', filtros.iesId, filtros.semestre, node],
    'get_gestor_diagnostico',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre, p_node: node },
    filtros.iesId !== null,
  );
}

/**
 * Temas de uma especialidade — % de acerto, nunca proficiência (spec §4.1).
 *
 * `grandeArea` é a `grande_area` do NÓ PAI da cascata que originou o clique
 * no drawer (o mesmo dado já usado para montar a chamada de
 * `get_gestor_diagnostico` com `p_node`) — nunca a grande área "atual" de
 * outro contexto. É parte do recorte, não um detalhe de implementação:
 * `q.especialidade` não é único entre grandes áreas, então sem este
 * parâmetro os temas de duas especialidades homônimas em áreas diferentes se
 * misturariam na soma (achado 11, card 115 da revisão de 03/08; correção de
 * servidor em `20260804132000_get_gestor_diagnostico_temas_escopo_grande_area.sql`,
 * que adicionou `p_grande_area text DEFAULT NULL` — ADITIVO, mas o SQL pode
 * passar a EXIGIR o parâmetro depois, então o front sempre o envia, nunca
 * omite a chave).
 *
 * Por isso `grandeArea` entra na queryKey junto com `especialidade`: sem
 * isso, dois nós de especialidade homônima em grandes áreas diferentes
 * compartilhariam cache indevidamente.
 *
 * `manterDadoAnterior = false`: `especialidade` IDENTIFICA o objeto exibido
 * no `DrawerTemas` — ao trocar de especialidade (fechar A, abrir B) o
 * placeholder serviria os temas de A sob o título "Temas de B", e um clique
 * em "Copiar resumo" nesse instante colaria percentuais de A atribuídos a B
 * (achado alto, revisão 03/08). "Manter o anterior" nunca é o comportamento
 * desejado aqui — ao contrário do recorte de IES/semestre, onde o "anterior"
 * ainda É o mesmo objeto (a mesma tela), só com um filtro diferente.
 */
export function useDiagnosticoTemas(
  filtros: FiltrosGestor,
  especialidade: string | null,
  grandeArea: string | null,
): ResultadoGestor<TemaCritico[]> {
  return useEnvelope<TemaCritico[]>(
    ['gestor', 'diagnostico-temas', filtros.iesId, filtros.semestre, especialidade, grandeArea],
    'get_gestor_diagnostico_temas',
    {
      p_ies_id: filtros.iesId,
      p_semestre: filtros.semestre,
      p_especialidade: especialidade,
      p_grande_area: grandeArea,
    },
    filtros.iesId !== null && especialidade !== null,
    false,
  );
}

/**
 * Forma de `LinhaAluno.proficiencias` como a RPC `get_gestor_alunos` pode
 * devolver HOJE, em transição de contrato (migration
 * `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql`):
 *  - legada: `number | null` solto, uma posição por simulado, SEM id — a
 *    forma que produção ainda devolve enquanto a migration acima não for
 *    aplicada lá (o ambiente de desenvolvimento aponta para o banco de
 *    produção — ver MEMORY "Dois projetos Supabase").
 *  - nova: `{ simuladoId, valor }` — a forma que a migration acima faz a RPC
 *    passar a devolver.
 * `normalizarLinhaAluno` (abaixo) aceita as duas SEM checar uma flag de
 * versão: o formato de cada posição (primitivo vs. objeto) já basta para
 * distinguir uma da outra.
 */
type ProficienciaRpc = number | null | { simuladoId?: unknown; valor?: unknown };

interface LinhaAlunoRpc extends Omit<LinhaAluno, 'proficiencias'> {
  proficiencias: ProficienciaRpc[];
}

/**
 * Normaliza UMA posição de `proficiencias` para a forma canônica
 * `ProficienciaSimulado`, aceitando tanto o array legado quanto o novo (ver
 * `LinhaAlunoRpc` acima). Único ponto de normalização desta RPC — a partir
 * daqui (`TabelaAlunos` e qualquer outro consumidor) só existe
 * `ProficienciaSimulado`, nunca a forma bruta da RPC.
 *
 * RAMO LEGADO (`number | null`, sem `simuladoId`): não há como recuperar a
 * qual simulado aquela posição pertence — a RPC antiga simplesmente não manda
 * essa informação. `simuladoId: null` sinaliza "desconhecido"; como nenhuma
 * coluna real tem id `null`, a tabela nunca casa essa posição com uma coluna
 * e mostra TRAÇO — nunca um valor sob o cabeçalho errado (o próprio bug que
 * este contrato novo elimina). ESTE RAMO SAI assim que a migration
 * `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql` estiver
 * aplicada em produção e a RPC parar de devolver o array anônimo — a partir
 * daí, todo `entrada` chega como objeto e o primeiro `if` sempre é o tomado.
 */
function normalizarProficiencia(entrada: ProficienciaRpc): ProficienciaSimulado {
  if (entrada !== null && typeof entrada === 'object') {
    return {
      simuladoId: typeof entrada.simuladoId === 'string' ? entrada.simuladoId : null,
      valor: typeof entrada.valor === 'number' ? entrada.valor : null,
    };
  }
  return { simuladoId: null, valor: typeof entrada === 'number' ? entrada : null };
}

/**
 * Aplica `normalizarProficiencia` a uma `LinhaAluno` inteira, preservando os
 * demais campos (`id`, `nome`, `semestre`, `grupo`, `tendencia`) tal qual a
 * RPC devolveu. Exportada para ser testada diretamente com as duas formas de
 * `proficiencias` (ver `TabelaAlunos.test.tsx`).
 */
export function normalizarLinhaAluno(linha: LinhaAlunoRpc): LinhaAluno {
  return { ...linha, proficiencias: linha.proficiencias.map(normalizarProficiencia) };
}

/** Tabela de alunos, paginada no servidor (spec §4.8). */
export function useAlunos(
  filtros: FiltrosGestor,
  paginacao: PaginacaoGestor,
): ResultadoGestor<Paginado<LinhaAluno>> {
  const resultado = useEnvelope<Paginado<LinhaAlunoRpc>>(
    [
      'gestor', 'alunos', filtros.iesId, filtros.semestre,
      paginacao.page, paginacao.pageSize, paginacao.sort, paginacao.order, paginacao.q,
    ],
    'get_gestor_alunos',
    {
      p_ies_id: filtros.iesId,
      p_semestre: filtros.semestre,
      p_page: paginacao.page,
      p_page_size: paginacao.pageSize,
      p_sort: paginacao.sort,
      p_order: paginacao.order,
      p_q: paginacao.q,
    },
    filtros.iesId !== null,
  );

  // Mapeamento de get_gestor_alunos: normaliza proficiencias (legada ou
  // nova, ver normalizarLinhaAluno acima) antes de expor o dado ao resto do
  // app. Único ponto de tradução — o resto de queries.ts/TabelaAlunos nunca
  // vê a forma bruta da RPC.
  //
  // `Array.isArray(paginado.data)` guarda contra um envelope que não tem o
  // formato `Paginado` (ex.: um mock de teste genérico que devolve `[]` para
  // vários hooks, sem o `page`/`pageSize`/`data[]` que só `useAlunos` e
  // `useQuestoes` exigem). Nesse caso devolvemos `undefined`, não o valor
  // bruto: repassar uma forma que não é `Paginado` tipada como se fosse é o
  // mesmo erro de sempre — afirmar o que não se mediu. Sem dado utilizável, o
  // consumidor mostra vazio; com dado corrompido, ele quebraria no `.map`.
  const paginado = resultado.data;
  return {
    ...resultado,
    data:
      paginado !== undefined && Array.isArray(paginado.data)
        ? { ...paginado, data: paginado.data.map(normalizarLinhaAluno) }
        : undefined,
  };
}

/**
 * Drawer do aluno. A IES em foco vem do recorte global (URL) — assinatura
 * canônica do handoff é `(alunoId, simulados)`, então não a recebe por
 * parâmetro. Lembrar: `iesId` é hint de UI; a RPC escopa pelo token.
 *
 * `get_gestor_aluno` devolve UMA ENTRADA POR SIMULADO (`jsonb_agg` na
 * migration `20260803150000_get_gestor_aluno_aguardando_resultado.sql`) — o
 * `data` do envelope é `AlunoSimuladoEntry[]` (`AlunoNoSimulado` acrescido de
 * `simuladoId`/`simuladoNome`/`simuladoData`, ver `api/types.ts`), nunca um
 * objeto singular e nunca `AlunoNoSimulado[]` puro (card 106 da revisão de
 * 03/08: o tipo de entrada com os três campos de simulado não existia).
 *
 * `manterDadoAnterior = false`: `alunoId` IDENTIFICA o objeto exibido no
 * drawer do aluno — trocar de aluno com o placeholder ligado serviria a
 * ficha do aluno ANTERIOR sob o nome/cabeçalho do novo, mesma classe do
 * achado alto do `DrawerTemas` (revisão 03/08). "Manter o anterior" nunca é
 * o comportamento desejado aqui.
 */
export function useAluno(
  alunoId: string | null,
  simulados: string[],
): ResultadoGestor<AlunoSimuladoEntry[]> {
  const { iesId } = useFiltrosGestor();
  const lista = ordenados(simulados);
  return useEnvelope<AlunoSimuladoEntry[]>(
    ['gestor', 'aluno', iesId, alunoId, lista],
    'get_gestor_aluno',
    { p_ies_id: iesId, p_aluno_id: alunoId, p_simulados: lista },
    iesId !== null && alunoId !== null,
    false,
  );
}

/** Detalhamento por simulados — nunca "todos": exige seleção explícita (spec §4.7). */
export function useDetalhamento(filtros: FiltrosGestor): ResultadoGestor<Detalhamento> {
  const lista = ordenados(filtros.simulados);
  return useEnvelope<Detalhamento>(
    ['gestor', 'detalhamento', filtros.iesId, filtros.semestre, lista],
    'get_gestor_detalhamento',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre, p_simulados: lista },
    filtros.iesId !== null && lista.length > 0,
  );
}

/** Detalhamento das Questões — só com EXATAMENTE 1 simulado (spec §4.7). */
export function useQuestoes(
  filtros: FiltrosGestor,
  paginacao: PaginacaoGestor,
): ResultadoGestor<Paginado<Questao>> {
  const simuladoId = filtros.simulados.length === 1 ? filtros.simulados[0] : null;
  return useEnvelope<Paginado<Questao>>(
    [
      'gestor', 'questoes', filtros.iesId, simuladoId,
      paginacao.page, paginacao.pageSize, paginacao.sort, paginacao.area,
    ],
    'get_gestor_questoes',
    {
      p_ies_id: filtros.iesId,
      p_simulado_id: simuladoId,
      p_page: paginacao.page,
      p_page_size: paginacao.pageSize,
      p_sort: paginacao.sort,
      p_area: paginacao.area,
    },
    filtros.iesId !== null && simuladoId !== null,
  );
}
