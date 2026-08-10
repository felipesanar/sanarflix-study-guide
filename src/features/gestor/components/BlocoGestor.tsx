import * as React from 'react';
import { cn } from '@/lib/utils';
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';

/** Acima disto o bloco é alto o bastante para valer a silhueta, não a mancha. */
const ALTURA_MINIMA_SILHUETA = 120;

export type EstadoBloco = 'ok' | 'loading' | 'empty' | 'error';

export interface BlocoGestorProps {
  titulo?: string;
  estado: EstadoBloco;
  aoTentarNovamente?: () => void;
  mensagemVazio?: string;
  /**
   * Glifo do vazio deste bloco. A referência §9 não tem ícone genérico de
   * vazio: `calendar_month` quando não houve simulado no período, `schedule`
   * quando o gabarito ainda está processando, `insights` quando o recorte
   * simplesmente não produziu leitura.
   */
  glifoVazio?: DendeIconName;
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
  /**
   * Opt-in (refino 10/08, card "Proficiência por semestre" de
   * `routes/Detalhamento.tsx`): quando `true`, o bloco carregado
   * (`estado === 'ok'`) CRESCE para ocupar a altura que o layout externo
   * reservou para ele, em vez de parar na altura natural do próprio
   * conteúdo. O gatilho é o grid ao lado daquele card, que estica os dois
   * lados na altura do mais alto — sem isto, o card mais curto sobrava em
   * branco por baixo do próprio conteúdo, dentro da própria borda.
   *
   * `false` (o default) preserva o comportamento de sempre — todo outro
   * chamador de `BlocoGestor` continua com altura pelo conteúdo. Loading/
   * erro/vazio não mudam: os três já recebem `altura` explícita
   * (`alturaSkeleton`) e não precisam deste flex.
   */
  preencherAltura?: boolean;
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
  glifoVazio,
  parcial = false,
  alturaSkeleton = 300,
  testIdLoading,
  bloco,
  preencherAltura = false,
  children,
}: BlocoGestorProps) {
  return (
    <section className={cn('space-y-2', preencherAltura && 'flex flex-1 flex-col')}>
      {titulo ? <h2 className="text-sm font-semibold">{titulo}</h2> : null}

      {parcial ? (
        // Item B3 do passe de conformidade: a faixa era indistinguível de uma
        // nota informativa (sem ícone, tokens neutros). Anatomia copiada de
        // `SeletorSimulados.tsx` (`aviso-legibilidade`) — mesmos tokens de
        // warning e mesmo ícone `error_outline`, para o aviso de recorte
        // parcial ler como ALERTA, não como rodapé qualquer.
        <div
          data-testid="faixa-parcial"
          role="status"
          className="flex gap-2.5"
          style={{
            background: 'var(--gp-warning-surface)',
            border: '1px solid var(--gp-warning)',
            borderRadius: 'var(--gp-radius-sm)',
            padding: '10px 13px',
          }}
        >
          <Icon
            name="error_outline"
            size={16}
            className="shrink-0 text-[color:var(--gp-warning-on)]"
          />
          <span style={{ fontSize: 11, lineHeight: '16px', color: 'var(--gp-warning-on)' }}>
            Recorte parcial: parte dos simulados do período não entrou neste cálculo.
          </span>
        </div>
      ) : null}

      {estado === 'loading' ? (
        <div data-testid={testIdLoading}>
          <GestorSkeleton
            altura={alturaSkeleton}
            forma={alturaSkeleton >= ALTURA_MINIMA_SILHUETA ? 'cartao' : 'bloco'}
            rotulo={titulo ? `Carregando ${titulo}` : 'Carregando bloco'}
          />
        </div>
      ) : estado === 'error' ? (
        <EstadoErro altura={alturaSkeleton} onRetry={aoTentarNovamente ?? (() => undefined)} />
      ) : estado === 'empty' ? (
        <EstadoVazio titulo={mensagemVazio} glifo={glifoVazio} altura={alturaSkeleton} />
      ) : preencherAltura ? (
        // Wrapper SÓ neste ramo: os demais chamadores (o default) continuam
        // com `BlocoErrorBoundary` direto, sem nenhum elemento novo na árvore.
        <div className="min-h-0 flex-1">
          <BlocoErrorBoundary bloco={bloco ?? testIdLoading ?? 'bloco-gestor'}>{children}</BlocoErrorBoundary>
        </div>
      ) : (
        <BlocoErrorBoundary bloco={bloco ?? testIdLoading ?? 'bloco-gestor'}>{children}</BlocoErrorBoundary>
      )}
    </section>
  );
}
