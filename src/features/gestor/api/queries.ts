import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import type {
  AlunoNoSimulado,
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
  refetch: () => void;
}

/**
 * Base de todo hook do portal: uma RPC agregadora por tela, envelope
 * desembrulhado, cache de 5min e o dado anterior preservado na troca de filtro.
 *
 * `placeholderData: (anterior) => anterior` — `keepPreviousData` não existe
 * mais no React Query v5.
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
): ResultadoGestor<T> {
  const { user } = useAuth();
  const [namespace, ...resto] = queryKey;
  const query = useQuery({
    queryKey: [namespace, user?.id, ...resto],
    queryFn: () => chamarRpcGestor<T>(fn, args),
    staleTime: GESTOR_STALE_TIME,
    placeholderData: (anterior) => anterior,
    enabled: habilitado,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
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

/** Temas de uma especialidade — % de acerto, nunca proficiência (spec §4.1). */
export function useDiagnosticoTemas(
  filtros: FiltrosGestor,
  especialidade: string | null,
): ResultadoGestor<TemaCritico[]> {
  return useEnvelope<TemaCritico[]>(
    ['gestor', 'diagnostico-temas', filtros.iesId, filtros.semestre, especialidade],
    'get_gestor_diagnostico_temas',
    {
      p_ies_id: filtros.iesId,
      p_semestre: filtros.semestre,
      p_especialidade: especialidade,
    },
    filtros.iesId !== null && especialidade !== null,
  );
}

/** Tabela de alunos, paginada no servidor (spec §4.8). */
export function useAlunos(
  filtros: FiltrosGestor,
  paginacao: PaginacaoGestor,
): ResultadoGestor<Paginado<LinhaAluno>> {
  return useEnvelope<Paginado<LinhaAluno>>(
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
}

/**
 * Drawer do aluno. A IES em foco vem do recorte global (URL) — assinatura
 * canônica do handoff é `(alunoId, simulados)`, então não a recebe por
 * parâmetro. Lembrar: `iesId` é hint de UI; a RPC escopa pelo token.
 *
 * `get_gestor_aluno` devolve UMA ENTRADA POR SIMULADO (`jsonb_agg` na
 * migration `20260803150000_get_gestor_aluno_aguardando_resultado.sql`) — o
 * `data` do envelope é `AlunoNoSimulado[]`, nunca um objeto singular (card 106
 * da revisão de 03/08).
 */
export function useAluno(
  alunoId: string | null,
  simulados: string[],
): ResultadoGestor<AlunoNoSimulado[]> {
  const { iesId } = useFiltrosGestor();
  const lista = ordenados(simulados);
  return useEnvelope<AlunoNoSimulado[]>(
    ['gestor', 'aluno', iesId, alunoId, lista],
    'get_gestor_aluno',
    { p_ies_id: iesId, p_aluno_id: alunoId, p_simulados: lista },
    iesId !== null && alunoId !== null,
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
