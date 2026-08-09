import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import type {
  Alternativa,
  AlunoContato,
  AlunoSimuladoEntry,
  Aviso,
  ContextoGestor,
  Detalhamento,
  Envelope,
  FiltrosGestor,
  ItemCronograma,
  LinhaAluno,
  Meta,
  NivelDesempenho,
  NoDiagnostico,
  Paginado,
  PaginacaoGestor,
  ProficienciaSimulado,
  Questao,
  QuestaoRespondente,
  TemaCritico,
  VisaoGeral,
} from '@/features/gestor/api/types';
import type { DesempenhoPorAreaSimulado } from '@/features/gestor/api/types-aluno-area';

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
 * Conta simulados "com dado" a partir de `evolucao` — a MESMA fonte que
 * alimenta o gráfico protagonista no modo 'geral' (`GraficoProtagonista` →
 * `EvolucaoChart`, que recebe `visao.evolucao` direto, sem transformação no
 * meio). Definição escolhida (Felipe, 05/08, achado FAI): simulado com NOTA
 * de proficiência calculada — `ponto.valor !== null` —, porque é exatamente
 * essa condição que decide se o simulado ganha um ponto real no gráfico
 * (`EvolucaoChart` usa `connectNulls={false}`: um `valor: null` é um buraco
 * na série, nunca uma medição). Contar qualquer participação (>=1 resposta,
 * mesmo sem TRI processada ainda) contaria como "realizado" um simulado que o
 * gráfico não desenha como medição — reabriria a mesma classe de
 * discordância que este fix fecha, só que ao contrário.
 *
 * Consumida por `useVisaoGeral` para substituir, no numerador exibido pelo
 * KPI "Simulados realizados" (`KpisVisaoGeral.tsx`), o que o servidor
 * calcula em `kpis.simulados.realizados`: slots do CONTRATO vigente com
 * simulado vinculado (migration
 * `20260804174000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql`).
 * Esse número do servidor é `0` sempre que a IES não tem
 * `ies_simulado_previsto` vinculado — achado de 05/08, IES FAI: o KPI
 * mostrava "0 de —" na mesma tela em que o gráfico "Evolução institucional"
 * logo abaixo plotava 3 simulados com nota real. `contratados` continua
 * vindo do servidor tal qual (`null` sem contrato, nunca `0` — spec §4.10);
 * só o NUMERADOR muda de fonte.
 */
export function contarSimuladosComNotaReal(evolucao: VisaoGeral['evolucao']): number {
  return evolucao.filter((ponto) => ponto.valor !== null).length;
}

/**
 * Visão Geral inteira em um round-trip: 4 KPIs + as 3 séries do gráfico
 * protagonista + resumo do diagnóstico + distribuição + dispersão (spec §4.8).
 * Trocar o modo do gráfico NÃO refaz requisição (caso de teste 15).
 *
 * `kpis.simulados.realizados` é RECALCULADO aqui a partir de `evolucao` (ver
 * `contarSimuladosComNotaReal` acima) — nunca o valor cru que a RPC devolve
 * nesse campo. Único ponto de tradução desta query, mesmo padrão de
 * `normalizarLinhaAluno`/`useAlunos` abaixo: dado de servidor corrigido aqui,
 * antes de qualquer componente ler `visao.kpis` (`KpisVisaoGeral` só formata
 * e ordena — spec do próprio arquivo). A guarda `Array.isArray(visao.evolucao)`
 * também protege o teste de placeholderData de `queries.test.tsx` ("mantém o
 * dado anterior..."), que usa de propósito payloads fora da forma de
 * `VisaoGeral` (ex.: `{ kpis: 'primeiro' }`) para isolar o comportamento de
 * cache — sem `evolucao` como array, esta função devolve o dado tal como
 * chegou, sem tocar nele.
 */
