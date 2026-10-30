/**
 * Hooks de dados do Engajamento SanarFlix (spec 2026-10-22-engajamento §10.4).
 *
 * Todos passam por `useEnvelope` (`api/queries.ts`): envelope desembrulhado,
 * cache de 5 min e a `queryKey` com o id do usuário logado logo após o
 * namespace `'gestor'`. A `queryKey` de cada hook é
 * `['gestor', <user.id>, 'engajamento', <bloco>, …filtros]`.
 *
 * Os parâmetros `p_*` seguem a §8.11. O front manda `p_semestre` como número ou
 * `null`, e as datas como `'AAAA-MM-DD'`. As RPCs são resolvidas pelos NOMES dos
 * parâmetros: nunca crie sobrecargas com os mesmos nomes.
 *
 * `manterDadoAnterior`:
 * - `true` (recorte de tela): visão geral, tabela "Por aluno", Questões e Conteúdos
 *   — a tela mostra o recorte anterior, sinalizado por `isPlaceholderData`.
 * - `false` (o parâmetro IDENTIFICA o objeto exibido): lista, drawer do aluno e
 *   pop-ups de nó/conteúdo — o placeholder mostraria os dados de um aluno, nó ou
 *   conteúdo sob o título de outro.
 *
 * A busca já chega com debounce de 300 ms do componente; aqui só se normaliza
 * (vazia vira `null`).
 */
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { chamarRpcGestor, useEnvelope, type ResultadoGestor } from '@/features/gestor/api/queries';
import type {
  AlunoEngajamento,
  AlunosEngajamento,
  CategoriaLista,
  ChaveConteudo,
  ConteudoAlunosEngajamento,
  ConteudosEngajamento,
  ExportAlunosEngajamento,
  LinhaExportAluno,
  ListaEngajamento,
  DirecaoOrdem,
  OrdemAlunos,
  QuestoesAlunosEngajamento,
  QuestoesEngajamento,
  VersaoEngajamento,
  VisaoGeralEngajamento,
} from '@/features/gestor/api/types-engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';

/** O recorte que as RPCs consomem: IES, período, semestre, aluno e tipo. */
export type FiltrosRecorteEngajamento = Pick<
  FiltrosEngajamento,
  'iesId' | 'inicio' | 'fim' | 'semestre' | 'alunoId' | 'tipo'
>;

/** Tamanho de página da tabela "Por aluno" (a RPC aceita 1–50). */
export const PAGE_SIZE_ALUNOS = 20;
/** Máximo da lista para exportação CSV (a RPC aceita até 5.000). */
export const PAGE_SIZE_EXPORTACAO = 5000;

const periodo = (f: FiltrosRecorteEngajamento) => ({
  p_ies_id: f.iesId,
  p_inicio: f.inicio,
  p_fim: f.fim,
});

/** Busca vazia ou só espaços vira `null`: a RPC trata `null` como "sem busca". */
const buscaOuNull = (busca: string): string | null => {
  const limpa = busca.trim();
  return limpa === '' ? null : limpa;
};

const ERRO_ALUNO_FORA = 'aluno_fora_do_recorte';

/**
 * Visão geral inteira em um round-trip (§8.1).
 *
 * Regra 8 da §9.6: se a RPC responder `aluno_fora_do_recorte` (um aluno de outra
 * IES na URL), o hook limpa `aluno` via `setAluno(null)` e a consulta é refeita
 * sozinha com a nova chave. Só esse erro limpa o aluno: qualquer outro falha como
 * erro normal e o aluno fica. Para isso o chamador passa o recorte completo de
 * `useFiltrosEngajamento()` (com `setAluno`).
 */
