import * as React from 'react';
import { motion } from 'framer-motion';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { Icon } from '@/features/gestor/components/Icon';
import { useAlunos } from '@/features/gestor/api/queries';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { FiltroSemestre } from '@/features/gestor/api/types';
import { TRACO } from '@/features/gestor/lib/rotulos';
import {
  chaveMovimento,
  detalheEmCache,
  obterDetalheMovimento,
  type DetalheMovimento,
  type PassoPlano,
} from '@/features/gestor/lib/cacheMovimento';
import {
  CORTE_PROFICIENCIA,
  DESCRITORES,
  inferirCriterio,
  inferirSemestreAlvo,
  projetarGanho,
  selecionarCoorte,
  type AlunoDaCoorte,
  type CriterioCoorte,
  type Projecao,
} from '@/features/gestor/lib/planoMovimento';


/**
 * Drawer de DETALHE de um movimento da Leitura estratégica.
 *
 * Responde as três perguntas que o cartão não cabe: quem são os alunos, como
 * executar e o que muda se executar. Divisão de responsabilidade igual à da
 * leitura: a IA escreve o texto e escolhe o CRITÉRIO da coorte; a lista de
 * alunos e a projeção saem de `get_gestor_alunos` aqui no cliente, com a conta
 * exibida na tela. Nenhum número inventado (regra 2 do handoff).
 */

export interface MovimentoSelecionado {
  titulo: string;
  metrica?: string;
  texto?: string;
  natureza?: string;
  prioridade?: 'alta' | 'media' | 'baixa';
}

export interface DrawerMovimentoProps {
  movimento: MovimentoSelecionado | null;
  escopo: 'recorte' | 'institucional';
  iesId: string | null;
  semestre: string | null;
  simulados: string[];
  onFechar: () => void;
}

/* `PassoPlano` e `DetalheMovimento` vivem em `lib/cacheMovimento` — o mesmo
   contrato usado pelo pré-carregamento em segundo plano. */



type Estado = 'loading' | 'sucesso' | 'erro';

const COR_PRIORIDADE: Record<string, string> = {
  alta: 'var(--gp-danger)',
  media: 'var(--gp-warning)',
  baixa: 'var(--gp-success)',
};

const ROTULO_PRIORIDADE: Record<string, string> = {
  alta: 'Prioridade alta',
  media: 'Prioridade média',
  baixa: 'Prioridade baixa',
};

const ETAPAS = [
  'Lendo o movimento…',
  'Separando os alunos do grupo…',
  'Montando o plano de execução…',
  'Calculando o cenário de melhora…',
];

function Etapas() {
  const [indice, setIndice] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setIndice((i) => Math.min(i + 1, ETAPAS.length - 1)), 1200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-1.5">
      {ETAPAS.slice(0, indice + 1).map((etapa, i) => {
        const atual = i === indice;
        return (
          <motion.p
            key={etapa}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: atual ? 1 : 0.45, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: atual ? 'var(--gp-text-2, inherit)' : 'var(--gp-text-3)' }}
          >
            {atual ? (
              <motion.span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: 'var(--gp-brand-on-dark)' }}
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            ) : (
              <Icon name="check" size={12} className="shrink-0 opacity-60" />
            )}
            <span className="min-w-0">{etapa}</span>
          </motion.p>
        );
      })}
    </div>
  );
}

