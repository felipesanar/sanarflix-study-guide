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
  children,
}: {
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h4
          className="uppercase"
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}
        >
          {titulo}
        </h4>
        {apoio ? (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
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
    <li className="flex items-center gap-3 rounded-md border border-border px-2.5 py-2" style={{ background: 'var(--gp-surface-2)' }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{aluno.nome}</p>
        <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
          {aluno.semestre === null ? 'Semestre não informado' : `${aluno.semestre}º semestre`}
          {aluno.proficiencia === null ? ' · TRI em calibração' : ''}
        </p>
      </div>
      {aluno.variacao !== null ? (
        <span
          className="shrink-0 tabular-nums"
          style={{ fontSize: 11, color: aluno.variacao >= 0 ? 'var(--gp-success)' : 'var(--gp-danger)' }}
        >
          {aluno.variacao > 0 ? '+' : ''}
          {formatNumero(aluno.variacao)} pts
        </span>
      ) : null}
      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: cor }}>
        {aluno.proficiencia === null ? TRACO : formatNumero(aluno.proficiencia)}
      </span>
    </li>
  );
}

function BlocoProjecao({ projecao }: { projecao: Projecao }) {
  return (
    <div className="rounded-md border border-border p-3" style={{ background: 'var(--gp-surface-2)' }}>
      <div className="flex items-end gap-2">
        <span className="text-sm tabular-nums" style={{ color: 'var(--gp-text-3)' }}>
          {formatPct(projecao.antesPct, 1)}
        </span>
        <Icon name="arrow_forward" size={14} className="mb-1 shrink-0 opacity-60" />
        <span className="text-2xl font-bold leading-none tabular-nums text-foreground">
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
      <p className="mt-2 text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
        Cenário, não previsão. A conta: hoje {formatNumero(projecao.proficientesHoje)} de{' '}
        {formatNumero(projecao.base)} alunos com nota cruzam a faixa de {CORTE_PROFICIENCIA} pontos. Se mais{' '}
        {formatNumero(projecao.alvo)} passarem do corte, a proporção vai para {formatPct(projecao.depoisPct, 1)}.
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
            ? 'flex max-h-[88vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl'
            : 'flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg'
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
        <SheetHeader>
          <SheetTitle ref={tituloRef} tabIndex={-1} className="outline-none">
            <span className="sr-only">{`Detalhe do movimento: ${movimento.titulo}`}</span>
            <span aria-hidden="true" className="block" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
              Movimento da leitura estratégica
            </span>
            <span aria-hidden="true" className="mt-0.5 block" style={{ fontSize: 17, fontWeight: 700, lineHeight: '22px' }}>
              {movimento.titulo}
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Quem é afetado, como executar e qual a melhora esperada.
          </SheetDescription>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
            className="space-y-5 pb-2"
          >
            <Secao titulo="O que está acontecendo">
              <p className="text-sm text-foreground" style={{ lineHeight: '20px' }}>
                {detalhe.diagnostico}
              </p>
            </Secao>

            {criterio === 'sem_coorte' ? (
              <Secao titulo="Alcance" apoio={descritor.explicacao}>
                <p className="text-sm text-foreground" style={{ lineHeight: '20px' }}>
                  Este movimento não é sobre um grupo de alunos: o alvo é a aplicação de simulados. Confira o
                  cronograma do recorte e quantos simulados foram aplicados dos contratados.
                </p>
              </Secao>
            ) : (
              <Secao
                titulo={`${descritor.rotulo} · ${formatNumero(coorte.length)}`}
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
                    <ul className="space-y-1.5">
                      {coorte.slice(0, 40).map((aluno) => (
                        <LinhaAlunoCoorte key={aluno.id} aluno={aluno} />
                      ))}
                    </ul>
                    {coorte.length > 40 ? (
                      <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                        Mostrando os 40 primeiros de {formatNumero(coorte.length)}. A lista completa está na Visão de
                        Alunos.
                      </p>
                    ) : null}
                    {coorte.length < 10 ? (
                      <p style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                        Amostra baixa: menos de 10 alunos neste grupo. Leia com cautela.
                      </p>
                    ) : null}
                  </>
                )}
              </Secao>
            )}

            {detalhe.passos.length ? (
              <Secao titulo="Como executar">
                <ol className="space-y-2">
                  {detalhe.passos.map((passo, i) => (
                    <li
                      key={`${passo.acao ?? 'passo'}-${i}`}
                      className="rounded-md border border-border p-2.5"
                      style={{ background: 'var(--gp-surface-2)' }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                          style={{ background: 'var(--gp-surface-3)', color: 'var(--gp-brand-on-dark)' }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{passo.acao}</p>
                          {passo.detalhe ? (
                            <p className="mt-0.5 text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
                              {passo.detalhe}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {passo.responsavel ? (
                              <span
                                className="rounded-sm border border-border px-1.5 py-0.5"
                                style={{ fontSize: 10, color: 'var(--gp-text-3)' }}
                              >
                                {passo.responsavel}
                              </span>
                            ) : null}
                            {passo.prazo ? (
                              <span
                                className="rounded-sm border border-border px-1.5 py-0.5"
                                style={{ fontSize: 10, color: 'var(--gp-text-3)' }}
                              >
                                {passo.prazo}
                              </span>
                            ) : null}
                          </div>
                          {passo.medir ? (
                            <p className="mt-1.5 flex items-start gap-1" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                              <Icon name="check" size={12} className="mt-0.5 shrink-0 opacity-70" />
                              <span className="min-w-0">{passo.medir}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </Secao>
            ) : null}

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

            {detalhe.risco ? (
              <Secao titulo="Onde isso pode falhar">
                <p className="text-xs" style={{ color: 'var(--gp-text-3)', lineHeight: '17px' }}>
                  {detalhe.risco}
                </p>
              </Secao>
            ) : null}
          </motion.div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
