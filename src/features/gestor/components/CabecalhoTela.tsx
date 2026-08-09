import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Moldura e cabeçalho canônicos de TELA do Portal do Gestor (auditoria de
 * 09/08, itens B2 e B3).
 *
 * Antes disto cada rota repetia `className="space-y-6 p-8"` na mão (e o
 * esqueleto de rota do shell usava uma terceira moldura, `max-w-[1120px]
 * px-6 py-8`, que nenhuma tela replicava — o conteúdo real "pulava" de
 * largura quando o skeleton saía), e o par título/subtítulo era remontado
 * em cada arquivo com `fontSize` cru. Aqui mora a régua:
 *
 *  - `ContainerRota`: o único padding e o único ritmo vertical de rota.
 *  - `CabecalhoTela`: h1 na escala `display`, apoio, slot de ações à direita
 *    e — a parte nova — a BARRA DE CONTEXTO, que fica colada no topo da área
 *    rolável.
 *
 * Por que a barra é sticky: o recorte vigente (instituição · semestre ·
 * simulados) morava em controles no corpo da página e sumia no primeiro
 * scroll. Nas telas longas do portal (Visão Geral passa de 3000px) o gestor
 * lia número sem saber de que corte ele era — e a resposta estava a um
 * scroll-to-top de distância, toda vez. Sticky, o corte é sempre visível e
 * os controles continuam no mesmo lugar de sempre.
 */

/** Padding e ritmo únicos de rota. Também usado pelo esqueleto de rota do shell. */
export function ContainerRota({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  // Padding responsivo (auditoria de 09/08, B7): 32px é a moldura da
  // referência em desktop, mas em telefone ela come 64px dos ~390px de
  // largura — abaixo de `lg` a moldura cai para 20/24px. O cabeçalho sticky
  // compensa com os mesmos degraus (ver CabecalhoTela).
  return (
    <div className={cn('space-y-6 p-5 sm:p-6 lg:p-8', className)} {...rest}>


      {children}
    </div>
  );
}

/**
 * Chip de leitura do recorte: rótulo em caixa alta + valor. Não é controle —
 * quem troca o corte continua sendo o seletor de IES (sidebar), o
 * `FiltroSemestre` e o `SeletorSimulados`, cada um no seu lugar. O chip
 * responde "que corte é este?", que é uma pergunta de leitura.
 */
export function ChipRecorte({
  rotulo,
  valor,
  testId,
}: {
  rotulo: string;
  valor: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex max-w-full items-center gap-1.5 truncate border"
      style={{
        padding: '3px var(--gp-space-2)',
        borderRadius: 'var(--gp-radius-pill)',
        borderColor: 'var(--gp-border-subtle)',
        background: 'var(--gp-surface-2)',
        fontSize: 'var(--gp-font-size-apoio)',
        color: 'var(--gp-text-1)',
      }}
    >
      <span
        className="uppercase"
        style={{
          fontSize: 'var(--gp-font-size-micro)',
          fontWeight: 'var(--gp-font-weight-medio)' as unknown as number,
          letterSpacing: 'var(--gp-font-tracking-micro)',
          color: 'var(--gp-text-3)',
        }}
      >
        {rotulo}
      </span>
      <span className="truncate">{valor}</span>
    </span>
  );
}

export interface CabecalhoTelaProps {
  titulo: string;
  /** Uma linha de apoio, no tom do portal: o que a tela responde. */
  apoio?: string;
  /** Controles da tela (filtro de semestre, glossário, cronograma). */
  acoes?: React.ReactNode;
  /** Chips de leitura do recorte — normalmente `ChipRecorte`. */
  contexto?: React.ReactNode;
  /** Conteúdo abaixo da barra, ainda dentro da faixa sticky (ex.: seletor primário). */
  children?: React.ReactNode;
  testId?: string;
}

/**
 * Faixa de cabeçalho. As margens negativas cancelam o padding do
 * `ContainerRota` para a faixa pintar de ponta a ponta enquanto o conteúdo
 * passa por baixo — sem elas o fundo sticky ficaria com 32px transparentes
 * de cada lado e o conteúdo apareceria por trás nas beiradas.
 *
 * `backgroundColor` sólido (`--gp-bg-app`), não semi-transparente: o fundo da
 * área de conteúdo é um gradiente (`--gp-bg-app-gradient`), e qualquer alfa
 * aqui deixaria o texto rolando visível por baixo do título.
 */
export function CabecalhoTela({
  titulo,
  apoio,
  acoes,
  contexto,
  children,
  testId,
}: CabecalhoTelaProps) {
  return (
    <div
      data-testid={testId}
      className="sticky top-0 z-20 -mx-8 -mt-8 px-8 pb-3 pt-6"
      style={{
        backgroundColor: 'var(--gp-bg-app)',
        borderBottom: '1px solid var(--gp-border-subtle)',
      }}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <h1
            style={{
              fontSize: 'var(--gp-font-size-display)',
              fontWeight: 'var(--gp-font-weight-forte)' as unknown as number,
              letterSpacing: 'var(--gp-font-tracking-display)',
            }}
          >
            {titulo}
          </h1>
          {apoio ? (
            <p
              className="mt-0.5 text-muted-foreground"
              style={{ fontSize: 'var(--gp-font-size-apoio)' }}
            >
              {apoio}
            </p>
          ) : null}
        </div>
        {acoes ? <div className="ml-auto flex flex-wrap items-center gap-2.5">{acoes}</div> : null}
      </div>

      {contexto ? (
        <div
          data-testid="barra-contexto"
          className="mt-2.5 flex flex-wrap items-center gap-1.5"
          /* Leitura, não navegação: o leitor de tela anuncia como grupo com
             nome, para o corte não virar uma sequência de chips soltos. */
          role="group"
          aria-label="Recorte em exibição"
        >
          {contexto}
        </div>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

/**
 * Título de BLOCO (card). Segundo degrau da escala — o mesmo papel que hoje
 * aparece no código como 16/700, 15/700 e `text-base font-semibold`.
 */
export function TituloBloco({
  children,
  id,
  className,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={className}
      style={{
        fontSize: 'var(--gp-font-size-h2)',
        fontWeight: 'var(--gp-font-weight-forte)' as unknown as number,
      }}
    >
      {children}
    </h2>
  );
}