export function useEngajamentoVisaoGeral(
  f: FiltrosRecorteEngajamento & { setAluno?: (id: string | null) => void },
): ResultadoGestor<VisaoGeralEngajamento> {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { iesId, inicio, fim, semestre, alunoId, setAluno } = f;

  const resultado = useEnvelope<VisaoGeralEngajamento>(
    ['gestor', 'engajamento', 'visao-geral', iesId, inicio, fim, semestre, alunoId],
    'get_gestor_engajamento_visao_geral',
    { ...periodo(f), p_semestre: semestre, p_aluno: alunoId },
    iesId !== null,
  );

  const { isError } = resultado;
  useEffect(() => {
    if (!isError || alunoId === null || !setAluno) return;
    // A chave que `useEnvelope` de fato usa: o id do usuário entra logo após o namespace.
    const chave = ['gestor', user?.id, 'engajamento', 'visao-geral', iesId, inicio, fim, semestre, alunoId];
    const erro = queryClient.getQueryState(chave)?.error;
    if (erro instanceof Error && erro.message.includes(ERRO_ALUNO_FORA)) setAluno(null);
  }, [isError, alunoId, setAluno, queryClient, user?.id, iesId, inicio, fim, semestre]);

  return resultado;
}

/** Tabela "Por aluno" (§8.2). A lista NÃO é filtrada por aluno: o aluno filtrado só aparece realçado nela. */
export function useEngajamentoAlunos(
  f: FiltrosRecorteEngajamento,
  ordem: OrdemAlunos,
  direcao: DirecaoOrdem,
  busca: string,
  sem14: boolean,
  page: number,
): ResultadoGestor<AlunosEngajamento> {
  const termo = buscaOuNull(busca);
  return useEnvelope<AlunosEngajamento>(
    ['gestor', 'engajamento', 'alunos', f.iesId, f.inicio, f.fim, f.semestre, ordem, direcao, termo, sem14, page],
    'get_gestor_engajamento_alunos',
    {
      ...periodo(f),
      p_semestre: f.semestre,
      p_ordem: ordem,
      p_direcao: direcao,
      p_busca: termo,
      p_sem_atividade_14d: sem14,
      p_page: page,
      p_page_size: PAGE_SIZE_ALUNOS,
    },
    f.iesId !== null,
  );
}

/** Prévias, pop-ups "+N" e "Ver lista completa" de níveis e recência (§8.3). Respeita semestre e aluno. */
export function useEngajamentoLista(
  f: FiltrosRecorteEngajamento,
  categoria: CategoriaLista,
  busca: string,
  page: number,
  pageSize: number,
): ResultadoGestor<ListaEngajamento> {
  const termo = buscaOuNull(busca);
  return useEnvelope<ListaEngajamento>(
    [
      'gestor', 'engajamento', 'lista',
      f.iesId, f.inicio, f.fim, f.semestre, f.alunoId, categoria, termo, page, pageSize,
    ],
    'get_gestor_engajamento_lista',
    {
      ...periodo(f),
      p_semestre: f.semestre,
      p_aluno: f.alunoId,
      p_categoria: categoria,
      p_busca: termo,
      p_page: page,
      p_page_size: pageSize,
    },
    f.iesId !== null,
    false,
  );
}

/** Drawer do aluno (§8.4). `alunoId` nulo = drawer fechado, sem consulta. */
export function useEngajamentoAluno(
  f: FiltrosRecorteEngajamento,
  alunoId: string | null,
): ResultadoGestor<AlunoEngajamento> {
  return useEnvelope<AlunoEngajamento>(
    ['gestor', 'engajamento', 'aluno', f.iesId, f.inicio, f.fim, alunoId],
    'get_gestor_engajamento_aluno',
    { ...periodo(f), p_aluno: alunoId },
    f.iesId !== null && alunoId !== null,
    false,
  );
}

