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

export interface CabecalhoTelaProps {
  titulo: string;
  /** Uma linha de apoio, no tom do portal: o que a tela responde. */
  apoio?: string;
  /** Controles da tela (filtro de semestre, glossário, cronograma). */
  acoes?: React.ReactNode;
  /** Conteúdo abaixo do título (ex.: seletor primário). */
  children?: React.ReactNode;
  testId?: string;
}

/**
 * Cabeçalho de tela: título, uma linha de apoio e um slot de ações à direita.
 *
 * Não é sticky (pedido de 09/08): ele faz parte da página e sai de cena com o
 * scroll, como qualquer outro bloco. Também não carrega chips de recorte —
 * instituição e simulados continuam ditos onde são controle (cartão da
 * sidebar, filtro de semestre, seletor de simulados).
 */
export function CabecalhoTela({ titulo, apoio, acoes, children, testId }: CabecalhoTelaProps) {
  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <h1
            className="text-foreground"
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
              className="mt-1 text-muted-foreground"
              style={{ fontSize: 'var(--gp-font-size-apoio)' }}
            >
              {apoio}
            </p>
          ) : null}
        </div>
        {acoes ? <div className="ml-auto flex flex-wrap items-center gap-2.5">{acoes}</div> : null}
      </div>
      {children}
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
