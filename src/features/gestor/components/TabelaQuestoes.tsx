import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { DistribuicaoAlternativas } from '../charts/DistribuicaoAlternativas';
import { Icon } from './Icon';
import type { DendeIconName } from './icon-names';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
  LinhasSkeleton,
  Paginacao,
  RodapeTabela,
  TabelaGestor,
} from './tabela';
import { formatData, formatPct, TRACO } from '../lib/formatters';
import { nivelDesempenho } from '../lib/regras';
import { useGestorPortalContainer } from '../shell/GestorShell';
import type { Meta, NivelDesempenho, Questao } from '../api/types';

/**
 * `indisponivel` presente = opção desabilitada, com o motivo visível (handoff §9).
 * Nenhuma das três precisa disso hoje — `acerto_desc` (que sustenta "Mais
 * acertadas") está confirmado em produção desde 06-07/08 (`ORDER BY ...
 * acerto_pct DESC`); o campo continua existindo no tipo para uma eventual
 * quarta opção que precise dele no futuro.
 */
export type OrdenacaoQuestoes = 'ordem_da_prova' | 'mais_erradas' | 'mais_acertadas';

interface OpcaoOrdenacao {
  valor: OrdenacaoQuestoes;
  rotulo: string;
  /** Só as duas opções de ranking têm seta — "ordem da prova" não é uma direção. */
  icone?: DendeIconName;
  /** Presente = opção desabilitada; o texto é o motivo mostrado à gestora. */
  indisponivel?: string;
}

export const ORDENACOES_QUESTOES: readonly OpcaoOrdenacao[] = [
  { valor: 'ordem_da_prova', rotulo: 'Ordem da prova' },
  { valor: 'mais_erradas', rotulo: 'Mais erradas', icone: 'arrow_downward' },
  { valor: 'mais_acertadas', rotulo: 'Mais acertadas', icone: 'arrow_upward' },
];


/** §4.7.3-4: o Detalhamento das Questões existe só com exatamente 1 simulado. */
export function deveMostrarQuestoes(simulados: string[]): boolean {
  return simulados.length === 1;
}

/**
 * Identificador da questão como a referência imprime: `Q04`, `Q12`, `Q37`.
 * Dois dígitos para a coluna mono ficar alinhada — `4` e `37` sob a mesma
 * régua ótica, sem a coluna "pular" de largura entre linhas.
 */
export function formatNumeroQuestao(numero: number): string {
  return `Q${String(numero).padStart(2, '0')}`;
}

/** Sentinela do dropdown de grande área — `null` no contrato, valor não-vazio no Radix. */
const TODAS_AS_AREAS = '__todas__';

/** Preenchimento da barra do índice de acerto, pela régua única (§4.4). */
const COR_NIVEL: Record<NivelDesempenho, string> = {
  critico: 'var(--gp-danger)',
  mediano: 'var(--gp-warning)',
  excelente: 'var(--gp-success)',
};

/**
 * Ícone só nos dois extremos (crítico/excelente) — mediano é o meio-termo
 * esperado, não precisa de sinalização própria. Cor não é o único canal
 * (mesma regra do resto do portal): o glifo repete o que a cor já diz.
 */
const ICONE_NIVEL: Partial<Record<NivelDesempenho, DendeIconName>> = {
  critico: 'report_problem',
  excelente: 'star',
};

/** 6 colunas da referência: `56px 1fr 1.15fr 1.5fr 1.6fr 66px`. */
const LARGURA_NUMERO = 56;
const LARGURA_BARRA = 132;
const LARGURA_VALOR = 66;