/** Aba Questões inteira, exceto o pop-up (§8.5). */
export function useEngajamentoQuestoes(f: FiltrosRecorteEngajamento): ResultadoGestor<QuestoesEngajamento> {
  return useEnvelope<QuestoesEngajamento>(
    ['gestor', 'engajamento', 'questoes', f.iesId, f.inicio, f.fim, f.semestre],
    'get_gestor_engajamento_questoes',
    { ...periodo(f), p_semestre: f.semestre },
    f.iesId !== null,
  );
}

/** Pop-up "alunos que resolveram" de um tema ou assunto (§8.6). `folhaId` nulo = pop-up fechado. */
export function useEngajamentoQuestoesAlunos(
  f: FiltrosRecorteEngajamento,
  folhaId: string | null,
): ResultadoGestor<QuestoesAlunosEngajamento> {
  return useEnvelope<QuestoesAlunosEngajamento>(
    ['gestor', 'engajamento', 'questoes-alunos', f.iesId, f.inicio, f.fim, f.semestre, folhaId],
    'get_gestor_engajamento_questoes_alunos',
    { ...periodo(f), p_semestre: f.semestre, p_folha_id: folhaId },
    f.iesId !== null && folhaId !== null,
    false,
  );
}

/** Aba Conteúdos inteira, exceto o pop-up (§8.7). `p_tipo` é o valor do banco (`todos`/`video`/`document`). */
export function useEngajamentoConteudos(f: FiltrosRecorteEngajamento): ResultadoGestor<ConteudosEngajamento> {
  return useEnvelope<ConteudosEngajamento>(
    ['gestor', 'engajamento', 'conteudos', f.iesId, f.inicio, f.fim, f.semestre, f.tipo],
    'get_gestor_engajamento_conteudos',
    { ...periodo(f), p_semestre: f.semestre, p_tipo: f.tipo },
    f.iesId !== null,
  );
}

/**
 * Pop-up de um conteúdo (§8.8). A chave do nó é o trio
 * (`content_id`, `especialidade`, `modulo`), igual ao da gaveta. `null` = pop-up fechado.
 */
export function useEngajamentoConteudoAlunos(
  f: FiltrosRecorteEngajamento,
  conteudo: ChaveConteudo | null,
): ResultadoGestor<ConteudoAlunosEngajamento> {
  return useEnvelope<ConteudoAlunosEngajamento>(
    [
      'gestor', 'engajamento', 'conteudo-alunos',
      f.iesId, f.inicio, f.fim, f.semestre,
      conteudo?.content_id ?? null, conteudo?.especialidade ?? null, conteudo?.modulo ?? null,
    ],
    'get_gestor_engajamento_conteudo_alunos',
    {
      ...periodo(f),
      p_semestre: f.semestre,
      p_content_id: conteudo?.content_id ?? null,
      p_especialidade: conteudo?.especialidade ?? null,
      p_modulo: conteudo?.modulo ?? null,
    },
    f.iesId !== null && conteudo !== null,
    false,
  );
}

function exigirIes(f: FiltrosRecorteEngajamento, rpc: string): void {
  if (f.iesId === null) throw new Error(`${rpc}: IES não resolvida`);
}

/**
 * "Exportar base de alunos (CSV)" (§8.9): mesmos filtros e ordem da tabela, sem
 * paginação e com e-mail. Função assíncrona, não hook: roda no clique. O chamador
 * só a usa quando `contexto.podeExportar`.
 */
export async function buscarExportAlunos(
  f: FiltrosRecorteEngajamento,
  ordem: OrdemAlunos,
  direcao: DirecaoOrdem,
  busca: string,
  sem14: boolean,
): Promise<LinhaExportAluno[]> {
  const rpc = 'get_gestor_engajamento_export_alunos';
  exigirIes(f, rpc);
  const { data } = await chamarRpcGestor<ExportAlunosEngajamento>(rpc, {
    ...periodo(f),
    p_semestre: f.semestre,
    p_ordem: ordem,
    p_direcao: direcao,
    p_busca: buscaOuNull(busca),
    p_sem_atividade_14d: sem14,
  });
  return data.alunos;
}

