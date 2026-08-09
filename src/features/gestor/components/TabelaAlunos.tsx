import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { prefetchAluno, prefetchProximaPaginaAlunos } from '@/features/gestor/api/prefetch';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
  LinhasSkeleton,
  PAR_GRUPO,
  Paginacao,
  RodapeTabela,
  TabelaGestor,
  TagGrupo,
  TagTendencia,
  type OrdemTabela,
} from '@/features/gestor/components/tabela';
import { useAlunos } from '@/features/gestor/api/queries';
import { rotuloGrupo } from '@/features/gestor/lib/rotulos';
import { TRACO, formatNumero } from '@/features/gestor/lib/formatters';
import type { FiltrosGestor, GrupoEvolucao, VisaoGeral } from '@/features/gestor/api/types';

export interface TabelaAlunosProps {
  recorte: FiltrosGestor;
  colunasSimulados: { id: string; nome: string }[];
  /**
   * Contagem por grupo de evolução, para os chips de filtro — o MESMO dado
   * que a Visão de Alunos já mostra em cima (`get_gestor_visao_geral`, sem
   * consulta própria). Ausente = os chips não aparecem: uso isolado deste
   * componente (ex.: teste) continua funcionando como uma tabela sem filtro.
   */
  distribuicaoGrupos?: VisaoGeral['distribuicaoAlunos'];
}

/** Mesma ordem de exibição de `VisaoDeAlunos` — não é ordem alfabética nem a do banco. */
const ORDEM_GRUPO: GrupoEvolucao[] = [
  'consistentemente_proficiente',
  'em_variacao',
  'consistentemente_nao_proficiente',
];

/**
 * Chips "Todos / [3 grupos]" com contagem (retomada da versão anterior do
 * portal, pedido de 07/08). Filtra a tabela pelo MESMO grupo que a tag da
 * linha já pinta — a bolinha do chip usa o par de cor de `TagGrupo`
 * (`PAR_GRUPO`), então o chip verde é sempre o mesmo grupo que a tag verde.
 *
 * O clique muda o RECORTE (`p_grupo` em `get_gestor_alunos`), não um filtro
 * de cliente sobre a página carregada — com 590 alunos numa IES e 25 por
 * página, filtrar no cliente devolveria "0 resultados" sempre que o grupo
 * escolhido não estivesse entre os 25 primeiros por nome.
 */
function FiltroGrupoAlunos({
  distribuicao,
  ativo,
  onSelecionar,
}: {
  distribuicao: VisaoGeral['distribuicaoAlunos'];
  ativo: GrupoEvolucao | null;
  onSelecionar: (grupo: GrupoEvolucao | null) => void;
}) {
  const porGrupo = new Map(distribuicao.map((item) => [item.grupo, item.quantidade]));
  const totalTodos = ORDEM_GRUPO.reduce((soma, grupo) => soma + (porGrupo.get(grupo) ?? 0), 0);

  const Chip = ({
    selecionado,
    rotulo,
    contagem,
    corBolinha,
    onClick,
  }: {
    selecionado: boolean;
    rotulo: string;
    contagem: number;
    corBolinha?: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full',
        // Comportamento 13 (spec de motion, Parte IV §11 — "pílula/chip"):
        // `scale(0.96)` no press, 80ms. Propriedades explícitas na lista
        // (`transition-[...]`), nunca as classes arbitrárias curtas de duração
        // ou curva do Tailwind — guard de `tema.test.tsx` reprova essa forma
        // ambígua; a duração/curva de cada propriedade vem por `style` abaixo.
        'transition-[color,background-color,border-color,transform] active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      style={{
        padding: '5px 12px 5px 10px',
        fontSize: 12,
        fontWeight: selecionado ? 600 : 500,
        border: `1.5px solid ${selecionado ? 'var(--gp-text-1)' : 'var(--gp-border-strong)'}`,
        color: selecionado ? 'var(--gp-text-1)' : 'var(--gp-text-2)',
        background: selecionado ? 'var(--gp-surface-2)' : 'var(--gp-surface-1)',
        transitionDuration: 'var(--gp-motion-3), var(--gp-motion-3), var(--gp-motion-3), var(--gp-motion-1)',
        transitionTimingFunction: 'var(--gp-ease)',
      }}
    >
      {corBolinha ? (
        <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ background: corBolinha }} />
      ) : null}
      {rotulo}
      <span
        style={{
          fontFamily: FONTE_MONO,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 11,
          color: 'var(--gp-text-3)',
        }}
      >
        {contagem}
      </span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Filtrar alunos por grupo de evolução"
      className="flex flex-wrap items-center gap-2"
      data-testid="filtro-grupo-alunos"
    >
      <Chip selecionado={ativo === null} rotulo="Todos" contagem={totalTodos} onClick={() => onSelecionar(null)} />
      {ORDEM_GRUPO.map((grupo) => (
        <Chip
          key={grupo}
          selecionado={ativo === grupo}
          rotulo={rotuloGrupo(grupo)}
          contagem={porGrupo.get(grupo) ?? 0}
          corBolinha={String(PAR_GRUPO[grupo].color)}
          onClick={() => onSelecionar(ativo === grupo ? null : grupo)}
        />
      ))}
    </div>
  );
}

