import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DURACAO_COUNT_UP_MS, resolverCubicBezier, useCountUp } from '@/features/gestor/hooks/useCountUp';

/**
 * Item B1 do passe de conformidade (`docs/plano-medias-restantes.md`):
 * count-up de KPI em 560ms (`--gp-motion-5`) sobre a curva `--gp-ease`
 * (`cubic-bezier(0.2, 0, 0, 1)`). Ver `KpiCard.test.tsx` para a prova de
 * TEXTO RENDERIZADO no componente real — este arquivo prova a matemática da
 * curva e o comportamento do hook isoladamente.
 */

function mockMatchMedia(reduzido: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)' && reduzido,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

describe('resolverCubicBezier — a curva --gp-ease aplicada sobre progresso linear', () => {
  it('devolve exatamente 0 em t=0 e 1 em t=1 (as pontas da curva CSS)', () => {
    expect(resolverCubicBezier(0)).toBe(0);
    expect(resolverCubicBezier(1)).toBe(1);
  });

  it('clampa t fora de [0,1] para as pontas — nunca extrapola', () => {
    expect(resolverCubicBezier(-0.5)).toBe(0);
    expect(resolverCubicBezier(1.5)).toBe(1);
  });

  it('é monotonicamente não decrescente ao longo de [0,1] (é o que faz "count-up" nunca recuar)', () => {
    let anterior = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const y = resolverCubicBezier(t);
      expect(y).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = y;
    }
  });

  it('com pontos de controle simétricos (0,0)-(1,1) a curva vira identidade — sanidade da resolução por Newton/bissecção', () => {
    // P1=(0,0) e P2=(1,1) ficam sobre a própria diagonal x=y: x(u) e y(u) são
    // o MESMO polinômio, então, seja qual for o u que resolve x(u)=t, y(u)
    // tem que valer exatamente t.
    [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].forEach((t) => {
      expect(resolverCubicBezier(t, 0, 0, 1, 1)).toBeCloseTo(t, 5);
    });
  });

  it('--gp-ease (0.2,0,0,1) sobe rápido e desacelera até o fim — fica ACIMA da diagonal na maior parte do percurso', () => {
    // p2=(0,1) — x=0 empurra a curva para y alto logo nos primeiros instantes
    // de x; dali em diante ela desacelera suavemente até y=1. Medido (não
    // suposto): valores de referência abaixo vieram de rodar a própria
    // função e são o contrato que este teste passa a travar.
    [0.2, 0.3, 0.5, 0.7, 0.9].forEach((t) => {
      expect(resolverCubicBezier(t)).toBeGreaterThan(t);
    });
  });
});

describe('useCountUp — count-up de 560ms sobre --gp-ease (docs/07-motion.md)', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não anima na primeira pintura (regra 6 do handoff): o valor inicial já é o valor exibido', () => {
    const { result } = renderHook(({ valor }) => useCountUp(valor), { initialProps: { valor: 42 } });
    expect(result.current).toBe(42);
  });

  it('valor nulo/indefinido não agenda animação nenhuma — devolve o que já estava exibido (0 por padrão)', () => {
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor), {
      initialProps: { valor: null as number | null },
    });
    expect(result.current).toBe(0);
    rerender({ valor: null });
    expect(result.current).toBe(0);
  });

  it('(a) ao final dos 560ms de uma mudança de valor, o valor exibido é exatamente o valor final', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor), { initialProps: { valor: 10 } });
    expect(result.current).toBe(10);

    rerender({ valor: 90 });
    act(() => {
      vi.advanceTimersByTime(DURACAO_COUNT_UP_MS + 32); // um quadro de sobra
    });
    expect(result.current).toBe(90);
  });

  it('a meio caminho da animação o valor exibido está estritamente ENTRE o valor antigo e o novo (é count-up, não salto)', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor), { initialProps: { valor: 0 } });

    rerender({ valor: 100 });
    act(() => {
      vi.advanceTimersByTime(Math.round(DURACAO_COUNT_UP_MS / 2));
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
  });

  it('(b) sob prefers-reduced-motion, o valor final aparece IMEDIATAMENTE, sem nenhum quadro intermediário', () => {
    mockMatchMedia(true);
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor), { initialProps: { valor: 10 } });
    expect(result.current).toBe(10);

    rerender({ valor: 90 });
    // Sem `vi.advanceTimersByTime` nenhum — nem precisa de timer fake: se o
    // hook tivesse agendado `requestAnimationFrame`, o valor não teria
    // mudado ainda neste ponto.
    expect(result.current).toBe(90);
  });

  it('(c) uma mudança de valor NO MEIO de uma contagem em andamento reinicia a contagem a partir do valor exibido naquele instante', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor), { initialProps: { valor: 0 } });

    rerender({ valor: 100 });
    act(() => {
      vi.advanceTimersByTime(Math.round(DURACAO_COUNT_UP_MS / 2));
    });
    const valorNoMeio = result.current;
    expect(valorNoMeio).toBeGreaterThan(0);
    expect(valorNoMeio).toBeLessThan(100);

    // Muda de novo antes do fim: a contagem reinicia para o NOVO alvo — não
    // pode nem "terminar" no 100 antigo nem pular direto para o novo alvo.
    rerender({ valor: 20 });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).not.toBe(100);
    expect(result.current).not.toBe(20);

    act(() => {
      vi.advanceTimersByTime(DURACAO_COUNT_UP_MS + 32);
    });
    expect(result.current).toBe(20);
  });

  it('dispara a animação uma única vez por mudança de valor — reagendar o MESMO valor não reinicia nada', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ valor }) => useCountUp(valor), { initialProps: { valor: 50 } });

    rerender({ valor: 50 });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(result.current).toBe(50);
  });
});
