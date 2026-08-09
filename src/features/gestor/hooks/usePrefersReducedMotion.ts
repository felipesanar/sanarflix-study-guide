import * as React from 'react';

const QUERY_MOVIMENTO_REDUZIDO = '(prefers-reduced-motion: reduce)';

/**
 * Leitura pontual (sem assinatura de mudança) de `prefers-reduced-motion:
 * reduce` — mesma checagem que `useCountUp.ts` fazia isolada
 * (`prefereMovimentoReduzido`, spec de motion §23/§10 do handoff) antes deste
 * hook existir. Exportada para os dois casos de uso do portal:
 * - dentro de um `useEffect`/callback que já roda fora do fluxo de render
 *   (ex.: decidir se anima um frame de `requestAnimationFrame`), onde não faz
 *   sentido pagar o `useState`+`addEventListener` de `usePrefersReducedMotion`;
 * - como implementação de base do próprio `usePrefersReducedMotion` abaixo.
 *
 * Guard de ambiente (SSR, ou teste sem `window.matchMedia` mockado): devolve
 * `false` — nunca lança por falta de `matchMedia`.
 */
export function prefereMovimentoReduzido(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY_MOVIMENTO_REDUZIDO).matches;
}

/**
 * `prefers-reduced-motion: reduce` como estado reativo (spec de motion §23):
 * ao contrário de `prefereMovimentoReduzido()` (leitura pontual, sem
 * assinatura), este hook ESCUTA a mudança da media feature — o usuário pode
 * alternar a preferência no sistema operacional com a aba aberta, e qualquer
 * componente que decide "anima ou não" a partir deste hook re-renderiza na
 * hora, sem precisar de reload.
 *
 * `addEventListener('change', ...)` no `MediaQueryList` (não
 * `addListener`, API legada e descontinuada) — o mesmo objeto que
 * `window.matchMedia` devolve dispara `change` a cada alternância da
 * preferência do sistema.
 *
 * Guard de ambiente igual a `prefereMovimentoReduzido()`: sem `window`/
 * `matchMedia` (SSR, teste sem mock global), devolve `false` e nunca assina
 * nada.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduzido, setReduzido] = React.useState<boolean>(() => prefereMovimentoReduzido());

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const media = window.matchMedia(QUERY_MOVIMENTO_REDUZIDO);
    const aoMudar = (evento: MediaQueryListEvent) => setReduzido(evento.matches);

    setReduzido(media.matches);
    media.addEventListener('change', aoMudar);
    return () => media.removeEventListener('change', aoMudar);
  }, []);

  return reduzido;
}
