import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimuladoStorage } from '@/hooks/useSimuladoStorage';
import type { EstadoSimulado } from '@/types/simulado';

const SIMULADO_ID = 'simulado-teste';
const STORAGE_KEY = `simulado_${SIMULADO_ID}_estado`;

// setup.ts registra um mock global de localStorage cujos getItem/setItem/etc
// são vi.fn() sem implementação (não guardam nada) — serve para espiar
// chamadas, mas não para um teste que precisa que o valor realmente persista
// entre chamadas. Aqui trocamos por um mock funcional (Map em memória) só
// para este arquivo.
function instalarLocalStorageFuncional() {
  const store = new Map<string, string>();
  const mock: Storage = {
    getItem: vi.fn((key: string) => (store.has(key) ? (store.get(key) as string) : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('localStorage', mock);
}

function lerEstadoPersistido(): EstadoSimulado {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string);
}

describe('useSimuladoStorage — merge monotônico de contadores', () => {
  beforeEach(() => {
    instalarLocalStorageFuncional();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('registrarSaidaAba retorna a contagem incrementada e persiste no localStorage', () => {
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });

    let novoValor: number | null = null;
    act(() => {
      novoValor = result.current.registrarSaidaAba();
    });

    expect(novoValor).toBe(1);
    expect(lerEstadoPersistido().saidas_de_aba).toBe(1);
  });

  it('REGRESSÃO: salvarEstado com saidas_de_aba defasado (0) não regride a contagem já persistida', () => {
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });
    act(() => {
      result.current.registrarSaidaAba();
    });
    expect(lerEstadoPersistido().saidas_de_aba).toBe(1);

    // Simula um estado React defasado (capturado antes da saída de aba ser
    // registrada no localStorage) sendo salvo por outro fluxo (ex.: responder
    // uma questão) — sem o merge monotônico, isto zerava o contador.
    const estadoDefasado = lerEstadoPersistido();
    act(() => {
      result.current.salvarEstado({ ...estadoDefasado, saidas_de_aba: 0 });
    });

    expect(lerEstadoPersistido().saidas_de_aba).toBe(1);
  });

  it('REGRESSÃO: salvarEstadoDebounced com saidas_de_aba defasado (0) não regride a contagem já persistida', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });
    act(() => {
      result.current.registrarSaidaAba();
    });
    expect(lerEstadoPersistido().saidas_de_aba).toBe(1);

    const estadoDefasado = lerEstadoPersistido();
    act(() => {
      result.current.salvarEstadoDebounced({ ...estadoDefasado, saidas_de_aba: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(lerEstadoPersistido().saidas_de_aba).toBe(1);
  });

  it('registrarSaidaFullscreen retorna/persiste a contagem incrementada', () => {
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });
    act(() => {
      result.current.registrarSaidaFullscreen();
    });

    expect(lerEstadoPersistido().saidas_de_fullscreen).toBe(1);
  });

  it('REGRESSÃO: salvarEstado com saidas_de_fullscreen defasado (0) não regride a contagem já persistida', () => {
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });
    act(() => {
      result.current.registrarSaidaFullscreen();
    });
    expect(lerEstadoPersistido().saidas_de_fullscreen).toBe(1);

    const estadoDefasado = lerEstadoPersistido();
    act(() => {
      result.current.salvarEstado({ ...estadoDefasado, saidas_de_fullscreen: 0 });
    });

    expect(lerEstadoPersistido().saidas_de_fullscreen).toBe(1);
  });

  it('REGRESSÃO: salvarEstadoDebounced com saidas_de_fullscreen defasado (0) não regride a contagem já persistida', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });
    act(() => {
      result.current.registrarSaidaFullscreen();
    });
    expect(lerEstadoPersistido().saidas_de_fullscreen).toBe(1);

    const estadoDefasado = lerEstadoPersistido();
    act(() => {
      result.current.salvarEstadoDebounced({ ...estadoDefasado, saidas_de_fullscreen: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(lerEstadoPersistido().saidas_de_fullscreen).toBe(1);
  });

  it('inicializarEstado zera legitimamente quando não há estado persistido antes (limparEstado + inicializarEstado)', () => {
    const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });
    act(() => {
      result.current.registrarSaidaAba();
      result.current.registrarSaidaFullscreen();
    });
    expect(lerEstadoPersistido().saidas_de_aba).toBe(1);
    expect(lerEstadoPersistido().saidas_de_fullscreen).toBe(1);

    act(() => {
      result.current.limparEstado();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      result.current.inicializarEstado(10, null, 60);
    });

    const estado = lerEstadoPersistido();
    expect(estado.saidas_de_aba).toBe(0);
    expect(estado.saidas_de_fullscreen).toBe(0);
  });

  // (e) O hook ganhou `saidas_registro` (array de { saiu_em, voltou_em }) e
  // `registrarRetornoAba` em paralelo a este teste — cobrindo aqui.
  describe('saidas_registro / registrarRetornoAba', () => {
    it('REGRESSÃO: o array de saidas_registro não encolhe quando um estado defasado (registro vazio) é salvo por cima', () => {
      const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

      act(() => {
        result.current.inicializarEstado(10, null, 60);
      });
      act(() => {
        result.current.registrarSaidaAba();
      });
      expect(lerEstadoPersistido().saidas_registro).toHaveLength(1);

      // Estado defasado: capturado antes da saída de aba, ainda com o
      // registro vazio do inicializarEstado.
      const estadoDefasado: EstadoSimulado = { ...lerEstadoPersistido(), saidas_registro: [] };
      act(() => {
        result.current.salvarEstado(estadoDefasado);
      });

      expect(lerEstadoPersistido().saidas_registro).toHaveLength(1);
    });

    it('registrarRetornoAba preenche o voltou_em da última saída em aberto', () => {
      const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

      act(() => {
        result.current.inicializarEstado(10, null, 60);
      });
      act(() => {
        result.current.registrarSaidaAba();
      });

      let registro = lerEstadoPersistido().saidas_registro!;
      expect(registro).toHaveLength(1);
      expect(registro[0].voltou_em).toBeNull();

      act(() => {
        result.current.registrarRetornoAba();
      });

      registro = lerEstadoPersistido().saidas_registro!;
      expect(registro).toHaveLength(1);
      expect(registro[0].voltou_em).not.toBeNull();
    });

    it('registrarRetornoAba preenche apenas a saída mais recente em aberto, mantendo as demais', () => {
      const { result } = renderHook(() => useSimuladoStorage(SIMULADO_ID));

      act(() => {
        result.current.inicializarEstado(10, null, 60);
      });
      act(() => {
        result.current.registrarSaidaAba();
      });
      act(() => {
        result.current.registrarRetornoAba();
      });
      act(() => {
        result.current.registrarSaidaAba();
      });

      const registro = lerEstadoPersistido().saidas_registro!;
      expect(registro).toHaveLength(2);
      expect(registro[0].voltou_em).not.toBeNull();
      expect(registro[1].voltou_em).toBeNull();
    });
  });
});