const TAMANHO_PAGINA = 25;
const DEBOUNCE_BUSCA_MS = 300;
const COLUNAS_VISIVEIS = 4;

/**
 * Colunas ordenáveis. O conjunto NÃO é escolha de UI: é a whitelist da RPC
 * (`get_gestor_alunos`, `v_sort NOT IN ('nome','semestre','proficiencia',
 * 'tendencia') RAISE 'sort_invalido'`). Mandar qualquer outro valor derruba a
 * consulta inteira — foi assim que o bloco de questões ficou permanentemente
 * vazio antes (ver `sortQuestoesParaRpc` em api/queries.ts).
 */
type ColunaAlunos = 'nome' | 'semestre' | 'proficiencia' | 'tendencia';

interface Ordenacao {
  coluna: ColunaAlunos;
  ordem: OrdemTabela;
}

/**
 * Tabela de alunos ao fim da Visão Geral (handoff §4.8 e §6).
 *
 * Quatro colunas, como a referência: Aluno (+ tag do grupo) · Semestre ·
 * Proficiência por simulado · Classificação. A proficiência de N simulados
 * vive numa CÉLULA só (`52 · 58 · 64`), não em N colunas — com os 7 simulados
 * contratados a versão anterior chegava a 10 colunas. Nada se perde: cada
 * valor continua casado por `simuladoId` e endereçável por `data-testid`.
 *
 * Paginação e ordenação são NO SERVIDOR (a RPC já faz as duas) — nada de
 * virtualizar no cliente: a página nunca passa de 25 linhas no DOM.
 *
 * Uma única coluna de escala 0–100 por simulado, rotulada Proficiência —
 * nenhuma coluna "Nota TRI" (§4.1, caso crítico nº2). O corte de proficiente
 * não aparece aqui: quem decide é `lib/regras.ts`, via o `grupo` e a
 * `tendencia` que o servidor já manda calculados.
 */
