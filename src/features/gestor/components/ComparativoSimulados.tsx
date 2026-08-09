import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { Tag, TagDelta } from './Tag';
import {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
  TabelaGestor,
} from './tabela';
import { calcularVariacao } from '../lib/regras';
import { formatConceito, formatData, formatNumero, formatPct, TRACO } from '../lib/formatters';
import type { Detalhamento, MetricasSimulado } from '../api/types';

export interface ComparativoSimuladosProps {
  metricas: MetricasSimulado[];
  comparativoTemas?: Detalhamento['comparativoTemas'];
}

/** `dd/MM` — a referência usa a data curta no cabeçalho do card. */
function dataCurta(iso: string | null): string {
  const completa = formatData(iso);
  return completa === TRACO ? TRACO : completa.slice(0, 5);
}

const CLASSE_TITULO_BLOCO = 'text-[13px] font-bold';

/**
 * Célula de valor destas duas tabelas: mono, mas alinhada à ESQUERDA. A
 * referência não usa a coluna numérica à direita aqui — os números ficam
 * colados ao rótulo do simulado, porque a leitura é linha a linha (SN1 × SN2),
 * não varredura vertical. Por isso `Celula numerica` (que alinha à direita)
 * não serve, e a família mono vem por `style`.
 */
const ESTILO_VALOR: React.CSSProperties = {
  fontFamily: FONTE_MONO,
  fontVariantNumeric: 'tabular-nums',
};

/**
 * Cabeçalho da tabela de métricas: 13px/700 com a data e o n embaixo. É a
 * única exceção ao cabeçalho padrão (10px caixa alta) do `components/tabela` —
 * aqui a coluna é um SIMULADO, não um atributo, e a referência lhe dá o peso
 * de um título de coluna.
 */
const ESTILO_CABECALHO_SIMULADO: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--gp-text-1)',
  textAlign: 'left',
  borderBottom: '1px solid var(--gp-border-strong)',
};

/** Painel interno do expandido: fundo um degrau abaixo do card, raio 12px. */
const ESTILO_PAINEL: React.CSSProperties = {
  background: 'var(--gp-surface-2)',
  borderColor: 'var(--gp-border-subtle)',
  borderRadius: 'var(--gp-radius-md)',
};

/** Chip "proj." — o Conceito ENAMED nunca aparece sem dizer que é projetado (§4.1). */
function ChipProjetado() {
  return (
    <Tag variant="qualificador" title="Conceito ENAMED projetado">
      proj.
    </Tag>
  );
}

