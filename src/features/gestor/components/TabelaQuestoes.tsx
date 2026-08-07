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
import { DistribuicaoAlternativas } from '../charts/DistribuicaoAlternativas';
import { Icon } from './Icon';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
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
 *
 * `Mais acertadas` exige ordenação decrescente, e o `ORDER BY` de
 * `get_gestor_questoes` é `acerto_pct ASC` fixo, sem parâmetro de direção — o
 * banco simplesmente não sabe servir essa leitura hoje. A alternativa seria
 * degradar em silêncio para `acerto` ascendente, o que devolveria a MESMA lista
 * de "Mais erradas" sob outro rótulo: a gestora leria "as que mais acertaram" e
 * veria as que mais erraram. Desabilitar dizendo o porquê é honesto; mentir com
 * a lista invertida não é. Reabrir quando `acerto_desc` entrar na whitelist da
 * RPC (ver `questoesContratoSort.test.ts`).
 */
export type OrdenacaoQuestoes = 'ordem_da_prova' | 'mais_erradas' | 'mais_acertadas';

interface OpcaoOrdenacao {
  valor: OrdenacaoQuestoes;
  rotulo: string;
  /** Presente = opção desabilitada; o texto é o motivo mostrado à gestora. */
  indisponivel?: string;
}

export const ORDENACOES_QUESTOES: readonly OpcaoOrdenacao[] = [
  { valor: 'ordem_da_prova', rotulo: 'Ordem da prova' },
  { valor: 'mais_erradas', rotulo: 'Mais erradas' },
  {
    valor: 'mais_acertadas',
    rotulo: 'Mais acertadas',
    indisponivel: 'Indisponível: o banco ainda não ordena por acerto decrescente.',
  },
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
}: TabelaQuestoesProps) {
  const [expandida, setExpandida] = React.useState<number | null>(null);
  const portalContainer = useGestorPortalContainer();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const idMotivo = React.useId();
  const indisponiveis = ORDENACOES_QUESTOES.filter((o) => o.indisponivel !== undefined);

  const atualizadoEm = meta?.atualizadoEm ? formatData(meta.atualizadoEm) : TRACO;
  const temRastreabilidade = Boolean(meta) && meta?.fonte !== TRACO;

  return (
    <section aria-labelledby="questoes-titulo" className="space-y-3">
      <h3 id="questoes-titulo" className="text-base font-semibold text-foreground">
        Detalhamento das questões
      </h3>

      {processando ? (
        <div
          data-testid="questoes-processando"
          className="flex flex-col items-center gap-2 border-2 border-dashed p-8 text-center"
          style={{ borderColor: 'var(--gp-border-strong)', borderRadius: 'var(--gp-radius-md)' }}
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

            {/*
              O motivo da opção desabilitada é TEXTO NA TELA, ao lado do
              controle — mesmo padrão do `motivo-sem-cruzamento` de
              `AcertoPorAreaESemestre`. Em `title` de um botão `disabled` ele
              não chegava a ninguém: controle desabilitado não dispara evento
              de mouse, então Chrome e Firefox nunca mostram a tooltip; e
              `aria-description` não é texto na tela e tem suporte parcial. A
              gestora via um segmento cinza e inerte, sem explicação. O `title`
              fica por cima como reforço, e a ligação com o segmento passa a
              ser `aria-describedby`, que aponta para este texto real.
            */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {indisponiveis.map((o) => (
                <p
                  key={o.valor}
                  id={`${idMotivo}-${o.valor}`}
                  data-testid={`motivo-ordenacao-${o.valor}`}
                  className="leading-4"
                  style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
                >
                  {o.indisponivel}
                </p>
              ))}

              <ToggleGroup
                type="single"
                value={ordenacao}
                onValueChange={(v) => v && onOrdenacaoChange(v as OrdenacaoQuestoes)}
                aria-label="Ordenação das questões"
                className="gap-0 border p-[3px]"
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
                    disabled={o.indisponivel !== undefined}
                    title={o.indisponivel}
                    aria-describedby={o.indisponivel === undefined ? undefined : `${idMotivo}-${o.valor}`}
                    className="h-auto px-3 py-1 text-[11px]"
                  >
                    {o.rotulo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div
            className="border"
            style={{
              borderColor: 'var(--gp-border-subtle)',
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
                  const nivel = nivelDesempenho(q.acertoPct);
                  const ultima = i === questoes.length - 1;
                  return (
                    <React.Fragment key={q.numero}>
                      <LinhaTabela
                        data-testid={`linha-questao-${q.numero}`}
                        selecionada={aberta}
                        // Com o detalhe aberto embaixo, o divisor da linha-gatilho
                        // vira o `border-top` que a referência desenha entre os dois.
                        ultima={ultima && !aberta}
                      >
                        <Celula>
                          <button
                            type="button"
                            aria-expanded={aberta}
                            aria-controls={`detalhe-questao-${q.numero}`}
                            aria-label={`Ver detalhe da questão ${q.numero}`}
                            onClick={() => setExpandida(aberta ? null : q.numero)}
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
                              `color` inline, e classe nenhuma vence estilo inline. */}
                          <span className={cn(nivel === 'critico' && 'gp-text-danger font-semibold')}>
                            {formatPct(q.acertoPct)}
                          </span>
                        </Celula>
                      </LinhaTabela>
                      {aberta && (
                        <LinhaTabela selecionada ultima={ultima}>
                          <Celula colSpan={6} id={`detalhe-questao-${q.numero}`} data-testid={`detalhe-questao-${q.numero}`}>
                            {/* `animate-in` do tailwindcss-animate = opacity + translate
                                (nunca altura), 200ms = motion-3. O bloco
                                prefers-reduced-motion de gestor-theme.css já zera isto. */}
                            <div
                              className="flex flex-col gap-3.5 border p-4 duration-200 animate-in fade-in-0 slide-in-from-top-1"
                              style={{
                                borderColor: 'var(--gp-border-subtle)',
                                borderRadius: 'var(--gp-radius-md)',
                                background: 'var(--gp-surface-1)',
                              }}
                            >
                              <p className="whitespace-pre-line text-xs leading-5" style={{ color: 'var(--gp-text-2)' }}>
                                <span className="font-semibold" style={{ color: 'var(--gp-text-1)' }}>
                                  Enunciado.
                                </span>{' '}
                                {q.enunciado}
                              </p>
                              <DistribuicaoAlternativas
                                alternativas={q.alternativas}
                                distratorDominante={q.distratorDominante}
                              />
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
