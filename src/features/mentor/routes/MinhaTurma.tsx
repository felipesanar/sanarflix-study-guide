import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchMentorContexto } from '@/services/mentor/contexto';
import { fetchTurma, type AlunoTurma, type Segmento } from '@/services/mentor/turma';
import { fetchDesempenhoTurma, type AlunoDesempenho, type SituacaoMeta } from '@/services/mentor/desempenho';
import { DrawerAlunoMentor } from '@/features/mentor/components/DrawerAlunoMentor';
import { EstadoErro } from '@/features/mentor/components/turma/EstadoErro';
import { SeletorSimuladosMentor } from '@/features/mentor/components/SeletorSimuladosMentor';
import {
  ALERTA_ROTULO,
  SITUACAO_CLASSE,
  SITUACAO_ROTULO,
  ehAlertaFiltro,
  formatPct,
  formatPp,
  opcoesSimulados,
  passaAlerta,
  temDadosSimulado,
  type OpcaoSimulado,
} from '@/features/mentor/components/turma/simulados';
import {
  SEGMENTOS_HISTORICO,
  SEGMENTO_HISTORICO_ROTULO,
  contarSegmentosHistorico,
  escolherSimuladosDosCards,
  resumoPorSimulado,
  segmentoHistorico,
  semNotaNoSimulado,
  type ResumoSimulado,
  type SegmentoHistorico,
} from '@/features/mentor/components/turma/resumo';
import {
  SEGMENTOS,
  SEGMENTO_CLASSE,
  SEGMENTO_ETIQUETA,
  SEGMENTO_PLURAL,
  ehSegmento,
  formatDataCalendario,
  formatSemestre,
  formatUltimoAcesso,
  nomeOuEmail,
} from '@/features/mentor/components/turma/util';

type FiltroSegmento = Segmento | 'todos';
type FiltroHistorico = SegmentoHistorico | 'todos';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Mais tempo sem acesso primeiro; "sem dado" (nulo) depois, por nome. */
function comparar(a: AlunoTurma, b: AlunoTurma): number {
  const da = a.dias_sem_atividade ?? -1;
  const db = b.dias_sem_atividade ?? -1;
  if (da !== db) return db - da;
  return nomeOuEmail(a).localeCompare(nomeOuEmail(b), 'pt-BR');
}

const CardResumo: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div className="space-y-1 rounded-xl border bg-card p-4">
    <p className="text-sm text-muted-foreground">{titulo}</p>
    {children}
  </div>
);

interface LinhaCard {
  chave: 'atual' | 'anterior' | 'primeiro';
  rotulo: string;
  valor: string;
  detalhe?: string;
}

/** Card com evolução: o Atual em destaque e Anterior / Primeiro como linhas menores. */
const CardEvolucao: React.FC<{
  titulo: string;
  testId: string;
  linhas: LinhaCard[];
  children?: React.ReactNode;
}> = ({ titulo, testId, linhas, children }) => {
  const atual = linhas.find((l) => l.chave === 'atual');
  const demais = linhas.filter((l) => l.chave !== 'atual');
  return (
    <div className="space-y-1 rounded-xl border bg-card p-4" data-testid={testId}>
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="text-3xl font-semibold" data-testid={`${testId}-atual`}>
        {atual?.valor ?? '–'}
      </p>
      {atual && <p className="text-xs text-muted-foreground">{atual.rotulo}</p>}
      {atual?.detalhe && <p className="text-xs text-muted-foreground">{atual.detalhe}</p>}
      {demais.map((l) => (
        <p
          key={l.chave}
          className="flex justify-between gap-2 border-t pt-1 text-xs text-muted-foreground"
          data-testid={`${testId}-${l.chave}`}
        >
          <span>{l.rotulo}</span>
          <span className="font-medium text-foreground">
            {l.valor}
            {l.detalhe ? <span className="font-normal text-muted-foreground"> · {l.detalhe}</span> : null}
          </span>
        </p>
      ))}
      {children}
    </div>
  );
};

