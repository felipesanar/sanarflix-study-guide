import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ATRASO_SKELETON_MS, useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';

/**
 * Onda 1 (`docs/superpowers/plans/2026-08-09-gestor-motion-e-loading.md`):
 * a regra dos 400ms (spec de motion §7) — o skeleton só aparece se
 * `isLoading` permanecer `true` por mais de `delay` ms. Mesmo estilo de
 * `useCountUp.test.ts`: `vi.useFakeTimers()` para controlar o relógio sem
 * esperar de verdade.
 */
describe('useDelayedLoading — regra dos 400ms (spec de motion §7)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('isLoading=false desde o início nunca retorna true', () => {
    const { result } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: false },
    });
    expect(result.current).toBe(false);
  });

  it('isLoading=true por MENOS que o atraso: nunca chega a mostrar o skeleton (o flash que a regra elimina)', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(ATRASO_SKELETON_MS - 50);
    });
    expect(result.current).toBe(false);

    // O dado chega antes do atraso — isLoading vira false.
    rerender({ isLoading: false });
    expect(result.current).toBe(false);

    // Mesmo esperando o tempo que faltava, o timer já foi limpo: não vira true.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(false);
  });

  it('isLoading=true por MAIS que o atraso: passa a mostrar o skeleton', () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(ATRASO_SKELETON_MS + 1);
    });
    expect(result.current).toBe(true);
  });

  it('assim que isLoading volta a false, o hook volta a false imediatamente (sem esperar nenhum atraso de saída)', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(ATRASO_SKELETON_MS + 1);
    });
    expect(result.current).toBe(true);

    rerender({ isLoading: false });
    expect(result.current).toBe(false);
  });

  it('respeita um delay customizado, não só o padrão de 400ms', () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 100), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current).toBe(true);
  });

  it('um novo ciclo de loading (false→true→false→true) agenda um novo atraso a cada vez', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(ATRASO_SKELETON_MS + 1);
    });
    expect(result.current).toBe(true);

    rerender({ isLoading: false });
    expect(result.current).toBe(false);

    rerender({ isLoading: true });
    // Recém-reagendado: ainda não passou o atraso do novo ciclo.
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(ATRASO_SKELETON_MS + 1);
    });
    expect(result.current).toBe(true);
  });
});