export function TabelaAlunos({ recorte, colunasSimulados, distribuicaoGrupos }: TabelaAlunosProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [busca, setBusca] = React.useState('');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [grupoAtivo, setGrupoAtivo] = React.useState<GrupoEvolucao | null>(null);
  const [ordenacao, setOrdenacao] = React.useState<Ordenacao>({ coluna: 'nome', ordem: 'asc' });
  const [alunoAberto, setAlunoAberto] = React.useState<{ id: string; nome: string } | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(busca.trim());
      setPage(1);
    }, DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  /**
   * Trocar de IES ou de semestre volta para a página 1.
   *
   * `page` é estado LOCAL e sobrevivia à troca de recorte: quem estava na
   * página 3 de uma IES grande e trocava para uma IES de 40 alunos pedia
   * `p_page: 3` de uma lista de 2 páginas. `get_gestor_alunos` ecoa a página
   * pedida sem clampar e devolve `data: []` — a tela então afirmava "Nenhum
   * aluno encontrado neste recorte" para uma IES cheia de alunos, e o rodapé
   * (única saída) nem era renderizado no ramo vazio.
   *
   * `recorte.simulados` fica FORA das dependências de propósito: é um array
   * remontado a cada render do pai, e incluí-lo resetaria a página a cada
   * render.
   */
  React.useEffect(() => {
    setPage(1);
  }, [recorte.iesId, recorte.semestre]);

  /** Trocar de chip de grupo também volta para a página 1, pelo mesmo motivo. */
  const selecionarGrupo = (grupo: GrupoEvolucao | null) => {
    setGrupoAtivo(grupo);
    setPage(1);
  };

  const consulta = useAlunos(recorte, {
    page,
    pageSize: TAMANHO_PAGINA,
    sort: ordenacao.coluna,
    order: ordenacao.ordem,
    q,
    grupo: grupoAtivo,
  });

  const pagina = consulta.data;
  const linhas = pagina?.data ?? [];
  const totalPaginas = pagina?.totalPages ?? 0;
  const simuladosIds = colunasSimulados.map((coluna) => coluna.id);

  /**
   * Prefetch no hover de linha (spec de motion, Parte VIII §22): "hover na
   * linha de aluno → prefetch do detalhe, com 150ms de atraso, para não
   * disparar em varredura". Um único timeout (não um por linha): o mouse só
   * pode estar sobre UMA linha por vez, e uma varredura rápida dispara
   * `onMouseLeave` antes do timeout de 150ms da linha anterior vencer,
   * cancelando-o — o prefetch só chega a rodar quando o cursor PARA sobre
   * uma linha por tempo suficiente.
   */
  const timeoutPrefetchAlunoRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => () => clearTimeout(timeoutPrefetchAlunoRef.current), []);

  /**
   * Prefetch é best-effort por definição (spec §22: "a fluidez invisível") —
   * uma falha aqui NUNCA pode ser visível ao gestor nem derrubar a tela: o
   * clique de verdade ainda busca o dado do jeito normal, só sem o cache
   * aquecido. `try/catch` porque `prefetchAluno`/`prefetchProximaPaginaAlunos`
   * podem lançar de forma SÍNCRONA (antes de qualquer Promise existir) se
   * `queryClient` estiver num estado inesperado; `.catch()` cobre a rejeição
   * ASSÍNCRONA normal (RPC falhou, rede caiu).
   */
  const aquecerComSeguranca = (prefetch: () => Promise<void>) => {
    try {
      prefetch().catch(() => undefined);
    } catch {
      // Silencioso de propósito — ver comentário acima.
    }
  };

  const agendarPrefetchAluno = (alunoId: string) => {
    clearTimeout(timeoutPrefetchAlunoRef.current);
    timeoutPrefetchAlunoRef.current = setTimeout(() => {
      aquecerComSeguranca(() => prefetchAluno(queryClient, user?.id, recorte.iesId, alunoId, simuladosIds));
    }, 150);
  };

  const cancelarPrefetchAluno = () => clearTimeout(timeoutPrefetchAlunoRef.current);

  /**
   * Prefetch no hover da próxima página (mesmo §22 — "hover na página
   * seguinte da paginação → prefetch daquela página"), repassado como
   * `onHoverProximaPagina` para o `Paginacao` compartilhado. `recorte.iesId`
   * pode ser `null` só enquanto o contexto ainda resolve a IES — nesse
   * estado a própria `useAlunos` já está `enabled: false` e não há página
   * seguinte de verdade para aquecer.
   */
  const aquecerProximaPagina = (proximaPagina: number) => {
    if (recorte.iesId === null) return;
    const iesId = recorte.iesId;
    aquecerComSeguranca(() =>
      prefetchProximaPaginaAlunos(
        queryClient,
        user?.id,
        iesId,
        recorte.semestre,
        proximaPagina,
        TAMANHO_PAGINA,
        ordenacao.coluna,
        ordenacao.ordem,
        q,
        grupoAtivo,
      ),
    );
  };

  /**
   * Trocar de coluna começa DESCENDENTE nas numéricas (a leitura que interessa
   * é "quem está pior/melhor primeiro") e ASCENDENTE no nome (A→Z). Reordenar
   * volta para a página 1: manter a página 7 de uma ordenação que acabou de
   * mudar mostraria um recorte que o gestor não pediu.
   */
  const alternarOrdenacao = (coluna: ColunaAlunos) => {
    setPage(1);
    setOrdenacao((atual) =>
      atual.coluna === coluna
        ? { coluna, ordem: atual.ordem === 'desc' ? 'asc' : 'desc' }
        : { coluna, ordem: coluna === 'nome' ? 'asc' : 'desc' },
    );
  };

  const ordemDe = (coluna: ColunaAlunos) => (ordenacao.coluna === coluna ? ordenacao.ordem : null);

  /**
   * `useAlunos` mantém o `placeholderData` ligado de propósito (o recorte de
   * IES/semestre/página/busca é filtro sobre a MESMA lista, não outro objeto),
   * então na troca de IES ou semestre esta tabela continua exibindo a lista
   * NOMINAL do recorte anterior com `isLoading: false` — alunos de uma IES sob
   * um seletor que já aponta outra, sem sinalização (cenário 1 da revisão de
   * 05/08). Aqui isso é mais grave que nos blocos agregados: são nomes de
   * pessoas. O dado velho não é escondido (piscar skeleton a cada tecla da
   * busca seria pior), mas é ANUNCIADO nos dois canais — `aria-busy` na seção
   * e faixa `role="status"` — e atenuado visualmente.
   *
   * `=== true` porque hooks mockados em teste podem não devolver o campo.
   */
  const emTransicao = consulta.isPlaceholderData === true;

  /**
   * Sem IES no recorte, `useAlunos` nasce `enabled: false` — e no React Query
   * v5 `isLoading` é `isPending && isFetching`, então uma query desabilitada
   * NUNCA passa por `isLoading`. Gateando o skeleton só em `consulta.isLoading`,
   * a cadeia caía direto no ramo `linhas.length === 0` e a tabela afirmava
   * "Nenhum aluno encontrado neste recorte" ANTES de qualquer requisição.
   *
   * Isso é alcançável pela rota real, não só em teste isolado: a Visão Geral
   * renderiza esta tabela incondicionalmente, e num acesso sem `?ies` na URL
   * (link colado, bookmark, F5 em `/gestor/visao-geral`) `iesAtivaId` fica nulo
   * enquanto `get_gestor_contexto` está em voo — os blocos de cima mostram
   * skeleton enquanto esta tabela já negava a existência de alunos. Mesma
   * classe dos achados 2 e 4 da revisão de 04/08, aqui no arquivo da tabela.
   */
  const semIesResolvida = recorte.iesId === null;
  const carregando = semIesResolvida || consulta.isLoading;

  return (
    <section
      data-testid="bloco-tabela-alunos"
      aria-labelledby="titulo-tabela-alunos"
      className="flex flex-col gap-4 p-6"
      aria-busy={emTransicao}
      style={{
        background: 'var(--gp-surface-1)',
        border: '1px solid var(--gp-border-strong)',
        borderRadius: 16,
        boxShadow: 'var(--gp-shadow-card)',
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-tabela-alunos" style={{ fontSize: 16, fontWeight: 700, color: 'var(--gp-text-1)' }}>
            Alunos
          </h2>
          <p style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>
            Proficiência por simulado. Ausência aparece como {TRACO} e fica fora de toda média.
          </p>
        </div>
        <div
          className="flex min-w-[220px] items-center gap-2 px-3"
          style={{
            border: '1px solid var(--gp-border-input)',
            borderRadius: 9,
            color: 'var(--gp-text-3)',
          }}
        >
          <Icon name="search" size={15} />
          <input
            type="search"
            aria-label="Buscar aluno"
            placeholder="Buscar aluno por nome…"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            className="h-8 w-full bg-transparent outline-none"
            style={{ fontSize: 12, color: 'var(--gp-text-1)' }}
          />
        </div>
      </div>

      {/* Retomada da versão anterior (pedido de 07/08): filtrar pelos grupos
          de evolução que a Visão de Alunos já resume acima. Sem
          `distribuicaoGrupos`, os chips simplesmente não aparecem — uso
          isolado deste componente continua sendo uma tabela sem filtro. */}
      {distribuicaoGrupos ? (
        <FiltroGrupoAlunos distribuicao={distribuicaoGrupos} ativo={grupoAtivo} onSelecionar={selecionarGrupo} />
      ) : null}

      {emTransicao ? (
        <p
          data-testid="faixa-transicao-alunos"
          role="status"
          className="px-3 py-2"
          style={{
            border: '1px solid var(--gp-border-strong)',
            borderRadius: 9,
            background: 'var(--gp-surface-2)',
            fontSize: 12,
            color: 'var(--gp-text-3)',
          }}
        >
          Atualizando a lista. Os alunos abaixo ainda são do recorte anterior.
        </p>
      ) : null}

      {consulta.isError ? (
        <EstadoErro
          descricao="Não foi possível carregar a lista de alunos."
          onRetry={() => consulta.refetch()}
        />
      ) : !carregando && linhas.length === 0 ? (
        <>
          <EstadoVazio
            titulo="Nenhum aluno encontrado neste recorte."
            descricao={
              grupoAtivo
                ? 'Ninguém neste grupo com a busca e o recorte atuais. Ajuste a busca, o grupo ou o recorte de semestre/IES.'
                : 'Ajuste a busca ou o recorte de semestre/IES.'
            }
          />
          {/*
            Lista vazia com `total > 0` significa que a PÁGINA saiu do
            intervalo, não que o recorte esteja vazio — a lista existe, só não
            nesta página. O rodapé é a única saída: sem ele o gestor fica preso
            num vazio que não é verdade, e o único jeito de voltar era digitar
            na busca ou recarregar a tela.
          */}
          {(pagina?.total ?? 0) > 0 ? (
            <RodapeTabela>
              <span style={{ fontFamily: FONTE_MONO, fontVariantNumeric: 'tabular-nums' }}>
                Mostrando 0 de {pagina?.total ?? 0}
              </span>
              <Paginacao
                className="ml-auto"
                rotulo="Paginação de alunos"
                page={pagina?.page ?? page}
                totalPages={totalPaginas}
                onPageChange={setPage}
                onHoverProximaPagina={aquecerProximaPagina}
              />
            </RodapeTabela>
          ) : null}
        </>
      ) : (
        <>
          {carregando ? (
            <p role="status" className="sr-only">
              Carregando alunos
            </p>
          ) : null}

          <TabelaGestor rotulo="Alunos do recorte">
            <CabecalhoTabela>
              <tr>
                <CelulaCabecalho ordem={ordemDe('nome')} onOrdenar={() => alternarOrdenacao('nome')}>
                  Aluno
                </CelulaCabecalho>
                <CelulaCabecalho
                  numerica
                  ordem={ordemDe('semestre')}
                  onOrdenar={() => alternarOrdenacao('semestre')}
                >
                  Semestre
                </CelulaCabecalho>
                <CelulaCabecalho
                  numerica
                  ordem={ordemDe('proficiencia')}
                  onOrdenar={() => alternarOrdenacao('proficiencia')}
                >
                  Proficiência por simulado
                </CelulaCabecalho>
                <CelulaCabecalho
                  ordem={ordemDe('tendencia')}
                  onOrdenar={() => alternarOrdenacao('tendencia')}
                >
                  Classificação
                </CelulaCabecalho>
              </tr>
            </CabecalhoTabela>
            <CorpoTabela>
              {carregando ? (
                <LinhasSkeleton colunas={COLUNAS_VISIVEIS} />
              ) : (
                linhas.map((linha, indice) => {
                  const selecionada = alunoAberto?.id === linha.id;
                  return (
                    <LinhaTabela
                      key={linha.id}
                      data-testid={`linha-aluno-${linha.id}`}
                      data-selecionado={String(selecionada)}
                      selecionada={selecionada}
                      ultima={indice === linhas.length - 1}
                      onSelecionar={() => setAlunoAberto({ id: linha.id, nome: linha.nome })}
                      onMouseEnter={() => agendarPrefetchAluno(linha.id)}
                      onMouseLeave={cancelarPrefetchAluno}
                    >
                      <Celula marcada={selecionada} data-testid={`celula-nome-${linha.id}`}>
                        <button
                          type="button"
                          title={linha.nome}
                          onClick={() => setAlunoAberto({ id: linha.id, nome: linha.nome })}
                          className="block max-w-[220px] truncate text-left"
                          style={{ color: 'var(--gp-text-1)', fontWeight: selecionada ? 700 : 400 }}
                        >
                          {linha.nome}
                        </button>
                        {/* Tag do grupo em segunda linha, como a referência —
                            inline ao lado do nome ela competia com o nome pela
                            largura da coluna mais estreita da tabela. */}
                        <div style={{ marginTop: 4 }}>
                          {linha.grupo === null ? (
                            <span style={{ fontSize: 10, color: 'var(--gp-text-3)' }}>{TRACO}</span>
                          ) : (
                            <TagGrupo grupo={linha.grupo} />
                          )}
                        </div>
                      </Celula>

                      <Celula
                        numerica
                        ausente={linha.semestre === null}
                        data-testid={`semestre-${linha.id}`}
                      >
                        {linha.semestre === null ? TRACO : `${linha.semestre}º`}
                      </Celula>

                      <Celula numerica data-testid={`proficiencias-${linha.id}`}>
                        {colunasSimulados.map((coluna, i) => {
                          /**
                           * Casa por `simuladoId`, nunca por posição — a causa
                           * raiz dos achados 1-4 da revisão de 03/08.
                           * `proficiencias` (get_gestor_alunos) e
                           * `colunasSimulados` (get_gestor_visao_geral, via
                           * `visao.evolucao`) vêm de recortes de simulados
                           * DIFERENTES: a visão geral filtra por semestre, esta
                           * RPC não. Casar por posição podia deslocar a nota de
                           * um simulado para a coluna de outro mesmo com os dois
                           * arrays do MESMO tamanho — o mitigador antigo (TRAÇO
                           * na linha inteira quando os TAMANHOS divergiam) nunca
                           * cobria esse caso, e por isso saiu: um simulado sem
                           * entrada correspondente mostra TRAÇO só NAQUELA
                           * posição, nunca a linha inteira (migration
                           * 20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql).
                           */
                          const entrada = linha.proficiencias.find((p) => p.simuladoId === coluna.id);
                          const valor = entrada?.valor ?? null;
                          return (
                            <React.Fragment key={coluna.id}>
                              {i > 0 ? <span aria-hidden="true"> · </span> : null}
                              {/* O `·` não diz a que simulado cada número
                                  pertence; quem lê por áudio precisa do nome. */}
                              <span className="sr-only">{coluna.nome}: </span>
                              <span
                                data-testid={`prof-${linha.id}-${coluna.id}`}
                                style={valor === null ? { color: 'var(--gp-text-3)' } : undefined}
                              >
                                {formatNumero(valor)}
                              </span>
                            </React.Fragment>
                          );
                        })}
                      </Celula>

                      <Celula data-testid={`tendencia-${linha.id}`}>
                        <TagTendencia tendencia={linha.tendencia} />
                      </Celula>
                    </LinhaTabela>
                  );
                })
              )}
            </CorpoTabela>
          </TabelaGestor>

          {/* Rodapé só depois do dado: "Mostrando 0 de 0" e uma página "1"
              durante o carregamento seriam números inventados (§4.10). */}
          {carregando ? null : (
            <RodapeTabela>
              <span style={{ fontFamily: FONTE_MONO, fontVariantNumeric: 'tabular-nums' }}>
                Mostrando {linhas.length} de {pagina?.total ?? 0}
              </span>
              <Paginacao
                className="ml-auto"
                rotulo="Paginação de alunos"
                page={pagina?.page ?? page}
                totalPages={totalPaginas}
                onPageChange={setPage}
                onHoverProximaPagina={aquecerProximaPagina}
              />
            </RodapeTabela>
          )}
        </>
      )}

      <DrawerAluno
        alunoId={alunoAberto?.id ?? null}
        nome={alunoAberto?.nome ?? ''}
        simulados={simuladosIds}
        onFechar={() => setAlunoAberto(null)}
      />
    </section>
  );
}
