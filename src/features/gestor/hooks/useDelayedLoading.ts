import * as React from 'react';

/**
 * Atraso padrão do skeleton (handoff `docs/08-arquitetura-frontend.md`,
 * spec de motion §7 — "a regra dos 400ms"): abaixo disso, o dado anterior
 * permanece na tela e faz cross-fade para o novo; só ACIMA disso o skeleton
 * chega a aparecer. Ver `docs/superpowers/plans/2026-08-09-gestor-motion-e-loading.md`,
 * Onda 1.
 */
export const ATRASO_SKELETON_MS = 400;

/**
 * Regra dos 400ms (spec de motion §7): `isLoading` só se traduz em "mostre o
 * skeleton" se permanecer verdadeiro por mais de `delay` ms. Numa rede boa,
 * a maioria das trocas de filtro responde em 150–300ms — sem este atraso, o
 * usuário veria um flash de skeleton a cada clique, o que faz um produto
 * rápido parecer instável.
 *
 * Comportamento:
 * - `isLoading` vira `true` → agenda um `setTimeout` de `delay` ms; se
 *   `isLoading` ainda for `true` quando o timer disparar, o hook passa a
 *   devolver `true`.
 * - `isLoading` vira `false` ANTES do timer disparar → o timer é limpo
 *   (`clearTimeout`) e o hook nunca chega a devolver `true` para esse ciclo
 *   de carregamento.
 * - `isLoading` vira `false` em qualquer momento → o hook volta a `false`
 *   imediatamente (o skeleton sai na hora que o dado chega, sem atraso de
 *   saída aqui — a transição de saída do skeleton é responsabilidade do
 *   componente que consome este hook, não deste hook).
 *
 * Sem dependência externa: só `setTimeout`/`clearTimeout` dentro de um único
 * `useEffect`, sem tocar em `performance.now()`/`requestAnimationFrame` — a
 * regra dos 400ms é sobre TEMPO DE PAREDE de uma requisição, não sobre uma
 * curva de animação.
 */
export function useDelayedLoading(isLoading: boolean, delay: number = ATRASO_SKELETON_MS): boolean {
  const [mostrar, setMostrar] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      setMostrar(false);
      return undefined;
    }

    const temporizador = setTimeout(() => setMostrar(true), delay);
    return () => clearTimeout(temporizador);
  }, [isLoading, delay]);

  return mostrar;
}