export function useVisaoGeral(filtros: FiltrosGestor): ResultadoGestor<VisaoGeral> {
  const resultado = useEnvelope<VisaoGeral>(
    ['gestor', 'visao-geral', filtros.iesId, filtros.semestre],
    'get_gestor_visao_geral',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre },
    filtros.iesId !== null,
  );

  const visao = resultado.data;
  return {
    ...resultado,
    data:
      visao && Array.isArray(visao.evolucao)
        ? {
            ...visao,
            kpis: {
              ...visao.kpis,
              simulados: { ...visao.kpis.simulados, realizados: contarSimuladosComNotaReal(visao.evolucao) },
            },
          }
        : visao,
  };
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
 * Forma de `LinhaAluno.proficiencias` como a RPC `get_gestor_alunos` devolve
 * em produção: `{ simuladoId, valor }[]` (migration
 * `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql`, aplicada
 * em produção em 05/08 — ver `ProficienciaSimulado` em `api/types.ts` para o
 * porquê do casamento por id em vez de por posição).
 *
 * Os campos chegam tipados como `unknown`: `chamarRpcGestor` faz um cast não
 * verificado a partir da resposta da RPC (linha 43 acima), então
 * `normalizarProficiencia` (abaixo) é quem valida o tipo real de cada campo
 * antes de expor `ProficienciaSimulado` ao resto do app.
 */
type ProficienciaRpc = { simuladoId?: unknown; valor?: unknown };

interface LinhaAlunoRpc extends Omit<LinhaAluno, 'proficiencias'> {
  proficiencias: ProficienciaRpc[];
}

/**
 * Normaliza UMA posição de `proficiencias` para a forma canônica
 * `ProficienciaSimulado`, validando o tipo de cada campo — `entrada` chega
 * como `unknown` na prática (ver `ProficienciaRpc` acima), então um campo
 * ausente ou de tipo inesperado vira `null` em vez de propagar um valor não
 * confiável. Único ponto de normalização desta RPC — a partir daqui
 * (`TabelaAlunos` e qualquer outro consumidor) só existe
 * `ProficienciaSimulado`, nunca a forma bruta da RPC.
 *
 * `simuladoId: null` (campo ausente ou de tipo inesperado): não há como
 * recuperar a qual simulado aquela posição pertence. Como nenhuma coluna real
 * tem id `null`, a tabela nunca casa essa posição com uma coluna e mostra
 * TRAÇO — nunca um valor sob o cabeçalho errado.
 */
function normalizarProficiencia(entrada: ProficienciaRpc): ProficienciaSimulado {
  return {
    simuladoId: typeof entrada.simuladoId === 'string' ? entrada.simuladoId : null,
    valor: typeof entrada.valor === 'number' ? entrada.valor : null,
  };
}

/**
 * Aplica `normalizarProficiencia` a uma `LinhaAluno` inteira, preservando os
 * demais campos (`id`, `nome`, `semestre`, `grupo`, `tendencia`) tal qual a
 * RPC devolveu. Exportada para ser testada diretamente (ver `TabelaAlunos.test.tsx`).
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
      paginacao.grupo ?? null,
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
      /**
       * `p_grupo` — filtro pelo grupo de evolução (§ chips da Visão de
       * Alunos, 07/08). Parâmetro ADITIVO em `get_gestor_alunos`: quando
       * `null` (o caso de todo chamador anterior a esta mudança), a RPC
       * devolve exatamente o mesmo recorte de sempre — nenhuma migração de
       * comportamento para quem não passa este campo.
       */
      p_grupo: paginacao.grupo ?? null,
    },
    filtros.iesId !== null,
  );

  // Mapeamento de get_gestor_alunos: normaliza proficiencias (ver
  // normalizarLinhaAluno acima) antes de expor o dado ao resto do app. Único
  // ponto de tradução — o resto de queries.ts/TabelaAlunos nunca vê a forma
  // bruta da RPC.
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

/**
 * Desempenho do aluno por grande área/especialidade/tema (drill-down do
 * `DrawerAluno`, 09/08) — `get_gestor_aluno_desempenho_por_area` devolve UMA
 * ENTRADA POR SIMULADO (`DesempenhoPorAreaSimulado[]`), mesmo espírito de
 * `useAluno`/`AlunoSimuladoEntry`: nenhuma linha de área é fundida entre
 * simulados (regra de agregação honesta).
 *
 * Tipos isolados em `api/types-aluno-area.ts`, não em `api/types.ts` — aquele
 * arquivo está em edição paralela por outra tarefa no mesmo dia.
 *
 * `manterDadoAnterior = false`: mesma razão de `useAluno` — `alunoId`
 * IDENTIFICA o objeto exibido, então trocar de aluno nunca deve mostrar o
 * drill-down do aluno ANTERIOR sob o nome do novo enquanto a busca está em
 * voo.
 */
