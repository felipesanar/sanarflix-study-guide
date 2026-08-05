import * as React from 'react';
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';

export type EstadoBloco = 'ok' | 'loading' | 'empty' | 'error';

export interface BlocoGestorProps {
  titulo?: string;
  estado: EstadoBloco;
  aoTentarNovamente?: () => void;
  mensagemVazio?: string;
  /** Faixa de aviso quando `meta.partial` é `true` — recorte não cobre todos os simulados do período. */
  parcial?: boolean;
  alturaSkeleton?: number;
  /** `data-testid` do wrapper de loading, para blocos que precisam ser localizados no teste de integração da rota. */
  testIdLoading?: string;
  /**
   * Identificador do bloco para telemetria de erro de RENDER, repassado ao
   * `BlocoErrorBoundary` (spec §10). Quando omitido, cai para `testIdLoading`
   * — mas o chamador deveria nomear cada bloco explicitamente, como já faz
   * em `testIdLoading` (achado 1, revisão 03/08).
   */
  bloco?: string;
  children: React.ReactNode;
}

/**
 * Casca de bloco da Visão Geral (spec §8.4): 4 estados (`loading`/`empty`/
 * `error`/`ok`) derivados da query da TELA (`useVisaoGeral`), reusando as
 * primitivas da Fase 2 (`GestorSkeleton`/`EstadoVazio`/`EstadoErro`) — nunca
 * skeleton/empty/erro ad hoc.
 *
 * No estado `ok`, os `children` ficam dentro de `BlocoErrorBoundary` (Fase
 * 2): um erro de RENDER de um bloco (bug de UI, não de dado) fica contido
 * ali com o MESMO contrato que o resto do portal usa para essa falha —
 * `role="alert"`, retry (`resetErrorBoundary`) e `onError` — em vez de um
 * fallback ad hoc. Este componente continua concentrando os OUTROS 3
 * estados (loading/empty/error de QUERY), que `BlocoErrorBoundary` não
 * cobre.
 */
export function BlocoGestor({
  titulo,
  estado,
  aoTentarNovamente,
  mensagemVazio = 'Sem dados neste recorte.',
  parcial = false,
  alturaSkeleton = 300,
  testIdLoading,
  bloco,
  children,
}: BlocoGestorProps) {
  return (
    <section className="space-y-2">
      {titulo ? <h2 className="text-sm font-semibold">{titulo}</h2> : null}

      {parcial ? (
        <p
          data-testid="faixa-parcial"
          role="status"
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          Recorte parcial: parte dos simulados do período não entrou neste cálculo.
        </p>
      ) : null}

      {estado === 'loading' ? (
        <div data-testid={testIdLoading}>
          <GestorSkeleton
            altura={alturaSkeleton}
            rotulo={titulo ? `Carregando ${titulo}` : 'Carregando bloco'}
          />
        </div>
      ) : estado === 'error' ? (
        <EstadoErro altura={alturaSkeleton} onRetry={aoTentarNovamente ?? (() => undefined)} />
      ) : estado === 'empty' ? (
        <EstadoVazio titulo={mensagemVazio} altura={alturaSkeleton} />
      ) : (
        <BlocoErrorBoundary bloco={bloco ?? testIdLoading ?? 'bloco-gestor'}>{children}</BlocoErrorBoundary>
      )}
    </section>
  );
}
