/**
 * Declaração do matcher `toHaveNoViolations` (vitest-axe) para o TypeScript.
 *
 * O `expect.extend(axeMatchers)` de `src/test/setup.ts` registra o matcher em
 * runtime, e o `/// <reference types="vitest-axe/extend-expect" />` de lá
 * deveria bastar — mas a augmentação que o `vitest-axe@0.1.0` traz mira o tipo
 * `Assertion` de uma versão anterior do Vitest e não alcança o do Vitest 3,
 * que é o que roda neste repo. Sem esta declaração, `npm run type-check`
 * acusa TS2339 em toda chamada de `toHaveNoViolations`, e o teste de
 * acessibilidade da Task 58 derruba o type-check inteiro.
 */
import 'vitest';

interface MatchersAcessibilidade<R = unknown> {
  toHaveNoViolations(): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends MatchersAcessibilidade<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends MatchersAcessibilidade {}
}