export function useAlunoDesempenhoPorArea(
  alunoId: string | null,
  simulados: string[],
): ResultadoGestor<DesempenhoPorAreaSimulado[]> {
  const { iesId } = useFiltrosGestor();
  const lista = ordenados(simulados);
  return useEnvelope<DesempenhoPorAreaSimulado[]>(
    ['gestor', 'aluno-desempenho-area', iesId, alunoId, lista],
    'get_gestor_aluno_desempenho_por_area',
    { p_ies_id: iesId, p_aluno_id: alunoId, p_simulados: lista },
    iesId !== null && alunoId !== null,
    false,
  );
}

/**
 * Contato do aluno (telefone) para o cabeçalho do `DrawerAluno` — decisão de
 * Felipe (31/07, reafirmada em 05/08 ao herdar o dado do
 * `StudentAnalyticsDrawer` extinto junto do console antigo): qualquer gestor
 * com acesso ao aluno pode ver o telefone, sem flag de permissão extra.
 *
 * Deliberadamente UM aluno por chamada — nunca embutido em `get_gestor_alunos`
 * (RPC de turma, paginada): somar telefone lá devolveria o telefone de TODOS
 * os alunos do recorte a cada carregamento da tabela. O `DrawerAluno` chama
 * isto só quando abre (`enabled: alunoId !== null` abaixo), nunca em lote e
 * nunca junto da tabela.
 *
 * NÃO usa `useEnvelope`/`chamarRpcGestor`: ao contrário de todo outro
 * `get_gestor_*`, `get_gestor_aluno_contato` não devolve o envelope
 * `{ data, meta }` — devolve `{ id, telefone }` direto (ver `AlunoContato` em
 * `api/types.ts` para a migration exata). Passar por `useEnvelope` aqui leria
 * `.data`/`.meta` de um objeto que não os tem e devolveria `undefined` mesmo
 * numa resposta de sucesso — por isso a query é montada à mão, no mesmo
 * formato de `ResultadoGestor<T>` que todo consumidor do portal já espera.
 * `meta` sai sempre `undefined`: telefone é dado de cadastro cru, não
 * indicador calculado — não há "fonte/critério" de rastreabilidade (spec
 * §4.1) para expor.
 *
 * Sem `placeholderData` — equivalente ao `manterDadoAnterior = false` dos
 * outros hooks de objeto único (`useAluno`/`useDiagnosticoTemas` acima):
 * `alunoId` IDENTIFICA o aluno exibido, então trocar de aluno nunca deve
 * mostrar o telefone do ANTERIOR sob o nome do novo enquanto a busca nova
 * está em voo.
 */
export function useAlunoContato(alunoId: string | null): ResultadoGestor<AlunoContato> {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['gestor', user?.id, 'aluno-contato', alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (
        fn: string,
        args?: ArgsRpc,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)('get_gestor_aluno_contato', {
        p_aluno_id: alunoId,
      });
      if (error) throw new Error(`get_gestor_aluno_contato: ${error.message}`);
      if (data == null) throw new Error('get_gestor_aluno_contato: resposta vazia');
      return data as AlunoContato;
    },
    staleTime: GESTOR_STALE_TIME,
    enabled: alunoId !== null,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    meta: undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    isPlaceholderData: query.isPlaceholderData,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}

/** Detalhamento por simulados — nunca "todos": exige seleção explícita (spec §4.7). */
/**
 * `habilitado` existe para a tela poder DESLIGAR a consulta mais cara do
 * portal quando já sabe que não vai mostrar o resultado — hoje, o caso de
 * "todos os simulados selecionados", que o Detalhamento responde com um
 * estado explicativo em vez de números. Sem o gate, a RPC rodava sobre o
 * período inteiro para um resultado que ninguém veria.
 */
export function useDetalhamento(
  filtros: FiltrosGestor,
  habilitado = true,
): ResultadoGestor<Detalhamento> {
  const lista = ordenados(filtros.simulados);
  return useEnvelope<Detalhamento>(
    ['gestor', 'detalhamento', filtros.iesId, filtros.semestre, lista],
    'get_gestor_detalhamento',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre, p_simulados: lista },
    habilitado && filtros.iesId !== null && lista.length > 0,
  );
}