export interface TabelaQuestoesProps {
  questoes: Questao[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  ordenacao: OrdenacaoQuestoes;
  onOrdenacaoChange: (ordenacao: OrdenacaoQuestoes) => void;
  areas: string[];
  areaSelecionada: string | null;
  onAreaChange: (area: string | null) => void;
  processando?: boolean;
  /**
   * Rastreabilidade do bloco (§4.1): fonte + data de atualização no rodapé.
   * Opcional porque o `meta` de `useQuestoes` ainda não é repassado pela rota —
   * sem ele o rodapé mostra só a contagem, nunca uma proveniência inventada.
   */
  meta?: Meta;
  /**
   * Skeleton próprio do bloco (spec de motion, Parte III §5 item 11): toolbar
   * REAL (dropdown de área + toggle de ordenação, desabilitados/inertes) +
   * cabeçalho REAL + 5 linhas na altura exata da linha real, em skeleton — nunca
   * o bloco inteiro trocado por um retângulo genérico. Gate: `useDelayedLoading`
   * (400ms) por dentro deste componente, então quem chama só passa o `isLoading`
   * crú da query — resposta rápida não chega a piscar skeleton nenhum.
   */
  carregando?: boolean;
}

export function TabelaQuestoes({
  questoes,
  total,
  page,
  pageSize,
  onPageChange,
  ordenacao,
  onOrdenacaoChange,
  areas,
  areaSelecionada,
  onAreaChange,
  processando = false,
  meta,
  carregando = false,
}: TabelaQuestoesProps) {
  const [expandida, setExpandida] = React.useState<number | null>(null);
  /**
   * Achado da auditoria (linhas ~388-441 antes desta mudança): a linha de
   * detalhe só tinha ENTRADA (`animate-in fade-in-0 slide-in-from-top-1`,
   * tailwindcss-animate) — ao fechar, o React desmontava no mesmo frame, sem
   * transição de saída. `saindo` guarda o número da questão cuja linha está
   * a caminho de desmontar: ela continua RENDERIZADA (com `animate-out
   * fade-out-0`, mesma duração de 200ms/`--gp-motion-3` da entrada) até o
   * timeout consumar a remoção de verdade. Só uma questão por vez pode estar
   * "saindo" — abrir outra questão antes do timeout vencer cancela a saída
   * pendente e remove aquela linha na hora (mesma lógica de "a última ação
   * vence" do resto do produto).
   */
  const [saindo, setSaindo] = React.useState<number | null>(null);
  const timeoutSaidaRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => () => clearTimeout(timeoutSaidaRef.current), []);

  const alternarExpandida = (numero: number) => {
    clearTimeout(timeoutSaidaRef.current);
    if (expandida === numero) {
      setSaindo(numero);
      setExpandida(null);
      timeoutSaidaRef.current = setTimeout(() => {
        setSaindo((atual) => (atual === numero ? null : atual));
      }, 200);
    } else {
      setSaindo(null);
      setExpandida(numero);
    }
  };

  const portalContainer = useGestorPortalContainer();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const mostrarSkeleton = useDelayedLoading(carregando);

  const atualizadoEm = meta?.atualizadoEm ? formatData(meta.atualizadoEm) : TRACO;
  const temRastreabilidade = Boolean(meta) && meta?.fonte !== TRACO;

