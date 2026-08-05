import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useAlunos } from '@/features/gestor/api/queries';
import { TRACO, formatNumero, rotuloGrupo } from '@/features/gestor/lib/formatters';
import type { FiltrosGestor, Tendencia } from '@/features/gestor/api/types';

export interface TabelaAlunosProps {
  recorte: FiltrosGestor;
  colunasSimulados: { id: string; nome: string }[];
}

const TAMANHO_PAGINA = 25;
const DEBOUNCE_BUSCA_MS = 300;

/** Rótulo pt-BR da tendência (spec §4.11) — só usado nesta tabela. */
const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  subindo: 'Subindo',
  descendo: 'Descendo',
  alternando: 'Alternando',
  estavel: 'Estável',
};

function IconeTendencia({ tendencia }: { tendencia: Tendencia }) {
  if (tendencia === 'subindo') return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (tendencia === 'descendo') return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (tendencia === 'alternando') return <Repeat className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />;
}

/**
 * Tabela de alunos ao fim da Visão Geral (spec §4.8): busca, tag do grupo ao
 * lado do nome, proficiência por simulado, tendência e paginação NO SERVIDOR
 * (a RPC `get_gestor_alunos` já pagina — nada de virtualizar no cliente,
 * decisão registrada na Task 59.5).
 *
 * Uma única coluna de escala 0–100 por simulado, rotulada Proficiência —
 * nenhuma coluna "Nota TRI" (§4.1, caso crítico nº2). O corte de proficiente
 * (60) não aparece aqui: quem decide é `lib/regras.ts`, via o `grupo` e a
 * `tendencia` que o servidor já manda calculados.
 */
export function TabelaAlunos({ recorte, colunasSimulados }: TabelaAlunosProps) {
  const [busca, setBusca] = React.useState('');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [alunoAberto, setAlunoAberto] = React.useState<{ id: string; nome: string } | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(busca.trim());
      setPage(1);
    }, DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const consulta = useAlunos(recorte, {
    page,
    pageSize: TAMANHO_PAGINA,
    sort: 'nome',
    order: 'asc',
    q,
  });

  const pagina = consulta.data;
  const linhas = pagina?.data ?? [];
  const totalPaginas = pagina?.totalPages ?? 0;
  const simuladosIds = colunasSimulados.map((coluna) => coluna.id);

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

  return (
    <section
      data-testid="bloco-tabela-alunos"
      aria-labelledby="titulo-tabela-alunos"
      className="space-y-3"
      aria-busy={emTransicao}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-tabela-alunos" className="text-sm font-semibold text-foreground">
            Alunos
          </h2>
          <p className="text-xs text-muted-foreground">
            Proficiência por simulado. Ausência aparece como {TRACO} e fica fora de toda média.
          </p>
        </div>
        <Input
          type="search"
          role="searchbox"
          aria-label="Buscar aluno"
          placeholder="Buscar aluno"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          className="w-full max-w-xs"
        />
      </div>

      {emTransicao ? (
        <p
          data-testid="faixa-transicao-alunos"
          role="status"
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          Atualizando a lista. Os alunos abaixo ainda são do recorte anterior.
        </p>
      ) : null}

      {semIesResolvida || consulta.isLoading ? (
        <div className="space-y-2">
          <GestorSkeleton altura={40} rotulo="Carregando alunos" />
          <GestorSkeleton altura={40} rotulo="Carregando alunos" />
          <GestorSkeleton altura={40} rotulo="Carregando alunos" />
        </div>
      ) : consulta.isError ? (
        <EstadoErro
          descricao="Não foi possível carregar a lista de alunos."
          onRetry={() => consulta.refetch()}
        />
      ) : linhas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum aluno encontrado neste recorte."
          descricao="Ajuste a busca ou o recorte de semestre/IES."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Semestre</TableHead>
                  {colunasSimulados.map((coluna) => (
                    <TableHead key={coluna.id}>{coluna.nome}</TableHead>
                  ))}
                  <TableHead>Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => {
                  return (
                    <TableRow key={linha.id}>
                      <TableCell data-testid={`celula-nome-${linha.id}`}>
                        <span className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAlunoAberto({ id: linha.id, nome: linha.nome })}
                            className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {linha.nome}
                          </button>
                          {linha.grupo === null ? (
                            <span className="text-xs text-muted-foreground">{TRACO}</span>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {rotuloGrupo(linha.grupo)}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`semestre-${linha.id}`} className="tabular-nums">
                        {linha.semestre === null ? TRACO : `${linha.semestre}º`}
                      </TableCell>
                      {colunasSimulados.map((coluna) => {
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
                         * cobria esse caso, e por isso saiu: uma coluna sem
                         * entrada correspondente mostra TRAÇO só NAQUELA
                         * célula, nunca a linha inteira (migration
                         * 20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql).
                         */
                        const entrada = linha.proficiencias.find((p) => p.simuladoId === coluna.id);
                        return (
                          <TableCell
                            key={coluna.id}
                            data-testid={`prof-${linha.id}-${coluna.id}`}
                            className="tabular-nums"
                          >
                            {formatNumero(entrada?.valor ?? null)}
                          </TableCell>
                        );
                      })}
                      <TableCell data-testid={`tendencia-${linha.id}`}>
                        <span className="inline-flex items-center gap-1 text-xs">
                          <IconeTendencia tendencia={linha.tendencia} />
                          {ROTULO_TENDENCIA[linha.tendencia]}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <nav aria-label="Paginação de alunos" className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Página {pagina?.page ?? 1} de {totalPaginas} · {pagina?.total ?? 0} alunos
            </span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Página anterior"
                disabled={(pagina?.page ?? 1) <= 1}
                onClick={() => setPage((atual) => Math.max(1, atual - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Próxima página"
                disabled={(pagina?.page ?? 1) >= totalPaginas}
                onClick={() => setPage((atual) => atual + 1)}
              >
                Próxima
              </Button>
            </span>
          </nav>
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