/**
 * Forma de UMA linha do drill-down de área do Detalhamento
 * (`get_gestor_detalhamento_temas`, migration
 * `20260809233000_get_gestor_detalhamento_temas.sql`) — mesmo shape de
 * `NoDiagnostico` (id/nome/nivel/acertoPct/desempenho/amostra/lowSample/
 * temFilhos), mas com outro contrato de nível: a cascata do Diagnóstico
 * Curricular tem um nível a mais ('grande_area') que esta RPC nunca devolve
 * — a grande área é o PARÂMETRO (`p_grande_area`), não um nível da resposta.
 * Definido aqui, e não em `api/types.ts`, para não colidir com edição
 * paralela daquele arquivo por outra tarefa desta mesma sessão.
 */
export interface NoDetalhamentoTemas {
  id: string;
  nome: string;
  nivel: 'especialidade' | 'tema';
  acertoPct: number;
  desempenho: NivelDesempenho;
  amostra: number;
  lowSample: boolean;
  temFilhos: boolean;
}

/**
 * Drill-down de área do card "Acerto por grande área e por semestre" do
 * Detalhamento (`AcertoPorAreaESemestre` → `DrawerTemasDetalhamento`).
 *
 * Recorta por `p_simulados` (o MESMO array da tela), nunca por semestre:
 * `get_gestor_detalhamento_temas` segue o padrão de recorte de
 * `get_gestor_detalhamento`, não o de `get_gestor_diagnostico_temas` (que
 * recorta por `p_ies_id` + `p_semestre`). Por isso este hook recebe
 * `iesId`/`simulados` crus em vez de `FiltrosGestor` inteiro — `semestre`
 * nunca chega à RPC e não deveria fingir que chega.
 *
 * Sem `especialidade`, agrupa por especialidade dentro de `grandeArea`
 * (nível "especialidade"); com `especialidade`, agrupa por tema dentro dela
 * (nível "tema", sempre folha) — mesmo par de modos de `useDiagnosticoTemas`.
 *
 * `manterDadoAnterior = false`: `grandeArea`/`especialidade` IDENTIFICAM o
 * nível exibido no drawer — mesmo motivo de `useDiagnosticoTemas`/`useAluno`
 * acima. Trocar de área ou drilar para uma especialidade com o placeholder
 * ligado serviria o nível ANTERIOR sob o título do novo.
 */
export function useDetalhamentoTemas(
  iesId: string | null,
  simulados: string[],
  grandeArea: string | null,
  especialidade: string | null,
): ResultadoGestor<NoDetalhamentoTemas[]> {
  const lista = ordenados(simulados);
  return useEnvelope<NoDetalhamentoTemas[]>(
    ['gestor', 'detalhamento-temas', iesId, lista, grandeArea, especialidade],
    'get_gestor_detalhamento_temas',
    { p_ies_id: iesId, p_simulados: lista, p_grande_area: grandeArea, p_especialidade: especialidade },
    iesId !== null && lista.length > 0 && grandeArea !== null,
    false,
  );
}

/**
 * Tradução do valor do controle de ordenação para o contrato da RPC.
 *
 * `get_gestor_questoes` só aceita `p_sort IN ('numero','acerto')` e, fora
 * disso, `RAISE EXCEPTION 'sort_invalido'`. A UI mandava o próprio rótulo
 * interno (`ordem_da_prova` | `mais_erradas` | `mais_acertadas`), que não está
 * na whitelist — então TODA chamada falhava, inclusive a do estado inicial, e o
 * bloco "Detalhamento das Questões" ficava permanentemente vazio nas três
 * ordenações. O teste `questoesContratoSort.test.ts` trava os dois lados juntos
 * para que a whitelist do SQL e os valores da UI não voltem a divergir.
 *
 * `mais_acertadas` ainda não tem caminho no servidor: o ORDER BY da RPC é
 * `acerto_pct ASC` fixo, sem parâmetro de direção. A migration
 * `20260806..._get_gestor_questoes_ordem_desc.sql` acrescenta `acerto_desc` à
 * whitelist; enquanto ela não estiver aplicada, este mapa degrada para
 * `acerto` (ascendente) em vez de estourar a RPC — lista errada é ruim, lista
 * vazia é pior, e a alternativa seria esconder a opção do gestor.
 */
