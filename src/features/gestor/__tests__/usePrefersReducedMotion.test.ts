import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { prefereMovimentoReduzido, usePrefersReducedMotion } from '@/features/gestor/hooks/usePrefersReducedMotion';

/**
 * Onda 1 (`docs/superpowers/plans/2026-08-09-gestor-motion-e-loading.md`):
 * generalização de `prefereMovimentoReduzido` (extraída de `useCountUp.ts`,
 * onde já cobria a checagem pontual) para um hook reativo que assina a
 * mudança de `prefers-reduced-motion` (spec de motion §23).
 */

type Ouvinte = (evento: MediaQueryListEvent) => void;

/**
 * Mock de `window.matchMedia` que GUARDA o listener passado a
 * `addEventListener('change', ...)` — ao contrário do mock global de
 * `src/test/setup.ts` (que devolve um `vi.fn()` inerte), este permite
 * disparar `change` manualmente e provar que o hook reage.
 */
function mockMatchMedia(inicial: boolean) {
  let ouvinte: Ouvinte | null = null;
  let matches = inicial;

  // Mesma instância devolvida em TODA chamada de `window.matchMedia` para
  // esta query — é o que o browser real faz (o `MediaQueryList` é estável
  // por query) e é o que permite ao teste de cleanup abaixo inspecionar o
  // MESMO `removeEventListener` que o hook realmente chamou, em vez de um
  // espião novo e desconectado.
  const instancia = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((tipo: string, cb: Ouvinte) => {
      if (tipo === 'change') ouvinte = cb;
    }),
    removeEventListener: vi.fn((tipo: string) => {
      if (tipo === 'change') ouvinte = null;
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  vi.mocked(window.matchMedia).mockImplementation(() => instancia);

  return {
    instancia,
    dispararMudanca(novoValor: boolean) {
      matches = novoValor;
      ouvinte?.({ matches: novoValor } as MediaQueryListEvent);
    },
  };
}

describe('prefereMovimentoReduzido — leitura pontual, sem assinatura', () => {
  it('lê window.matchMedia com a media feature correta', () => {
    mockMatchMedia(true);
    expect(prefereMovimentoReduzido()).toBe(true);

    mockMatchMedia(false);
    expect(prefereMovimentoReduzido()).toBe(false);
  });

  it('sem window.matchMedia (guard de ambiente), devolve false em vez de lançar', () => {
    const original = window.matchMedia;
    delete (window as { matchMedia?: unknown }).matchMedia;
    expect(prefereMovimentoReduzido()).toBe(false);
    window.matchMedia = original;
  });
});

describe('usePrefersReducedMotion — estado reativo (spec de motion §23)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devolve o valor inicial da media feature', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('devolve false quando a preferência do sistema não pede movimento reduzido', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('reage a uma mudança de preferência em tempo real (o usuário alterna no SO com a aba aberta)', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      media.dispararMudanca(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      media.dispararMudanca(false);
    });
    expect(result.current).toBe(false);
  });

  it('remove o listener ao desmontar (sem vazar assinatura entre montagens)', () => {
    const { instancia } = mockMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    unmount();
    expect(instancia.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