/** Rótulo do recorte, para o gestor nunca ler um número sem saber de quem é. */
function rotuloSemestre(semestre: string | null): string {
  const chave = (semestre ?? '').trim().toLowerCase();
  if (!chave || chave === 'geral' || chave === 'todos') return 'Todos os semestres';
  if (chave === '6ano') return '6º ano (11º e 12º semestres)';
  const n = Number(chave.replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? `${n}º semestre` : chave;
}

function Secao({
  titulo,
  apoio,
  contagem,
  children,
}: {
  titulo: string;
  apoio?: string;
  contagem?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <h4
            className="uppercase"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}
          >
            {titulo}
          </h4>
          {contagem ? (
            <span
              className="rounded-full px-1.5 tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: 'var(--gp-surface-3)',
                color: 'var(--gp-brand-on-dark)',
              }}
            >
              {contagem}
            </span>
          ) : null}
          <span aria-hidden className="h-px flex-1" style={{ background: 'var(--gp-border)' }} />
        </div>
        {apoio ? (
          <p className="text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
            {apoio}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function LinhaAlunoCoorte({ aluno }: { aluno: AlunoDaCoorte }) {
  const cor =
    aluno.proficiencia === null
      ? 'var(--gp-text-3)'
      : aluno.proficiencia >= CORTE_PROFICIENCIA
        ? 'var(--gp-success)'
        : aluno.proficiencia >= 50
          ? 'var(--gp-warning)'
          : 'var(--gp-danger)';

  return (
    <li
      className="flex items-center gap-2.5 overflow-hidden rounded-lg border border-border py-2 pl-2.5 pr-2.5"
      style={{ background: 'var(--gp-surface-2)', boxShadow: 'inset 3px 0 0 0 ' + cor }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{aluno.nome}</p>
        <p className="mt-0.5 truncate" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
          {aluno.semestre === null ? 'Semestre não informado' : `${aluno.semestre}º semestre`}
          {aluno.proficiencia === null ? ' · TRI em calibração' : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold leading-none tabular-nums" style={{ color: cor }}>
          {aluno.proficiencia === null ? TRACO : formatNumero(aluno.proficiencia)}
        </p>
        {aluno.variacao !== null ? (
          <p
            className="mt-0.5 tabular-nums"
            style={{ fontSize: 10, color: aluno.variacao >= 0 ? 'var(--gp-success)' : 'var(--gp-danger)' }}
          >
            {aluno.variacao > 0 ? '+' : ''}
            {formatNumero(aluno.variacao)} pts
          </p>
        ) : null}
      </div>
    </li>
  );
}

function BlocoProjecao({ projecao }: { projecao: Projecao }) {
  const largura = Math.max(0, Math.min(100, projecao.depoisPct));
  const larguraHoje = Math.max(0, Math.min(100, projecao.antesPct));
  return (
    <div className="rounded-xl border border-border p-3.5" style={{ background: 'var(--gp-surface-2)' }}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}>
            Hoje
          </p>
          <p className="text-lg font-semibold leading-none tabular-nums" style={{ color: 'var(--gp-text-3)' }}>
            {formatPct(projecao.antesPct, 1)}
          </p>
        </div>
        <Icon name="arrow_forward" size={16} className="mb-1 shrink-0 opacity-50" />
        <div className="text-right">
          <p className="uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}>
            Se aplicar
          </p>
          <div className="flex items-end justify-end gap-1.5">
            <span className="text-[28px] font-bold leading-none tabular-nums text-foreground">
              {formatPct(projecao.depoisPct, 1)}
            </span>
            <span
              className="mb-0.5 text-sm font-semibold tabular-nums"
              style={{ color: projecao.deltaPp > 0 ? 'var(--gp-success)' : 'var(--gp-text-3)' }}
            >
              {projecao.deltaPp > 0 ? '+' : ''}
              {formatNumero(projecao.deltaPp)} p.p.
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="relative mt-3 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'var(--gp-surface-3)' }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${largura}%`, background: 'var(--gp-success)', opacity: 0.35 }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${larguraHoje}%`, background: 'var(--gp-brand-on-dark)' }}
        />
      </div>

      <p className="mt-2.5 text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
        Cenário conservador, não previsão. A conta: hoje {formatNumero(projecao.proficientesHoje)} de{' '}
        {formatNumero(projecao.base)} alunos com nota cruzam a faixa de {CORTE_PROFICIENCIA} pontos. O plano alcança{' '}
        {formatNumero(projecao.alvoIndicado)} alunos e a conta assume que só metade deles converte no ciclo, ou seja{' '}
        {formatNumero(projecao.alvo)} passando do corte — a proporção vai para {formatPct(projecao.depoisPct, 1)}.
      </p>

    </div>
  );
}

export function DrawerMovimento({ movimento, escopo, iesId, semestre, simulados, onFechar }: DrawerMovimentoProps) {
  const container = useGestorPortalContainer();
  const isMobile = useIsMobile();
  const tituloRef = React.useRef<HTMLHeadingElement>(null);
  useDevolverFocoAoFechar(movimento !== null);

  /** Lista completa de alunos do recorte — a coorte é uma seleção sobre ela. */
  const consultaAlunos = useAlunos(
    { iesId, semestre: (semestre ?? 'geral') as FiltroSemestre, simulados },
    { page: 1, pageSize: 500, sort: 'nome', order: 'asc', q: '' },
  );

  const pedido =
    iesId && movimento ? { movimento, escopo, iesId, semestre, simulados } : null;
  const chave = pedido ? chaveMovimento(pedido) : '';

  /* Abre JÁ PRONTO quando o pré-carregamento da leitura terminou: o estado
     inicial é o que está em cache, não `loading`. */
  const prontoNoCache = chave ? detalheEmCache(chave) : null;
  const [detalhe, setDetalhe] = React.useState<DetalheMovimento | null>(prontoNoCache);
  const [estado, setEstado] = React.useState<Estado>(prontoNoCache ? 'sucesso' : 'loading');
  const [verTodos, setVerTodos] = React.useState(false);

  const carregar = React.useCallback(
    async (forcar = false) => {
      if (!pedido) {
        setEstado('erro');
        return;
      }

      if (!forcar) {
        const emCache = detalheEmCache(chave);
        if (emCache) {
          setDetalhe(emCache);
          setEstado('sucesso');
          return;
        }
      }

      setEstado('loading');
      setDetalhe(null);
      try {
        /* Streaming quando a geração começa agora (o parcial já pinta a tela);
           quando o pré-carregamento está no ar, `obterDetalheMovimento`
           devolve a MESMA promessa e nenhuma segunda geração é paga. */
        const final = await obterDetalheMovimento(pedido, {
          refresh: forcar,
          onParcial: (parcial) => {
            setDetalhe(parcial);
            setEstado('sucesso');
          },
        });
        setDetalhe(final);
        setEstado('sucesso');
      } catch {
        setEstado('erro');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [chave],
  );

  const jaPedido = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!movimento) {
      jaPedido.current = null;
      return;
    }
    if (jaPedido.current === chave) return;
    jaPedido.current = chave;
    carregar();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, movimento !== null]);

  if (!movimento) return null;

  /* Critério: o que a IA escolheu; sem isso (corte de stream, cliente antigo),
     a rede de inferência pelo texto do movimento. */
  const criterio: CriterioCoorte = detalhe?.criterioCoorte ?? inferirCriterio(movimento);
  const semestreAlvo = detalhe?.semestreAlvo ?? inferirSemestreAlvo(movimento);
  const descritor = DESCRITORES[criterio] ?? DESCRITORES.borda_do_corte;

  const alunos = consultaAlunos.data?.data ?? [];
  const coorte = selecionarCoorte(alunos, criterio, { semestreAlvo });

  /* Base do indicador — a MESMA régua da tela: alunos com nota. Calculada
     sobre a lista, para a conta poder ser mostrada no bloco de projeção. */
  const comNota = alunos
    .map((a) => (a.proficiencias ?? []).map((p) => p.valor).filter((v): v is number => typeof v === 'number'))
    .filter((notas) => notas.length > 0)
    .map((notas) => notas[notas.length - 1]);
  const base = comNota.length;
  const proficientesHoje = comNota.filter((n) => n >= CORTE_PROFICIENCIA).length;
  const alvoBruto = detalhe?.alvoAlunos ?? null;
  const alvo = criterio === 'sem_coorte' || alvoBruto === null ? 0 : Math.min(alvoBruto, coorte.length || alvoBruto);
  const projecao = criterio === 'sem_coorte' || alvo <= 0 ? null : projetarGanho({ base, proficientesHoje, alvo });

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <SheetContent
        container={container}
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile
            ? 'flex h-[92vh] w-full flex-col gap-0 overflow-hidden rounded-t-2xl p-0'
            : 'flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'
        }
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"
        overlayClassName="bg-[var(--gp-scrim)]"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          tituloRef.current?.focus();
        }}
        data-testid="drawer-movimento"
      >
        {/* Cabeçalho fixo: identidade do movimento + recorte. O corpo rola sozinho. */}
        <SheetHeader
          className="shrink-0 space-y-0 border-b px-5 pb-3.5 pt-5 text-left"
          style={{ borderColor: 'var(--gp-border)', background: 'var(--gp-surface-1)' }}
        >
          <SheetTitle ref={tituloRef} tabIndex={-1} className="block pr-10 outline-none">
            <span className="sr-only">{`Detalhe do movimento: ${movimento.titulo}`}</span>
            <span
              aria-hidden="true"
              className="block uppercase"
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--gp-text-3)' }}
            >
              Movimento da leitura estratégica
            </span>
            <span
              aria-hidden="true"
              className="mt-1 block"
              style={{ fontSize: 19, fontWeight: 700, lineHeight: '25px', letterSpacing: '-0.01em' }}
            >
              {movimento.titulo}
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Quem é afetado, como executar e qual a melhora esperada.
          </SheetDescription>

          <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
            {movimento.metrica ? (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
                style={{ background: 'var(--gp-surface-3)', color: 'var(--gp-brand-on-dark)' }}
              >
                {movimento.metrica}
              </span>
            ) : null}
            {movimento.prioridade ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5"
                style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: COR_PRIORIDADE[movimento.prioridade] }}
                />
                {ROTULO_PRIORIDADE[movimento.prioridade]}
              </span>
            ) : null}
            <span
              className="rounded-full border border-border px-2 py-0.5"
              style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
            >
              {rotuloSemestre(semestre)}
            </span>
            {escopo === 'recorte' && simulados.length ? (
              <span
                className="rounded-full border border-border px-2 py-0.5"
                style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
              >
                {simulados.length === 1 ? '1 simulado' : `${simulados.length} simulados`}
              </span>
            ) : null}
            {estado === 'sucesso' ? (
              <button
                type="button"
                onClick={() => carregar(true)}
                aria-label="Atualizar detalhe do movimento"
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--gp-text-3)] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="refresh" size={14} />
              </button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {estado === 'loading' ? (
            <Etapas />
          ) : estado === 'erro' ? (
            <EstadoErro
              titulo="Não foi possível detalhar este movimento agora."
              onRetry={() => carregar(true)}
            />
          ) : detalhe ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-6 pb-2"
            >
              {/* 1. Diagnóstico — o texto que abre o raciocínio, sem cartão em volta. */}
              <Secao titulo="O que está acontecendo">
                <p className="text-[15px] text-foreground" style={{ lineHeight: '23px' }}>
                  {detalhe.diagnostico}
                </p>
              </Secao>

              {/* 2. Cenário — o "vale a pena?" logo depois do diagnóstico. */}
              <Secao
                titulo="Se aplicar"
                apoio="Efeito na proporção de alunos que cruza a faixa de proficiência."
              >
                {projecao ? (
                  <BlocoProjecao projecao={projecao} />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--gp-text-3)' }}>
                    {criterio === 'sem_coorte'
                      ? 'Sem grupo de alunos, não há cenário de nota para projetar: o ganho aqui é de cobertura.'
                      : 'Sem base de alunos com nota suficiente para projetar um cenário neste recorte.'}
                  </p>
                )}
              </Secao>

              {/* 3. Quem é afetado. */}
              {criterio === 'sem_coorte' ? (
                <Secao titulo="Alcance" apoio={descritor.explicacao}>
                  <p className="text-sm text-foreground" style={{ lineHeight: '20px' }}>
                    Este movimento não é sobre um grupo de alunos: o alvo é a aplicação de simulados. Confira o
                    cronograma do recorte e quantos simulados foram aplicados dos contratados.
                  </p>
                </Secao>
              ) : (
                <Secao
                  titulo={descritor.rotulo}
                  contagem={formatNumero(coorte.length)}
                  apoio={descritor.explicacao}
                >
                  {consultaAlunos.isLoading ? (
                    <p className="text-xs" style={{ color: 'var(--gp-text-3)' }}>
                      Carregando os alunos do recorte…
                    </p>
                  ) : consultaAlunos.isError ? (
                    <EstadoErro titulo="Não foi possível carregar os alunos." onRetry={consultaAlunos.refetch} />
                  ) : coorte.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--gp-text-3)' }}>
                      Nenhum aluno atende a esse critério neste recorte.
                    </p>
                  ) : (
                    <>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {coorte.slice(0, verTodos ? 60 : 8).map((aluno) => (
                          <LinhaAlunoCoorte key={aluno.id} aluno={aluno} />
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {coorte.length > 8 ? (
                          <button
                            type="button"
                            onClick={() => setVerTodos((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-md text-[color:var(--gp-brand-on-dark)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style={{ fontSize: 12, fontWeight: 600 }}
                          >
                            <Icon name={verTodos ? 'expand_less' : 'expand_more'} size={12} />
                            {verTodos
                              ? 'Mostrar menos'
                              : `Ver os ${formatNumero(Math.min(coorte.length, 60))} alunos`}
                          </button>
                        ) : null}
                        {verTodos && coorte.length > 60 ? (
                          <span style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                            Lista completa na Visão de Alunos.
                          </span>
                        ) : null}
                        {coorte.length < 10 ? (
                          <span style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                            Amostra baixa: menos de 10 alunos. Leia com cautela.
                          </span>
                        ) : null}
                      </div>
                    </>
                  )}
                </Secao>
              )}

              {/* 4. Plano — trilha vertical numerada. */}
              {detalhe.passos.length ? (
                <Secao titulo="Como executar" contagem={`${detalhe.passos.length} passos`}>
                  <ol className="space-y-0">
                    {detalhe.passos.map((passo, i) => {
                      const ultimo = i === detalhe.passos.length - 1;
                      return (
                        <li key={`${passo.acao ?? 'passo'}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                          {!ultimo ? (
                            <span
                              aria-hidden
                              className="absolute left-[11px] top-6 bottom-1 w-px"
                              style={{ background: 'var(--gp-border)' }}
                            />
                          ) : null}
                          <span
                            aria-hidden
                            className="relative z-10 inline-flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                            style={{ background: 'var(--gp-surface-3)', color: 'var(--gp-brand-on-dark)' }}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-sm font-semibold leading-snug text-foreground">{passo.acao}</p>
                            {passo.detalhe ? (
                              <p className="text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '18px' }}>
                                {passo.detalhe}
                              </p>
                            ) : null}
                            {passo.responsavel || passo.prazo ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {passo.responsavel ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5"
                                    style={{ fontSize: 10, color: 'var(--gp-text-3)' }}
                                  >
                                    <Icon name="account_circle" size={10} className="opacity-70" />
                                    {passo.responsavel}
                                  </span>
                                ) : null}
                                {passo.prazo ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5"
                                    style={{ fontSize: 10, color: 'var(--gp-text-3)' }}
                                  >
                                    <Icon name="schedule" size={10} className="opacity-70" />
                                    {passo.prazo}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                            {passo.medir ? (
                              <p
                                className="flex items-start gap-1.5 rounded-md px-2 py-1.5"
                                style={{ fontSize: 11, color: 'var(--gp-text-3)', background: 'var(--gp-surface-2)' }}
                              >
                                <Icon name="check" size={12} className="mt-0.5 shrink-0 opacity-70" />
                                <span className="min-w-0">{passo.medir}</span>
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Secao>
              ) : null}

              {/* 5. Risco — fecha o drawer com a ressalva. */}
              {detalhe.risco ? (
                <Secao titulo="Onde isso pode falhar">
                  <p
                    className="rounded-lg border border-border px-3 py-2.5 text-xs"
                    style={{ color: 'var(--gp-text-3)', lineHeight: '18px', background: 'var(--gp-surface-2)' }}
                  >
                    {detalhe.risco}
                  </p>
                </Secao>
              ) : null}
            </motion.div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