const classeChip = (ativo: boolean) =>
  cn(
    'rounded-full px-3 py-1 text-sm',
    ativo ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
  );

/** Meta (corte mais difícil), % por simulado ("–" quando ausente, nunca 0) e distância ao corte. */
const CelulasSimulado: React.FC<{ d: AlunoDesempenho | undefined; colunas: OpcaoSimulado[] }> = ({ d, colunas }) => {
  const situacao: SituacaoMeta = d?.situacao ?? 'sem_simulado';
  return (
    <>
      <td className="px-3 py-2 text-muted-foreground">
        {d?.corte_mais_dificil != null ? formatPct(d.corte_mais_dificil) : 'Sem meta'}
      </td>
      {colunas.map((c) => {
        const nota = (d?.notas ?? []).find((n) => n.simulado_id === c.id);
        return (
          <td key={c.id} className={cn('px-3 py-2', !nota && 'text-muted-foreground')}>
            {nota ? formatPct(nota.acerto_pct) : '–'}
          </td>
        );
      })}
      <td className="px-3 py-2">
        <span>{d?.vs_corte_pp != null ? formatPp(d.vs_corte_pp) : '–'}</span>{' '}
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', SITUACAO_CLASSE[situacao])}>
          {SITUACAO_ROTULO[situacao]}
        </span>
      </td>
    </>
  );
};

