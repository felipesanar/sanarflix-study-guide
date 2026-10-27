import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BlocoGestor, type EstadoBloco } from '@/features/gestor/components/BlocoGestor';
import { TituloBloco } from '@/features/gestor/components/CabecalhoTela';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import type { Meta } from '@/features/gestor/api/types';

/** `meta` de quem ainda não tem dado (carregando ou com erro): rastreabilidade sem afirmar nada. */
export const META_VAZIA_ENGAJAMENTO: Meta = {
  periodo: '—',
  fonte: '—',
  atualizadoEm: '',
  criterio: '—',
  partial: false,
  lowSample: false,
};

/** O que `BlocoEngajamento` precisa saber de uma consulta (compatível com `ResultadoGestor`). */
export interface ConsultaDoBloco {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  /** `true` = o dado em tela é o do recorte anterior (§11, "Trocando filtro"). */
  isPlaceholderData?: boolean;
  refetch: () => void;
}

/**
 * Estado do bloco a partir da consulta (§11): erro → `error`; sem dado ainda →
 * `loading`; com dado → `ok`. Dado do recorte anterior (placeholder) é `ok`:
 * ele fica na tela, sinalizado por opacidade e `aria-busy`, nunca vira "vazio".
 */
export function estadoDaConsulta(c: Pick<ConsultaDoBloco, 'data' | 'isLoading' | 'isError'>): EstadoBloco {
  if (c.isError && c.data === undefined) return 'error';
  if (c.data === undefined) return c.isLoading ? 'loading' : 'error';
  return 'ok';
}

export interface BlocoEngajamentoProps {
  titulo: string;
  /** Linha em maiúsculas acima do título ("Acompanhamento"). */
  sobretitulo?: string;
  descricao?: React.ReactNode;
  /** Link ou botão à direita do título ("Abrir taxonomia →", seletor de métrica…). */
  acao?: React.ReactNode;
  consulta: ConsultaDoBloco;
  /** `true` troca o conteúdo pelo estado vazio com `mensagemVazio`. */
  vazio?: boolean;
  mensagemVazio?: string;
  /** Altura reservada do skeleton, para o bloco não saltar ao carregar. */
  alturaSkeleton?: number;
  /** Nome do bloco para a telemetria de erro de render e o `data-testid`. */
  bloco: string;
  /** Texto abaixo do conteúdo (rodapés da §12). */
  rodape?: React.ReactNode;
  /** `true`: o cartão cresce até a altura que o grid reservou (blocos lado a lado com a mesma altura). */
  preencherAltura?: boolean;
  children: React.ReactNode;
}

/**
 * Casca de todo bloco do Engajamento (spec §10.5 e §11): `BlocoGestor` para os
 * quatro estados e um cartão com `TituloBloco`, descrição e rodapé para o `ok`.
 *
 * - Carregando: o skeleton só aparece depois de 400 ms (`useDelayedLoading`); até
 *   lá, uma área em branco da mesma altura, para não haver salto nem flash.
 * - Trocando filtro (`isPlaceholderData`): o dado anterior fica a 60% de opacidade
 *   com `aria-busy="true"`.
 * - Erro: "Tentar novamente" refaz a consulta. Cada bloco tem o seu
 *   `BlocoErrorBoundary` (dentro do `BlocoGestor`), então um erro não derruba os outros.
 */
export function BlocoEngajamento({
  titulo,
  sobretitulo,
  descricao,
  acao,
  consulta,
  vazio = false,
  mensagemVazio,
  alturaSkeleton = 240,
  bloco,
  rodape,
  preencherAltura = false,
  children,
}: BlocoEngajamentoProps) {
  const base = estadoDaConsulta(consulta);
  const estado: EstadoBloco = base === 'ok' && vazio ? 'empty' : base;
  const mostrarSkeleton = useDelayedLoading(estado === 'loading');
  const ocupado = consulta.isPlaceholderData === true;
  const idTitulo = `titulo-${bloco}`;

  if (estado === 'loading' && !mostrarSkeleton) {
    return <div data-testid={`${bloco}-aguardando`} aria-hidden="true" style={{ minHeight: alturaSkeleton }} />;
  }

  return (
    <div
      data-testid={`bloco-${bloco}`}
      aria-busy={ocupado ? true : undefined}
      className={cn('min-w-0 transition-opacity', ocupado && 'opacity-60', preencherAltura && 'flex h-full flex-col')}
    >
      <BlocoGestor
        estado={estado}
        alturaSkeleton={alturaSkeleton}
        bloco={bloco}
        testIdLoading={`${bloco}-loading`}
        mensagemVazio={mensagemVazio}
        aoTentarNovamente={consulta.refetch}
        preencherAltura={preencherAltura}
      >
        <section aria-labelledby={idTitulo} className={preencherAltura ? 'h-full' : undefined}>
          <Card className={preencherAltura ? 'h-full' : undefined} style={{ borderRadius: 'var(--gp-radius-lg)', boxShadow: 'var(--gp-shadow-card)' }}>
            <CardContent className={cn('flex flex-col', preencherAltura && 'h-full')} style={{ padding: 18, gap: 14 }}>
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  {sobretitulo ? (
                    <p
                      className="uppercase"
                      style={{
                        fontSize: 'var(--gp-font-size-label)',
                        letterSpacing: 'var(--gp-font-tracking-label)',
                        color: 'var(--gp-text-3)',
                      }}
                    >
                      {sobretitulo}
                    </p>
                  ) : null}
                  <TituloBloco id={idTitulo}>{titulo}</TituloBloco>
                  {descricao ? (
                    <p style={{ marginTop: 2, fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{descricao}</p>
                  ) : null}
                </div>
                {acao ? <div className="shrink-0">{acao}</div> : null}
              </div>
              {children}
              {rodape ? (
                <p style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{rodape}</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </BlocoGestor>
    </div>
  );
}