  return (
    <section
      aria-labelledby="questoes-titulo"
      className="flex flex-col gap-4 p-6"
      style={{
        background: 'var(--gp-surface-1)',
        border: '1px solid var(--gp-border-strong)',
        borderRadius: 16,
        boxShadow: 'var(--gp-shadow-card)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center"
          style={{
            background: 'var(--gp-surface-2)',
            color: 'var(--gp-text-2)',
            border: '1px solid var(--gp-border)',
            borderRadius: 'var(--gp-radius-sm)',
          }}
        >
          <Icon name="list_alt" size={16} />
        </span>
        <h3 id="questoes-titulo" style={{ fontSize: 15, fontWeight: 700, color: 'var(--gp-text-1)' }}>
          Detalhamento das questões
        </h3>
        {!processando && !mostrarSkeleton && (
          <span className="ml-auto tabular-nums" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
            {total} {total === 1 ? 'questão' : 'questões'}
          </span>
        )}
      </div>

      {mostrarSkeleton ? (
        <>
          <p role="status" className="sr-only">
            Carregando questões
          </p>

          {/*
            Spec de motion, Parte III §5 item 11: toolbar REAL (dropdown de
            área + toggle de ordenação) desabilitados/inertes, não uma barra
            genérica — a moldura não pisca, só o conteúdo dela fica inerte
            enquanto o dado não chega.
          */}
          <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
            <Select value={areaSelecionada ?? TODAS_AS_AREAS} onValueChange={() => undefined} disabled>
              <SelectTrigger
                aria-label="Filtrar por grande área"
                className="h-auto w-auto gap-1.5 px-3 py-1.5 text-xs"
                style={{ borderRadius: 'var(--gp-radius-sm)' }}
                icon={<Icon name="expand_more" size={15} className="opacity-70" />}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  Grande área:
                  <span className="font-semibold">
                    <SelectValue />
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent container={portalContainer}>
                <SelectItem value={TODAS_AS_AREAS}>Todas</SelectItem>
              </SelectContent>
            </Select>

            <ToggleGroup
              type="single"
              value={ordenacao}
              onValueChange={() => undefined}
              disabled
              aria-label="Ordenação das questões"
              className="ml-auto gap-0 border p-[3px]"
              style={{
                background: 'var(--gp-surface-3)',
                borderColor: 'var(--gp-border-subtle)',
                borderRadius: 'var(--gp-radius-sm)',
              }}
            >
              {ORDENACOES_QUESTOES.map((o) => (
                <ToggleGroupItem key={o.valor} value={o.valor} className="h-auto gap-1 px-3 py-1 text-[11px]">
                  {o.icone ? <Icon name={o.icone} size={12} className="opacity-80" /> : null}
                  {o.rotulo}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div
            style={{
              border: '1px solid var(--gp-border-strong)',
              borderRadius: 'var(--gp-radius-md)',
              overflow: 'hidden',
            }}
          >
            <TabelaGestor rotulo="Detalhamento das questões">
              <CabecalhoTabela>
                <tr>
                  <CelulaCabecalho largura={LARGURA_NUMERO}>Nº</CelulaCabecalho>
                  <CelulaCabecalho>Grande área</CelulaCabecalho>
                  <CelulaCabecalho>Especialidade</CelulaCabecalho>
                  <CelulaCabecalho>Tema</CelulaCabecalho>
                  <CelulaCabecalho largura={LARGURA_BARRA}>Índice de acerto</CelulaCabecalho>
                  <CelulaCabecalho numerica largura={LARGURA_VALOR}>
                    <span className="sr-only">Percentual de acerto</span>
                  </CelulaCabecalho>
                </tr>
              </CabecalhoTabela>
              <CorpoTabela>
                <LinhasSkeleton colunas={6} />
              </CorpoTabela>
            </TabelaGestor>
          </div>
        </>
      ) : processando ? (
        <div
          data-testid="questoes-processando"
          className="flex flex-col items-center gap-2 border-2 border-dashed p-8 text-center"
          style={{ borderColor: 'var(--gp-border-subtle)', borderRadius: 'var(--gp-radius-md)' }}
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center"
            style={{ background: 'var(--gp-surface-3)', borderRadius: 'var(--gp-radius-sm)' }}
          >
            <Icon name="schedule" size={18} className="opacity-70" />
          </span>
          <p className="text-xs font-semibold" style={{ color: 'var(--gp-text-2)' }}>
            Gabarito em processamento
          </p>
          {/* Aponta para onde AINDA existe número — sem isso a tela só nega. */}
          <p className="text-[11px] leading-4" style={{ color: 'var(--gp-text-3)' }}>
            As métricas gerais do simulado já podem ser consultadas acima.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* Dropdown, não segmentado: a lista de grandes áreas cresce com o
                recorte, e um radiogroup horizontal estouraria a toolbar. O
                segmentado fica reservado para a ordenação, que tem 3 opções fixas. */}
            <Select
              value={areaSelecionada ?? TODAS_AS_AREAS}
              onValueChange={(valor) => onAreaChange(valor === TODAS_AS_AREAS ? null : valor)}
            >
              <SelectTrigger
                aria-label="Filtrar por grande área"
                className="h-auto w-auto gap-1.5 px-3 py-1.5 text-xs"
                style={{ borderRadius: 'var(--gp-radius-sm)' }}
                /* Pelo slot `icon`, não por `[&>svg]:hidden`: esconder o chevron
                   do Lucide por CSS deixa o `<svg>` no DOM — ele continua
                   baixado, continua na árvore de acessibilidade e continua
                   sendo um ícone de outra família. O slot substitui de verdade,
                   e aluno/admin seguem no default por não passarem a prop. */
                icon={<Icon name="expand_more" size={15} className="opacity-70" />}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  Grande área:
                  <span className="font-semibold">
                    <SelectValue />
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent container={portalContainer}>
                <SelectItem value={TODAS_AS_AREAS}>Todas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToggleGroup
              type="single"
              value={ordenacao}
              onValueChange={(v) => v && onOrdenacaoChange(v as OrdenacaoQuestoes)}
              aria-label="Ordenação das questões"
              className="ml-auto gap-0 border p-[3px]"
              style={{
                background: 'var(--gp-surface-3)',
                borderColor: 'var(--gp-border-subtle)',
                borderRadius: 'var(--gp-radius-sm)',
              }}
            >
              {ORDENACOES_QUESTOES.map((o) => (
                <ToggleGroupItem
                  key={o.valor}
                  value={o.valor}
                  className="h-auto gap-1 px-3 py-1 text-[11px]"
                >
                  {o.icone ? <Icon name={o.icone} size={12} className="opacity-80" /> : null}
                  {o.rotulo}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div
            style={{
              border: '1px solid var(--gp-border-strong)',
              borderRadius: 'var(--gp-radius-md)',
              overflow: 'hidden',
            }}
          >
            <TabelaGestor rotulo="Detalhamento das questões">
              <CabecalhoTabela>
                <tr>
                  <CelulaCabecalho largura={LARGURA_NUMERO}>Nº</CelulaCabecalho>
                  <CelulaCabecalho>Grande área</CelulaCabecalho>
                  <CelulaCabecalho>Especialidade</CelulaCabecalho>
                  <CelulaCabecalho>Tema</CelulaCabecalho>
                  <CelulaCabecalho largura={LARGURA_BARRA}>Índice de acerto</CelulaCabecalho>
                  {/* A barra e o valor são duas colunas: a barra dá a varredura
                      vertical, o número dá a precisão. O cabeçalho do valor é
                      visualmente vazio na referência, mas precisa de nome para o leitor de tela. */}
                  <CelulaCabecalho numerica largura={LARGURA_VALOR}>
                    <span className="sr-only">Percentual de acerto</span>
                  </CelulaCabecalho>
                </tr>
              </CabecalhoTabela>
              <CorpoTabela>
                {questoes.map((q, i) => {
                  const aberta = expandida === q.numero;
                  const saindoAgora = saindo === q.numero;
                  const nivel = nivelDesempenho(q.acertoPct);
                  const ultima = i === questoes.length - 1;
                  return (
                    <React.Fragment key={q.numero}>
                      <LinhaTabela
                        data-testid={`linha-questao-${q.numero}`}
                        selecionada={aberta}
                        // Com o detalhe aberto (ou ainda saindo) embaixo, o
                        // divisor da linha-gatilho vira o `border-top` que a
                        // referência desenha entre os dois — só volta a ser a
                        // última linha depois que a saída de fato termina.
                        ultima={ultima && !aberta && !saindoAgora}
                        /*
                          A LINHA INTEIRA abre o detalhe, não só a setinha
                          (reunião de 07/08: "tem que abrir clicando em qualquer
                          lugar, não só na seta"). O alvo de clique era um
                          chevron de 14px numa linha de 700px de largura — e
                          nada na linha dizia que ela era clicável.

                          O `<button>` da primeira célula continua: é ele o
                          controle acessível, com `aria-expanded`/`aria-controls`,
                          alcançável por Tab. Por isso o guard: sem ele, um
                          clique no botão dispararia o handler do botão E o da
                          linha (bubbling), abrindo e fechando no mesmo gesto.
                        */
                        onSelecionar={(evento: React.MouseEvent<HTMLTableRowElement>) => {
                          if ((evento.target as HTMLElement).closest('button')) return;
                          alternarExpandida(q.numero);
                        }}
                      >
                        <Celula>
                          <button
                            type="button"
                            aria-expanded={aberta}
                            aria-controls={`detalhe-questao-${q.numero}`}
                            aria-label={`Ver detalhe da questão ${q.numero}`}
                            onClick={() => alternarExpandida(q.numero)}
                            className={cn('inline-flex items-center gap-1 tabular-nums', aberta && 'font-semibold')}
                            style={{ fontFamily: FONTE_MONO }}
                          >
                            {/* Um glifo só, girando: troca de ícone não anima, rotação sim
                                (e rotação é `transform` — a única propriedade permitida). */}
                            <span
                              className="inline-flex"
                              style={{ color: aberta ? 'var(--gp-brand-on-dark)' : 'var(--gp-text-3)' }}
                            >
                              <Icon
                                name="expand_more"
                                size={14}
                                className={cn('transition-transform duration-200', aberta && 'rotate-180')}
                              />
                            </span>
                            {formatNumeroQuestao(q.numero)}
                          </button>
                        </Celula>
                        <Celula>
                          <span title={q.grandeArea} className="block max-w-[220px] truncate">
                            {q.grandeArea}
                          </span>
                        </Celula>
                        <Celula>
                          <span title={q.especialidade} className="block max-w-[220px] truncate">
                            {q.especialidade}
                          </span>
                        </Celula>
                        <Celula>
                          <span title={q.tema} className="block max-w-[220px] truncate">
                            {q.tema}
                          </span>
                        </Celula>
                        <Celula>
                          {nivel === null ? null : (
                            <span
                              aria-hidden="true"
                              data-testid={`barra-acerto-${q.numero}`}
                              className="block h-2 w-full overflow-hidden"
                              style={{
                                background: 'var(--gp-surface-3)',
                                borderRadius: 'var(--gp-radius-pill)',
                              }}
                            >
                              <span
                                className="block h-full w-full origin-left transition-transform duration-200"
                                style={{
                                  background: COR_NIVEL[nivel],
                                  borderRadius: 'var(--gp-radius-pill)',
                                  transform: `scaleX(${Math.max(0, Math.min(100, q.acertoPct ?? 0)) / 100})`,
                                }}
                              />
                            </span>
                          )}
                        </Celula>
                        <Celula numerica ausente={q.acertoPct === null}>
                          {/* A cor do crítico vive num `<span>`: `Celula` já declara
                              `color` inline, e classe nenhuma vence estilo inline. O
                              ícone repete o mesmo canal da cor (§ nunca cor sozinha),
                              só nos dois extremos — ver `ICONE_NIVEL`. */}
                          <span
                            className={cn(
                              'inline-flex items-center justify-end gap-1',
                              nivel === 'critico' && 'gp-text-danger font-semibold',
                              nivel === 'excelente' && 'font-semibold',
                            )}
                            style={nivel === 'excelente' ? { color: 'var(--gp-success-on)' } : undefined}
                          >
                            {nivel !== null && ICONE_NIVEL[nivel] ? (
                              <Icon name={ICONE_NIVEL[nivel]!} size={13} className="shrink-0" />
                            ) : null}
                            {formatPct(q.acertoPct)}
                          </span>
                        </Celula>
                      </LinhaTabela>
                      {(aberta || saindoAgora) && (
                        <LinhaTabela selecionada ultima={ultima}>
                          <Celula colSpan={6} id={`detalhe-questao-${q.numero}`} data-testid={`detalhe-questao-${q.numero}`}>
                            {/* `animate-in`/`animate-out` do tailwindcss-animate = opacity +
                                translate (nunca altura), 200ms = motion-3, nos dois sentidos —
                                achado da auditoria: antes só havia entrada; ao fechar, a linha
                                desmontava no mesmo frame. `aberta`/`saindoAgora` são mutuamente
                                exclusivos (`alternarExpandida` acima) — nunca as duas classes
                                juntas. O bloco prefers-reduced-motion de gestor-theme.css já zera
                                isto. Fundo branco + borda do card (revisão de estilo): mesma
                                classe de AcertoPorAreaESemestre.tsx, em vez dos tokens
                                --gp-* usados antes aqui. */}
                            <div
                              className={cn(
                                'flex flex-col gap-3.5 rounded-lg border border-border bg-card p-4 duration-200',
                                aberta ? 'animate-in fade-in-0 slide-in-from-top-1' : 'animate-out fade-out-0',
                              )}
                            >
                              <p className="whitespace-pre-line text-xs leading-5" style={{ color: 'var(--gp-text-2)' }}>
                                <span className="font-semibold" style={{ color: 'var(--gp-text-1)' }}>
                                  Enunciado.
                                </span>{' '}
                                {q.enunciado}
                              </p>
                              {(q.imagemEnunciado || q.imagemEnunciado2) && (
                                <div className="flex flex-wrap gap-3" data-testid={`imagens-enunciado-${q.numero}`}>
                                  {q.imagemEnunciado && (
                                    <img
                                      src={q.imagemEnunciado}
                                      alt={`Imagem do enunciado da questão ${q.numero}`}
                                      className="h-auto max-w-full rounded border border-border sm:max-w-[360px]"
                                    />
                                  )}
                                  {q.imagemEnunciado2 && (
                                    <img
                                      src={q.imagemEnunciado2}
                                      alt={`Segunda imagem do enunciado da questão ${q.numero}`}
                                      className="h-auto max-w-full rounded border border-border sm:max-w-[360px]"
                                    />
                                  )}
                                </div>
                              )}
                              <DistribuicaoAlternativas
                                alternativas={q.alternativas}
                                distratorDominante={q.distratorDominante}
                                questionId={q.id}
                              />
                              {q.imagemComentario && (
                                <div className="flex flex-col gap-1.5" data-testid={`imagem-comentario-${q.numero}`}>
                                  <p className={cn('text-[10px] font-bold uppercase tracking-[0.06em]')} style={{ color: 'var(--gp-text-3)' }}>
                                    Imagem do comentário
                                  </p>
                                  <img
                                    src={q.imagemComentario}
                                    alt={`Imagem do comentário/gabarito da questão ${q.numero}`}
                                    className="h-auto max-w-full rounded border border-border sm:max-w-[360px]"
                                  />
                                </div>
                              )}
                            </div>
                          </Celula>
                        </LinhaTabela>
                      )}
                    </React.Fragment>
                  );
                })}
              </CorpoTabela>
            </TabelaGestor>
          </div>

          <RodapeTabela>
            <p data-testid="questoes-rodape">
              Mostrando {questoes.length} de {total} {total === 1 ? 'questão' : 'questões'}
              {temRastreabilidade ? ` · fonte: ${meta?.fonte}` : ''}
              {temRastreabilidade && atualizadoEm !== TRACO ? ` · atualizado ${atualizadoEm}` : ''}
            </p>

            <Paginacao
              className="ml-auto"
              rotulo="Paginação das questões"
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          </RodapeTabela>
        </>
      )}
    </section>
  );
}