/**
 * Lista completa de uma categoria para o "Exportar CSV" dos pop-ups (§8.3 com
 * `p_page_size = 5000`). Função assíncrona, não hook.
 */
export async function buscarListaCompleta(
  f: FiltrosRecorteEngajamento,
  categoria: CategoriaLista,
  busca: string,
): Promise<ListaEngajamento> {
  const rpc = 'get_gestor_engajamento_lista';
  exigirIes(f, rpc);
  const { data } = await chamarRpcGestor<ListaEngajamento>(rpc, {
    ...periodo(f),
    p_semestre: f.semestre,
    p_aluno: f.alunoId,
    p_categoria: categoria,
    p_busca: buscaOuNull(busca),
    p_page: 1,
    p_page_size: PAGE_SIZE_EXPORTACAO,
  });
  return data;
}

/** A tela consulta a versão dos dados a cada 2 min (refresh incremental, Fase 5). */
export const INTERVALO_VERSAO_ENGAJAMENTO_MS = 120_000;

/** Posição do bloco na `queryKey` `['gestor', <user.id>, 'engajamento', <bloco>, …]`. */
const POSICAO_BLOCO = 3;
const BLOCO_VERSAO = 'versao';

/**
 * Mantém a tela do Engajamento em dia sem recarregar (refresh incremental, Fase 5).
 *
 * O pipeline atualiza as `eng_*` a cada 5 min. Este hook pergunta, a cada 2 min e só com a aba visível, qual é a
 * versão dos dados (`get_gestor_engajamento_versao`, uma chamada barata). Quando `versao` (a maior carga de fonte
 * lida) muda em relação ao que a tela já viu, invalida todas as consultas do Engajamento: as que estão na tela são
 * refeitas e as outras ficam velhas para a próxima visita. A consulta de versão NÃO se invalida a si mesma.
 *
 * Por que `versao` e não `atualizadoEm` (o selo): `atualizadoEm` é o MENOR entre as fontes e só anda quando o
 * consumo carrega (de hora em hora); as questões entram a cada 5 min. Achado no QA da Fase 5: comparando
 * `atualizadoEm`, a tela só se atualizaria sozinha 1x por hora. Se a RPC não trouxer `versao` (versão antiga),
 * cai para `atualizadoEm`.
 *
 * A primeira versão lida só é memorizada: os dados da tela acabaram de ser buscados e não há o que refazer.
 * Usado uma vez, em `EngajamentoLayout`. Cada IES tem a sua versão, então a referência zera ao trocar de IES.
 */
export function useEngajamentoVersao(iesId: string | null): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: ['gestor', userId, 'engajamento', BLOCO_VERSAO, iesId],
    queryFn: () => chamarRpcGestor<VersaoEngajamento>('get_gestor_engajamento_versao', { p_ies_id: iesId }),
    enabled: iesId !== null && userId !== undefined,
    refetchInterval: INTERVALO_VERSAO_ENGAJAMENTO_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // `versao` é o sinal; `atualizadoEm` só entra como reserva se a RPC não trouxer `versao`
  const resposta = data?.data;
  const versao = resposta === undefined ? undefined : (resposta.versao ?? resposta.atualizadoEm);
  const visto = useRef<{ iesId: string | null; valor: string | null | undefined }>({ iesId: null, valor: undefined });

  useEffect(() => {
    if (versao === undefined) return; // ainda sem resposta
    const anterior = visto.current;
    visto.current = { iesId, valor: versao };
    if (anterior.iesId !== iesId || anterior.valor === undefined) return; // primeira leitura desta IES
    if (anterior.valor === versao) return;
    void queryClient.invalidateQueries({
      queryKey: ['gestor', userId, 'engajamento'],
      predicate: (q) => q.queryKey[POSICAO_BLOCO] !== BLOCO_VERSAO,
    });
  }, [versao, iesId, queryClient, userId]);
}