const SORT_QUESTOES_RPC: Record<string, string> = {
  ordem_da_prova: 'numero',
  mais_erradas: 'acerto',
  mais_acertadas: 'acerto_desc',
};

/** Fallback enquanto `acerto_desc` não existir no banco. */
const SORT_QUESTOES_FALLBACK: Record<string, string> = { acerto_desc: 'acerto' };

export function sortQuestoesParaRpc(sort: string, suportaDesc = false): string {
  const alvo = SORT_QUESTOES_RPC[sort] ?? 'numero';
  return suportaDesc ? alvo : (SORT_QUESTOES_FALLBACK[alvo] ?? alvo);
}

/**
 * Detalhamento das Questões — só com EXATAMENTE 1 simulado (spec §4.7).
 *
 * `p_semestre` — mesmo recorte de semestre que `useAlunos`/`useDetalhamento`
 * enviam, vindo da MESMA fonte (`filtros.semestre` do recorte global): a
 * população de alunos usada para `acertoPct`/`marcadaPct` de cada questão
 * passa a respeitar "6º ano"/um semestre específico, não só a IES + o
 * simulado. Parâmetro ADITIVO em `get_gestor_questoes` (migration
 * `20260809231000_get_gestor_questoes_semestre_imagens_e_respondentes.sql`,
 * já em produção em 09/08) — sempre enviado, nunca omitido, mesmo padrão de
 * `p_grande_area` em `useDiagnosticoTemas` acima.
 */
export function useQuestoes(
  filtros: FiltrosGestor,
  paginacao: PaginacaoGestor,
): ResultadoGestor<Paginado<Questao>> {
  const simuladoId = filtros.simulados.length === 1 ? filtros.simulados[0] : null;
  return useEnvelope<Paginado<Questao>>(
    [
      'gestor', 'questoes', filtros.iesId, filtros.semestre, simuladoId,
      paginacao.page, paginacao.pageSize, paginacao.sort, paginacao.area,
    ],
    'get_gestor_questoes',
    {
      p_ies_id: filtros.iesId,
      p_semestre: filtros.semestre,
      p_simulado_id: simuladoId,
      p_page: paginacao.page,
      p_page_size: paginacao.pageSize,
      p_sort: sortQuestoesParaRpc(paginacao.sort),
      p_area: paginacao.area,
    },
    filtros.iesId !== null && simuladoId !== null,
  );
}

/**
 * Alunos que marcaram uma alternativa específica de uma questão — clique em
 * "ver quem marcou" na distribuição por alternativa (`DistribuicaoAlternativas`).
 * RPC nova, `get_gestor_questao_respondentes(p_ies_id, p_question_id,
 * p_alternativa)` (migration `20260809231000_..._respondentes.sql`, PARTE 2,
 * já em produção em 09/08) — devolve o envelope `{ data, meta }` padrão, então
 * usa `useEnvelope`/`chamarRpcGestor` como todo outro hook deste arquivo.
 *
 * `manterDadoAnterior = false` (SEM `placeholderData`) — mesma lógica de
 * `useAluno`/`useAlunoContato` acima: o par `(questionId, alternativa)`
 * IDENTIFICA a lista exibida. Isto é um dado pontual de um clique, não um
 * recorte de tela — manter o anterior mostraria os respondentes de OUTRA
 * alternativa (ou de outra questão) sob o rótulo da nova, no instante em que
 * a gestora troca de alternativa/questão com a lista ainda em voo.
 *
 * `habilitado` (default `true`) deixa o CHAMADOR decidir quando a consulta
 * deve rodar — o uso real (`DistribuicaoAlternativas`) só habilita quando a
 * linha da alternativa está aberta, nunca a cada render da distribuição.
 */
export function useQuestaoRespondentes(
  iesId: string | null,
  questionId: string | null,
  alternativa: Alternativa['letra'] | null,
  habilitado = true,
): ResultadoGestor<QuestaoRespondente[]> {
  return useEnvelope<QuestaoRespondente[]>(
    ['gestor', 'questao-respondentes', iesId, questionId, alternativa],
    'get_gestor_questao_respondentes',
    { p_ies_id: iesId, p_question_id: questionId, p_alternativa: alternativa },
    habilitado && iesId !== null && questionId !== null && alternativa !== null,
    false,
  );
}
