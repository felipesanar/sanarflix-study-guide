import * as React from 'react';

/**
 * Duração do count-up de KPI (handoff `docs/07-motion.md:13,43`,
 * `docs/06-data-viz.md:12`, `docs/11-acessibilidade.md:39`,
 * `prompts/03-visao-geral.md:17`) — `--gp-motion-5` (`gestor-theme.css:92`).
 * Não importamos o token CSS aqui: este número é usado em matemática de JS
 * (`requestAnimationFrame`), não em `style`, e o valor precisa ser um
 * `number` para a conta de progresso — duplicar o literal é o preço de não
 * ter uma ponte CSS→JS no repo para tokens de tempo.
 */
export const DURACAO_COUNT_UP_MS = 560;

/**
 * Pontos de controle da curva `--gp-ease` (`gestor-theme.css:93`):
 * `cubic-bezier(0.2, 0, 0, 1)`. Mesmo motivo do literal acima — `resolverCubicBezier`
 * roda em JS, sobre o número intermediário do count-up, não em CSS.
 */
const EASE_P1X = 0.2;
const EASE_P1Y = 0;
const EASE_P2X = 0;
const EASE_P2Y = 1;

function componenteBezier(u: number, p1: number, p2: number): number {
  const mu = 1 - u;
  return 3 * mu * mu * u * p1 + 3 * mu * u * u * p2 + u * u * u;
}

function derivadaComponenteBezier(u: number, p1: number, p2: number): number {
  const mu = 1 - u;
  return 3 * mu * mu * p1 + 6 * mu * u * (p2 - p1) + 3 * u * u * (1 - p2);
}

/**
 * Resolve `y` de uma curva `cubic-bezier` CSS dado `t` (progresso LINEAR de
 * tempo em [0,1] — o `t` que `requestAnimationFrame` te dá, não o `x` da
 * curva). Uma `cubic-bezier(p1x,p1y,p2x,p2y)` do CSS é parametrizada por uma
 * variável interna `u`: `x(u)` decide QUANDO (mapeia tempo→progresso na
 * curva) e `y(u)` decide O QUANTO (o valor de saída). Para aplicar a curva
 * sobre `t`, resolve-se `u` tal que `x(u) = t` e devolve-se `y(u)`.
 *
 * `x(u)` é monotônica em [0,1] para toda curva CSS válida, então
 * Newton-Raphson converge em poucas iterações; a bissecção de segurança
 * cobre o caso em que a derivada quase zera perto das pontas (`--gp-ease`
 * tem `p1y = 0` e `p2x = 0`, então isso acontece perto de t=0).
 *
 * Testável isoladamente (`useCountUp.test.ts`): é matemática pura, sem
 * `requestAnimationFrame` nem estado de React.
 */
export function resolverCubicBezier(
  t: number,
  p1x: number = EASE_P1X,
  p1y: number = EASE_P1Y,
  p2x: number = EASE_P2X,
  p2y: number = EASE_P2Y,
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  let u = t;
  for (let i = 0; i < 8; i++) {
    const erro = componenteBezier(u, p1x, p2x) - t;
    if (Math.abs(erro) < 1e-6) break;
    const derivada = derivadaComponenteBezier(u, p1x, p2x);
    if (Math.abs(derivada) < 1e-6) break;
    const proximo = u - erro / derivada;
    if (!Number.isFinite(proximo) || proximo <= 0 || proximo >= 1) break;
    u = proximo;
  }

  // Bissecção de segurança: só continua refinando se Newton não convergiu
  // dentro da tolerância (derivada quase nula ou passo saiu de [0,1]).
  let lo = 0;
  let hi = 1;
  let candidato = u;
  for (let i = 0; i < 24 && Math.abs(componenteBezier(candidato, p1x, p2x) - t) > 1e-6; i++) {
    if (componenteBezier(candidato, p1x, p2x) < t) lo = candidato;
    else hi = candidato;
    candidato = (lo + hi) / 2;
  }

  return componenteBezier(candidato, p1y, p2y);
}

function prefereMovimentoReduzido(): boolean {
  // jsdom não implementa a media feature de verdade (ver cabeçalho de
  // `__tests__/movimento.test.tsx`) — os testes deste hook mockam
  // `window.matchMedia` (mesmo padrão de `src/test/setup.ts`), e é isso que
  // esta checagem lê. Guard de ambiente (SSR, ou teste sem o mock global)
  // devolve `false` — nunca lançar por falta de `matchMedia`.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Count-up de KPI (handoff, ver `DURACAO_COUNT_UP_MS`): anima de um valor
 * numérico para o próximo em `duracaoMs`, seguindo `--gp-ease`.
 *
 * **Não anima na primeira pintura** (`docs/07-motion.md` regra 6: "nada
 * anima na primeira pintura além do reveal em cascata") — a primeira vez que
 * o hook vê um `valor` já é o número exibido, sem contagem. Só uma MUDANÇA
 * de valor depois de montado dispara a animação — e dispara uma vez por
 * mudança, nunca em todo render, porque o efeito abaixo só roda quando
 * `valor` (ou `duracaoMs`) muda.
 *
 * `valor` nulo/indefinido significa "sem número para animar" (KPI vazio ou
 * sem dado ainda) — o hook não agenda frame nenhum e devolve o que já
 * estava exibido.
 *
 * Sob `prefers-reduced-motion: reduce`, o valor final aparece imediatamente,
 * sem nenhum quadro intermediário (handoff `docs/07-motion.md` regra 5).
 */
export function useCountUp(
  valor: number | null | undefined,
  duracaoMs: number = DURACAO_COUNT_UP_MS,
): number {
  const [valorExibido, setValorExibido] = React.useState<number>(() => valor ?? 0);
  // Espelha `valorExibido` de forma síncrona: o estado do React só some no
  // próximo render, e o efeito abaixo precisa do último valor JÁ EXIBIDO
  // (não do alvo da animação anterior) para saber de onde recomeçar quando
  // `valor` muda outra vez no meio de uma contagem em andamento.
  const valorAtualRef = React.useRef<number>(valor ?? 0);

  React.useEffect(() => {
    if (valor === null || valor === undefined) return undefined;

    const de = valorAtualRef.current;
    const paraOnde = valor;

    if (de === paraOnde) return undefined;

    if (prefereMovimentoReduzido()) {
      valorAtualRef.current = paraOnde;
      setValorExibido(paraOnde);
      return undefined;
    }

    const inicio =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    let frame: number;

    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      const progresso = resolverCubicBezier(t);
      const valorDoQuadro = de + (paraOnde - de) * progresso;
      valorAtualRef.current = valorDoQuadro;
      setValorExibido(valorDoQuadro);
      if (t < 1) {
        frame = requestAnimationFrame(passo);
      }
    };

    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracaoMs]);

  return valorExibido;
}