/** Minha Turma (b2c) / Visão Geral (b2b) — tela 02b. */
const MinhaTurma: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const contexto = useQuery({ queryKey: ['mentor', 'contexto'], queryFn: fetchMentorContexto });
  const turma = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  const titulo = contexto.data?.mentor?.tipo === 'b2b' ? 'Visão Geral' : 'Minha Turma';

  const filtroParam = params.get('filtro');
  const filtroDaHome: Segmento | null = ehSegmento(filtroParam) ? filtroParam : null;
  const alertaParam = ehAlertaFiltro(filtroParam) ? filtroParam : null;
  // Escolha feita nesta tela; enquanto indefinida vale o filtro que veio da home.
  const [escolhido, setEscolhido] = React.useState<FiltroSegmento | undefined>(undefined);
  const filtro: FiltroSegmento = escolhido ?? filtroDaHome ?? 'todos';
  const [busca, setBusca] = React.useState('');
  const [historico, setHistorico] = React.useState<FiltroHistorico>('todos');
  const [soNaoFizeram, setSoNaoFizeram] = React.useState(false);
  const [simuladosSel, setSimuladosSel] = React.useState<string[]>([]);
  const emailAberto = params.get('aluno');

  const atualizarParams = (alterar: (p: URLSearchParams) => void) =>
    setParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        alterar(proximo);
        return proximo;
      },
      { replace: true },
    );

  const escolherSegmento = (valor: FiltroSegmento) => {
    setEscolhido(valor);
    if (ehSegmento(params.get('filtro'))) atualizarParams((p) => p.delete('filtro'));
  };

  const removerChip = () => {
    setEscolhido('todos');
    atualizarParams((p) => p.delete('filtro'));
  };

  const removerAlerta = () => atualizarParams((p) => p.delete('filtro'));

  const abrirAluno = (email: string) => atualizarParams((p) => p.set('aluno', email));
  const fecharAluno = () => atualizarParams((p) => p.delete('aluno'));

  // Simulados: a consulta "todos" define os chips; com seleção, re-consulta só esses.
  const todosSimulados = useQuery({
    queryKey: ['mentor', 'desempenho', 'todos'],
    queryFn: () => fetchDesempenhoTurma(),
  });
  const idsOrdenados = React.useMemo(() => [...simuladosSel].sort(), [simuladosSel]);
  const recortado = simuladosSel.length > 0;
  const escopo = useQuery({
    queryKey: ['mentor', 'desempenho', idsOrdenados],
    queryFn: () => fetchDesempenhoTurma(idsOrdenados),
    enabled: recortado,
    placeholderData: keepPreviousData,
  });
  const carregandoSimulados = todosSimulados.isLoading;
  const comDados = temDadosSimulado(todosSimulados.data);
  // Com o recorte ainda carregando (ou com erro) a tabela segue na tela com o que já se tem.
  const dados = recortado ? (escopo.data ?? todosSimulados.data) : todosSimulados.data;
  const atualizandoRecorte = recortado && escopo.isFetching;
  const opcoes = React.useMemo(() => opcoesSimulados(todosSimulados.data?.alunos ?? []), [todosSimulados.data]);
  const colunas = React.useMemo(
    () => (recortado ? opcoes.filter((o) => simuladosSel.includes(o.id)) : opcoes),
    [opcoes, recortado, simuladosSel],
  );
  const idsRecorte = React.useMemo(() => (recortado ? new Set(simuladosSel) : null), [recortado, simuladosSel]);
  const desempenhoPorEmail = React.useMemo(() => {
    const mapa = new Map<string, AlunoDesempenho>();
    for (const d of dados?.alunos ?? []) mapa.set(d.email.toLowerCase(), d);
    return mapa;
  }, [dados]);
  // Os alertas vindos da home (nao_fez/regrediu/estagnado) valem para a turma inteira:
  // são avaliados nos dados sem recorte, para não esvaziarem quando os chips mudam.
  const alertaPorEmail = React.useMemo(() => {
    const mapa = new Map<string, AlunoDesempenho>();
    for (const d of todosSimulados.data?.alunos ?? []) mapa.set(d.email.toLowerCase(), d);
    return mapa;
  }, [todosSimulados.data]);
  const alertaDaHome = comDados ? alertaParam : null;

  // Cards: Primeiro / Anterior / Atual dentro do recorte.
  const cards = React.useMemo(() => {
    if (!dados) return null;
    const escolha = escolherSimuladosDosCards(colunas, dados.alunos, dados.participacao_ultimo?.simulado_id);
    if (!escolha.atual) return null;
    const resumo = (o: OpcaoSimulado | null): ResumoSimulado | null =>
      o ? resumoPorSimulado(dados.alunos, o) : null;
    return {
      emAndamento: escolha.atual.emAndamento,
      atual: resumoPorSimulado(dados.alunos, escolha.atual.simulado),
      anterior: resumo(escolha.anterior),
      primeiro: resumo(escolha.primeiro),
      naoFizeram: semNotaNoSimulado(dados.alunos, escolha.atual.simulado.id).length,
    };
  }, [dados, colunas]);

  const alunos = React.useMemo(() => turma.data ?? [], [turma.data]);
  const contagem = React.useMemo(() => {
    const c: Record<Segmento, number> = { ativo: 0, esfriando: 0, sumido: 0, sem_dado: 0 };
    for (const a of alunos) c[a.segmento] += 1;
    return c;
  }, [alunos]);

  const segmentoDe = React.useCallback(
    (email: string) => segmentoHistorico(desempenhoPorEmail.get(email.toLowerCase()), idsRecorte),
    [desempenhoPorEmail, idsRecorte],
  );
  const contagemHistorico = React.useMemo(
    () => contarSegmentosHistorico(alunos.map((a) => desempenhoPorEmail.get(a.email.toLowerCase()) ?? { notas: [], corte_mais_dificil: null }), idsRecorte),
    [alunos, desempenhoPorEmail, idsRecorte],
  );
  const idAtual = cards?.atual.simulado.id ?? null;

  const visiveis = React.useMemo(() => {
    const termo = normalizar(busca);
    return alunos
      .filter((a) => filtro === 'todos' || a.segmento === filtro)
      .filter((a) => {
        if (!comDados) return true;
        if (historico !== 'todos' && segmentoDe(a.email) !== historico) return false;
        if (alertaDaHome && !passaAlerta(alertaPorEmail.get(a.email.toLowerCase()), alertaDaHome)) return false;
        if (soNaoFizeram && idAtual) {
          const d = desempenhoPorEmail.get(a.email.toLowerCase());
          if ((d?.notas ?? []).some((n) => n.simulado_id === idAtual)) return false;
        }
        return true;
      })
      .filter((a) => !termo || normalizar(`${a.nome ?? ''} ${a.email}`).includes(termo))
      .sort(comparar);
  }, [alunos, filtro, busca, comDados, historico, segmentoDe, alertaDaHome, alertaPorEmail, soNaoFizeram, idAtual, desempenhoPorEmail]);

  /** Média por simulado de quem fez: ausência ("–") nunca entra na conta. */
  const mediaPorSimulado = (id: string): number | null => {
    const notas = visiveis.flatMap((a) =>
      (desempenhoPorEmail.get(a.email.toLowerCase())?.notas ?? []).filter((n) => n.simulado_id === id),
    );
    return notas.length === 0 ? null : notas.reduce((t, n) => t + n.acerto_pct, 0) / notas.length;
  };
  const semMeta = (dados?.alunos ?? []).filter((d) => d.situacao === 'sem_meta').length;

  const linhasAprovacao: LinhaCard[] = [];
  const linhasAcerto: LinhaCard[] = [];
  const linhasParticipacao: LinhaCard[] = [];
  if (cards) {
    const rotulo = (chave: LinhaCard['chave'], r: ResumoSimulado) => {
      const base = `Simulado ${r.simulado.sequence_number}`;
      if (chave === 'atual') return `Atual: ${base}${cards.emAndamento ? ' · em andamento' : ''}`;
      return `${chave === 'anterior' ? 'Anterior' : 'Primeiro'}: ${base}`;
    };
    const partes: [LinhaCard['chave'], ResumoSimulado | null][] = [
      ['atual', cards.atual],
      ['anterior', cards.anterior],
      ['primeiro', cards.primeiro],
    ];
    for (const [chave, r] of partes) {
      if (!r) continue;
      linhasAprovacao.push({
        chave,
        rotulo: rotulo(chave, r),
        valor: r.possivelAprovacao !== null ? formatPct(r.possivelAprovacao) : '–',
      });
      linhasAcerto.push({
        chave,
        rotulo: rotulo(chave, r),
        valor: r.acertoMedio !== null ? formatPct(r.acertoMedio) : '–',
      });
      const { fizeram, total } = r.participacao;
      linhasParticipacao.push({
        chave,
        rotulo: rotulo(chave, r),
        valor: total > 0 ? formatPct((fizeram / total) * 100) : '–',
        detalhe: `fizeram ${fizeram} de ${total}`,
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{titulo}</h1>

      {carregandoSimulados ? (
        <Skeleton className="h-9 w-72" data-testid="simulados-carregando" />
      ) : comDados ? (
        <SeletorSimuladosMentor opcoes={opcoes} selecionados={simuladosSel} onChange={setSimuladosSel} />
      ) : todosSimulados.isError ? (
        <EstadoErro
          mensagem="Não foi possível carregar os simulados."
          onRetry={() => void todosSimulados.refetch()}
        />
      ) : (
        <div className="space-y-1">
          <select
            disabled
            aria-label="Filtro de simulados"
            className="h-9 rounded-md border bg-muted px-3 text-sm text-muted-foreground"
            defaultValue=""
          >
            <option value="">Simulados: nenhum disponível</option>
          </select>
          <p className="text-sm text-muted-foreground">
            Os simulados ainda não chegam aqui. Enquanto isso, a turma mostra cadastro e engajamento.
          </p>
        </div>
      )}
      {comDados && atualizandoRecorte && (
        <p className="text-sm text-muted-foreground">Carregando os simulados escolhidos…</p>
      )}
      {comDados && recortado && escopo.isError && (
        <EstadoErro
          mensagem="Não foi possível carregar os simulados escolhidos. A turma segue abaixo, sem o recorte nas colunas de corte."
          onRetry={() => void escopo.refetch()}
        />
      )}

      {turma.isLoading && <p className="text-sm text-muted-foreground">Carregando a turma…</p>}
      {turma.isError && (
        <EstadoErro mensagem="Não foi possível carregar a turma." onRetry={() => void turma.refetch()} />
      )}

      {turma.data && alunos.length === 0 && (
        <p className="text-muted-foreground">Sua turma ainda não tem alunos vinculados.</p>
      )}

      {turma.data && alunos.length > 0 && carregandoSimulados && (
        <div className="space-y-3" data-testid="turma-carregando">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      )}

      {turma.data && alunos.length > 0 && !carregandoSimulados && (
        <>
          {comDados ? (
            cards && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <CardEvolucao titulo="Possível aprovação" testId="card-aprovacao" linhas={linhasAprovacao}>
                  <p className="text-xs text-muted-foreground">
                    {semMeta > 0
                      ? `${semMeta} ${semMeta === 1 ? 'aluno sem meta precisa' : 'alunos sem meta precisam'} de Metas.`
                      : 'dos alunos com meta e simulado.'}
                  </p>
                </CardEvolucao>
                <CardEvolucao titulo="Acerto médio no último simulado" testId="card-acerto" linhas={linhasAcerto}>
                  <p className="text-xs text-muted-foreground">de quem fez</p>
                </CardEvolucao>
                <div className="space-y-1 rounded-xl border bg-card p-4" data-testid="card-questoes">
                  <p className="text-sm text-muted-foreground">Questões na semana</p>
                  <p className="text-3xl font-semibold">–</p>
                  <p className="text-xs text-muted-foreground">chega com os dados de engajamento</p>
                </div>
                <CardEvolucao titulo="Participação no último simulado" testId="card-participacao" linhas={linhasParticipacao}>
                  {cards.naoFizeram > 0 && (
                    <button
                      type="button"
                      className="text-sm text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        setSoNaoFizeram(true);
                        setHistorico('todos');
                      }}
                    >
                      Ver os {cards.naoFizeram} que não fizeram
                    </button>
                  )}
                </CardEvolucao>
              </div>
            )
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <CardResumo titulo="Ativos na semana">
                <p className="text-3xl font-semibold">{contagem.ativo}</p>
                <p className="text-xs text-muted-foreground">de {alunos.length}</p>
              </CardResumo>
              <CardResumo titulo="Sem acesso há 10+ dias">
                <p className="text-3xl font-semibold">{contagem.sumido}</p>
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-2 hover:underline"
                  onClick={() => escolherSegmento('sumido')}
                >
                  Ver quem sumiu
                </button>
              </CardResumo>
              <CardResumo titulo="Possível aprovação">
                <p className="text-3xl font-semibold">—</p>
                <p className="text-xs text-muted-foreground">Precisa de simulados e de Metas.</p>
              </CardResumo>
            </div>
          )}

          {comDados && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Segmentos por histórico">
              <span className="text-sm text-muted-foreground">Histórico:</span>
              {(['todos', ...SEGMENTOS_HISTORICO] as FiltroHistorico[]).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  aria-pressed={historico === seg}
                  onClick={() => setHistorico(seg)}
                  className={classeChip(historico === seg)}
                >
                  {seg === 'todos' ? 'Todos' : SEGMENTO_HISTORICO_ROTULO[seg]}{' '}
                  <span className="opacity-70">{seg === 'todos' ? alunos.length : contagemHistorico[seg]}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {comDados && <span className="text-sm text-muted-foreground">Engajamento:</span>}
            {(['todos', ...SEGMENTOS] as FiltroSegmento[]).map((seg) => {
              const ativo = filtro === seg;
              const rotulo = seg === 'todos' ? 'Todos' : SEGMENTO_PLURAL[seg];
              const qtd = seg === 'todos' ? alunos.length : contagem[seg];
              return (
                <button
                  key={seg}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => escolherSegmento(seg)}
                  className={classeChip(ativo)}
                >
                  {rotulo} <span className="opacity-70">{qtd}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              role="searchbox"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar aluno"
              className="max-w-xs"
            />
            {alertaDaHome && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                Filtro: {ALERTA_ROTULO[alertaDaHome]} (vindo da home)
                <button
                  type="button"
                  onClick={removerAlerta}
                  aria-label={`Remover filtro ${ALERTA_ROTULO[alertaDaHome]}`}
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
            {comDados && soNaoFizeram && cards && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                Filtro: não fizeram o Simulado {cards.atual.simulado.sequence_number}
                <button
                  type="button"
                  onClick={() => setSoNaoFizeram(false)}
                  aria-label="Remover filtro de quem não fez o simulado"
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
            {filtroDaHome && escolhido === undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                Filtro: {SEGMENTO_PLURAL[filtroDaHome]} (vindo da home)
                <button
                  type="button"
                  onClick={removerChip}
                  aria-label={`Remover filtro ${SEGMENTO_PLURAL[filtroDaHome]}`}
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aluno encontrado com esses filtros.</p>
          ) : (
            <div className={cn("overflow-x-auto rounded-xl border", atualizandoRecorte && "opacity-60")} aria-busy={atualizandoRecorte}>
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Aluno</th>
                    <th className="px-3 py-2 font-medium">Semestre · acesso até</th>
                    <th className="px-3 py-2 font-medium">Meta</th>
                    {comDados ? (
                      <>
                        {colunas.map((c) => (
                          <th key={c.id} className="px-3 py-2 font-medium">
                            Simulado {c.sequence_number}
                          </th>
                        ))}
                        <th className="px-3 py-2 font-medium">vs corte (p.p.)</th>
                      </>
                    ) : (
                      <th className="px-3 py-2 font-medium">Acerto</th>
                    )}
                    <th className="px-3 py-2 font-medium">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a) => (
                    <tr
                      key={a.email}
                      onClick={() => abrirAluno(a.email)}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirAluno(a.email);
                          }}
                          className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {nomeOuEmail(a)}
                        </button>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            SEGMENTO_CLASSE[a.segmento],
                          )}
                        >
                          {SEGMENTO_ETIQUETA[a.segmento]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatSemestre(a.semestre)} · {formatDataCalendario(a.acesso_ate)}
                      </td>
                      {comDados ? (
                        <CelulasSimulado d={desempenhoPorEmail.get(a.email.toLowerCase())} colunas={colunas} />
                      ) : (
                        <>
                          <td className="px-3 py-2 text-muted-foreground">Aguardando Metas</td>
                          <td className="px-3 py-2 text-muted-foreground">Sem dado</td>
                        </>
                      )}
                      <td className="px-3 py-2">{formatUltimoAcesso(a.dias_sem_atividade)}</td>
                    </tr>
                  ))}
                </tbody>
                {comDados && (
                  <tfoot className="border-t bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <td className="px-3 py-2 font-medium" colSpan={3}>
                        Média de quem fez
                      </td>
                      {colunas.map((c) => {
                        const media = mediaPorSimulado(c.id);
                        return (
                          <td key={c.id} className="px-3 py-2" data-testid={`media-${c.sequence_number}`}>
                            {media === null ? '–' : formatPct(media)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2" colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

      <DrawerAlunoMentor
        email={emailAberto}
        open={!!emailAberto}
        onOpenChange={(aberto) => {
          if (!aberto) fecharAluno();
        }}
      />
    </div>
  );
};

export default MinhaTurma;