export function ComparativoSimulados({ metricas, comparativoTemas }: ComparativoSimuladosProps) {
  const [aberto, setAberto] = React.useState(false);

  // §4.7.4: comparativo existe só a partir de 2 simulados.
  if (metricas.length < 2) return null;

  const indiceAtual = metricas.length - 1;

  return (
    /*
      A seção ganha CASCA de bloco.

      Ela é a resposta à pergunta que traz o gestor ao Detalhamento — "o que
      mudou de um simulado para o outro" — e era a única da rota sem moldura:
      um `<h3>` de 16px/600 e cartões flutuando direto sobre o fundo, entre
      dois blocos em card. Sem contorno, a seção lia como sobra do bloco de
      cima, e o próprio comparativo completo (o painel mais denso da tela)
      pendurado num link de 12px.
    */
    <section aria-labelledby="comparativo-titulo">
      <Card className="relative overflow-hidden">
        {/* Aura de marca no canto do bloco: dá profundidade sem pintar o card
            inteiro. Decorativa. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-48 w-72 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: 'var(--gp-brand-gradient, var(--gp-brand-on-dark))' }}
        />
        <CardHeader className="relative pb-3">
          <div className="flex items-start gap-3">
            {/* Medalhão: mesmo idioma visual do Diagnóstico Curricular. */}
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
              style={{
                background: 'var(--gp-brand-surface)',
                borderColor: 'var(--gp-brand-border)',
                color: 'var(--gp-brand-on-dark)',
              }}
            >
              <Icon name="timeline" size={18} />
            </span>
            <div className="min-w-0">
              <h3
                id="comparativo-titulo"
                style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}
                className="text-foreground"
              >
                Comparativo entre simulados
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                O que mudou de um simulado para o outro em acerto, conceito e proficiência.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-4">
          {/* Com dois simulados a grade de 3 colunas deixava um vão vazio à
              direita e os cartões desalinhados do resto do bloco: com 2, a
              grade encolhe e CENTRALIZA. */}
          <div
            className={cn(
              'grid gap-3 sm:grid-cols-2',
              metricas.length === 2 ? 'mx-auto max-w-3xl' : 'lg:grid-cols-3',
            )}
          >
            {metricas.map((m, i) => {
              const anterior = i > 0 ? metricas[i - 1] : null;
              const ehAtual = i === indiceAtual;

              /* Delta só existe contra um simulado anterior: o primeiro card não recebe
                 pílula nenhuma. Imprimir `—` ali afirmaria "variação desconhecida" onde
                 simplesmente não há o que variar (§4.10). */
              const deltaAcerto = anterior ? calcularVariacao(anterior.acertoMedioPct, m.acertoMedioPct) : null;
              const deltaEnamed = anterior ? calcularVariacao(anterior.enamedProjetado, m.enamedProjetado) : null;
              const deltaProficiencia = anterior
                ? calcularVariacao(anterior.proficienciaMedia, m.proficienciaMedia)
                : null;

              return (
                <Card
                  key={m.simuladoId}
                  data-testid={`card-simulado-${m.simuladoId}`}
                  data-atual={String(ehAtual)}
                  /* Destaque do atual é borda de marca fina + sombra de card — nunca
                     anel de 2px, que o handoff proíbe em card. */
                  className={cn(
                    'relative overflow-hidden transition-shadow duration-200',
                    ehAtual && 'border-[var(--gp-brand-border)]',
                  )}
                  /* Dentro da casca nova, um tile `bg-card` seria branco sobre
                     branco: os que não são o atual descem um degrau de superfície
                     para o contorno não ser o único sinal de que ali há um
                     cartão. O atual continua no branco do card, que é o que o
                     faz saltar. */
                  style={
                    ehAtual
                      ? { borderWidth: 1.5, boxShadow: 'var(--gp-shadow-card)' }
                      : { background: 'var(--gp-surface-2)' }
                  }
                >
                  {/* Fio de status no topo: 3px de marca só no simulado atual —
                      categoriza o cartão antes de qualquer leitura de texto. */}
                  {ehAtual && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-[3px]"
                      style={{ background: 'var(--gp-brand-gradient, var(--gp-brand-on-dark))' }}
                    />
                  )}
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-[13px] font-bold text-foreground">{m.nome}</p>
                      {ehAtual && <Tag variant="selo">atual</Tag>}
                      <p className="ml-auto whitespace-nowrap text-[11px] tabular-nums" style={{ color: 'var(--gp-text-3)' }}>
                        {dataCurta(m.data)} · {m.participantes} part.
                      </p>
                    </div>


                    <dl className="space-y-2.5">
                      <LinhaIndicador
                        rotulo="Percentual de acerto"
                        valor={formatPct(m.acertoMedioPct)}
                        valorTestId="card-acerto"
                        delta={deltaAcerto}
                        deltaTestId="card-delta-acerto"
                      />
                      <LinhaIndicador
                        rotulo="Conceito ENAMED"
                        qualificador={<ChipProjetado />}
                        valor={formatConceito(m.enamedProjetado)}
                        valorTestId="card-enamed"
                        delta={deltaEnamed}
                        deltaTestId="card-delta-enamed"
                        separada
                      />
                      <LinhaIndicador
                        rotulo="Proficiência média"
                        valor={formatNumero(m.proficienciaMedia)}
                        valorTestId="card-proficiencia"
                        delta={deltaProficiencia}
                        deltaTestId="card-delta-proficiencia"
                        separada
                      />
                    </dl>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Collapsible open={aberto} onOpenChange={setAberto}>
            {/*
              O gatilho é um BOTÃO de largura total, não um link de 12px.

              O que ele abre é o painel mais denso da rota — métricas lado a lado,
              acerto por tema, alunos. Pendurar isso num texto miúdo, do mesmo peso
              de uma legenda, escondia o caminho principal do Detalhamento: quem
              não sabia que existia, não achava. Largura total porque o painel que
              ele revela também é de largura total — o controle tem o tamanho do
              que ele controla.
            */}
            <CollapsibleTrigger
              data-testid="comparativo-abrir"
              className="flex w-full items-center justify-center gap-2 rounded-sm transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                padding: '11px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--gp-brand-on-dark)',
                background: 'var(--gp-brand-surface)',
                border: '1px solid var(--gp-brand-border)',
              }}
            >
              {aberto ? 'Ocultar comparativo completo' : 'Ver comparativo completo · questões e alunos'}
              <Icon
                name="expand_more"
                size={16}
                className={cn('transition-transform duration-200', aberto && 'rotate-180')}
              />
            </CollapsibleTrigger>

            <CollapsibleContent className="flex flex-col gap-4 pt-3">
              <div className="border p-4" style={ESTILO_PAINEL}>
                <p className={cn(CLASSE_TITULO_BLOCO, 'mb-2.5 text-foreground')}>Métricas por simulado</p>
                <div data-testid="comparativo-metricas">
                  <TabelaGestor rotulo="Métricas por simulado">
                    <CabecalhoTabela>
                      <tr>
                        <th scope="col" style={ESTILO_CABECALHO_SIMULADO}>
                          <span className="sr-only">Indicador</span>
                        </th>
                        {metricas.map((m) => (
                          <th key={m.simuladoId} scope="col" style={ESTILO_CABECALHO_SIMULADO}>
                            {m.nome}
                            <span
                              className="block text-[11px] font-normal tabular-nums"
                              style={{ color: 'var(--gp-text-3)' }}
                            >
                              {dataCurta(m.data)} · {m.participantes} part.
                            </span>
                          </th>
                        ))}
                      </tr>
                    </CabecalhoTabela>
                    <CorpoTabela>
                      <LinhaMetrica
                        rotulo="Percentual de acerto médio"
                        metricas={metricas}
                        valor={(m) => formatPct(m.acertoMedioPct)}
                        bruto={(m) => m.acertoMedioPct}
                      />
                      <LinhaMetrica
                        rotulo="Conceito ENAMED"
                        qualificador={<ChipProjetado />}
                        metricas={metricas}
                        valor={(m) => formatConceito(m.enamedProjetado)}
                        bruto={(m) => m.enamedProjetado}
                      />
                      <LinhaMetrica
                        rotulo="Proficiência média"
                        metricas={metricas}
                        valor={(m) => formatNumero(m.proficienciaMedia)}
                        bruto={(m) => m.proficienciaMedia}
                        ultima
                      />
                    </CorpoTabela>
                  </TabelaGestor>
                </div>
              </div>

              <div className="border p-4" style={ESTILO_PAINEL}>
                <p className={cn(CLASSE_TITULO_BLOCO, 'text-foreground')}>Questões — acerto por tema</p>
                {/* Sem esta linha o gestor não sabe por que a comparação é por tema:
                    provas diferentes não compartilham questão, só assunto. */}
                <p className="mb-2.5 text-[11px]" style={{ color: 'var(--gp-text-3)' }}>
                  provas têm questões distintas — a linha comparável é o tema
                </p>
                {comparativoTemas && comparativoTemas.length > 0 ? (
                  <div data-testid="comparativo-temas">
                    <TabelaGestor rotulo="Acerto por tema entre simulados">
                      <CabecalhoTabela>
                        <tr>
                          <CelulaCabecalho>Tema</CelulaCabecalho>
                          {metricas.map((m) => (
                            <CelulaCabecalho key={m.simuladoId}>{m.nome}</CelulaCabecalho>
                          ))}
                        </tr>
                      </CabecalhoTabela>
                      <CorpoTabela>
                        {comparativoTemas.map((linha, indiceLinha) => (
                          <LinhaTabela key={linha.tema} ultima={indiceLinha === comparativoTemas.length - 1}>
                            <Celula>{linha.tema}</Celula>
                            {metricas.map((m, i) => {
                              const ponto = linha.porSimulado.find((p) => p.simuladoId === m.simuladoId);
                              const valor = ponto?.acertoPct ?? null;
                              const anteriorId = i > 0 ? metricas[i - 1].simuladoId : null;
                              const pontoAnterior = anteriorId
                                ? linha.porSimulado.find((p) => p.simuladoId === anteriorId)
                                : undefined;
                              const variacao = calcularVariacao(pontoAnterior?.acertoPct ?? null, valor);
                              return (
                                <Celula
                                  key={m.simuladoId}
                                  data-testid={`tema-${m.simuladoId}`}
                                  style={{
                                    ...ESTILO_VALOR,
                                    // Ausência nunca herda a cor de um dado: o `—` fica em text-3.
                                    color: valor === null ? 'var(--gp-text-3)' : corDaVariacao(variacao),
                                  }}
                                >
                                  {formatPct(valor)}
                                </Celula>
                              );
                            })}
                          </LinhaTabela>
                        ))}
                      </CorpoTabela>
                    </TabelaGestor>
                  </div>
                ) : (
                  <p data-testid="comparativo-temas-vazio" className="text-xs" style={{ color: 'var(--gp-text-3)' }}>
                    Sem tema comparável entre estes simulados
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </section>
  );
}

/** Cor de leitura da variação: subiu = sucesso, caiu = erro, igual/ausente = neutro. */
function corDaVariacao(variacao: number | null): string {
  if (variacao === null || variacao === 0) return 'var(--gp-text-2)';
  return variacao > 0 ? 'var(--gp-success-on)' : 'var(--gp-danger-on)';
}

function LinhaIndicador({
  rotulo,
  qualificador,
  valor,
  valorTestId,
  delta,
  deltaTestId,
  separada = false,
}: {
  rotulo: string;
  qualificador?: React.ReactNode;
  valor: string;
  valorTestId: string;
  delta: number | null;
  deltaTestId: string;
  separada?: boolean;
}) {
  return (
    <div
      className={cn('flex items-center gap-2.5', separada && 'border-t pt-2.5')}
      style={separada ? { borderColor: 'var(--gp-border-subtle)' } : undefined}
    >
      <dt className="flex flex-1 items-center gap-1.5 text-xs" style={{ color: 'var(--gp-text-3)' }}>
        {rotulo}
        {qualificador}
      </dt>
      <dd className="flex items-center gap-2.5">
        {/* `TagDelta` não repassa props soltas; o testid mora no invólucro. */}
        {delta !== null && (
          <span data-testid={deltaTestId} className="inline-flex">
            <TagDelta valor={delta} />
          </span>
        )}
        <span
          data-testid={valorTestId}
          className="text-xl font-extrabold tabular-nums text-foreground"
          style={{ fontFamily: FONTE_MONO }}
        >
          {valor}
        </span>
      </dd>
    </div>
  );
}

function LinhaMetrica({
  rotulo,
  qualificador,
  metricas,
  valor,
  bruto,
  ultima = false,
}: {
  rotulo: string;
  qualificador?: React.ReactNode;
  metricas: MetricasSimulado[];
  valor: (m: MetricasSimulado) => string;
  bruto: (m: MetricasSimulado) => number | null;
  ultima?: boolean;
}) {
  return (
    <LinhaTabela ultima={ultima}>
      <Celula>
        <span className="flex items-center gap-1.5">
          {rotulo}
          {qualificador}
        </span>
      </Celula>
      {metricas.map((m, i) => {
        const variacao = i > 0 ? calcularVariacao(bruto(metricas[i - 1]), bruto(m)) : null;
        return (
          <Celula key={m.simuladoId} style={ESTILO_VALOR}>
            <span className="flex items-center gap-1.5">
              {valor(m)}
              {variacao !== null && <TagDelta valor={variacao} />}
            </span>
          </Celula>
        );
      })}
    </LinhaTabela>
  );
}
