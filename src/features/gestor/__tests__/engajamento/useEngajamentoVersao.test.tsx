import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import {
  INTERVALO_VERSAO_ENGAJAMENTO_MS,
  useEngajamentoVersao,
} from '@/features/gestor/api/engajamento';

/**
 * Refresh incremental, Fase 5 (spec 2026-10-28-engajamento-refresh-incremental §5.4):
 * a tela pergunta a versão dos dados a cada 2 min, só com a aba visível, e refaz as consultas do
 * Engajamento quando a versão muda.
 */

const META = { periodo: '', fonte: '', atualizadoEm: null, criterio: '', partial: true, lowSample: false };
/** Resposta da RPC. Sem o 2º argumento, simula a RPC ANTIGA, que não trazia `versao`. */
const versao = (atualizadoEm: string | null, v?: string | null) => ({
  data: { data: v === undefined ? { atualizadoEm } : { atualizadoEm, versao: v }, meta: META },
  error: null,
});

const V1 = '2026-10-29T12:00:00+00:00';
const V2 = '2026-10-29T12:05:00+00:00';

const CHAVE_VISAO = ['gestor', 'u1', 'engajamento', 'visao-geral', 'ies-1', '2026-05-01', '2026-10-29', null, null];
const CHAVE_QUESTOES = ['gestor', 'u1', 'engajamento', 'questoes', 'ies-1', '2026-05-01', '2026-10-29', null];
const CHAVE_VERSAO = ['gestor', 'u1', 'engajamento', 'versao', 'ies-1'];

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

/** Avança o relógio falso e deixa as promessas do React Query se resolverem. */
const avancar = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    // o React Query notifica os observadores num setTimeout(0) que nasce depois da resposta da consulta
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);
  });
};

const chamadasDaVersao = () =>
  mockRpc.mock.calls.filter(([fn]) => fn === 'get_gestor_engajamento_versao').length;

/** Dois blocos já carregados na tela, para provar o que a invalidação alcança. */
const semearConsultas = () => {
  queryClient.setQueryData(CHAVE_VISAO, { data: {}, meta: META });
  queryClient.setQueryData(CHAVE_QUESTOES, { data: {}, meta: META });
};
const invalidada = (chave: unknown[]) => queryClient.getQueryState(chave)?.isInvalidated === true;

describe('useEngajamentoVersao (Fase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    focusManager.setFocused(true);
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    focusManager.setFocused(undefined);
    queryClient.clear();
    vi.useRealTimers();
  });

  it('chama get_gestor_engajamento_versao com p_ies_id e guarda a consulta em gestor › user.id › engajamento › versao', async () => {
    mockRpc.mockResolvedValue(versao(V1));
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);

    expect(mockRpc).toHaveBeenCalledWith('get_gestor_engajamento_versao', { p_ies_id: 'ies-1' });
    expect(queryClient.getQueryState(CHAVE_VERSAO)).toBeDefined();
  });

  it('consulta a cada 2 minutos', async () => {
    expect(INTERVALO_VERSAO_ENGAJAMENTO_MS).toBe(120_000);
    mockRpc.mockResolvedValue(versao(V1));
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    expect(chamadasDaVersao()).toBe(1);

    await avancar(119_000);
    expect(chamadasDaVersao()).toBe(1); // ainda não deu 2 min
    await avancar(1_000);
    expect(chamadasDaVersao()).toBe(2);
    await avancar(120_000);
    expect(chamadasDaVersao()).toBe(3);
  });

  it('não consulta com a aba oculta', async () => {
    mockRpc.mockResolvedValue(versao(V1));
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    expect(chamadasDaVersao()).toBe(1);

    act(() => focusManager.setFocused(false));
    await avancar(5 * 120_000);
    expect(chamadasDaVersao()).toBe(1);
  });

  it('invalida as consultas do Engajamento quando atualizadoEm muda', async () => {
    mockRpc.mockResolvedValueOnce(versao(V1)).mockResolvedValue(versao(V2));
    semearConsultas();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    expect(invalidar).not.toHaveBeenCalled(); // a 1ª leitura só é memorizada

    await avancar(120_000);
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar.mock.calls[0][0]).toMatchObject({ queryKey: ['gestor', 'u1', 'engajamento'] });
    expect(invalidada(CHAVE_VISAO)).toBe(true);
    expect(invalidada(CHAVE_QUESTOES)).toBe(true);
  });

  // Achado do QA da Fase 5 (PARACATU, 30/10): `atualizadoEm` é o MENOR entre as fontes e ficou parado em 14:20:59
  // por 6 rodadas, enquanto a carga de questões avançava a cada 5 min e os dados mudavam. O sinal é `versao`.
  it('invalida quando só a versao muda, com atualizadoEm parado (o achado do QA)', async () => {
    mockRpc
      .mockResolvedValueOnce(versao('2026-10-30T14:20:59+00:00', '2026-10-30T15:06:51+00:00'))
      .mockResolvedValue(versao('2026-10-30T14:20:59+00:00', '2026-10-30T15:11:54+00:00'));
    semearConsultas();
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    expect(invalidada(CHAVE_VISAO)).toBe(false);
    await avancar(120_000);
    expect(invalidada(CHAVE_VISAO)).toBe(true);
    expect(invalidada(CHAVE_QUESTOES)).toBe(true);
  });

  it('não invalida quando só o atualizadoEm muda e a versao é a mesma', async () => {
    mockRpc
      .mockResolvedValueOnce(versao('2026-10-30T14:20:59+00:00', '2026-10-30T15:06:51+00:00'))
      .mockResolvedValue(versao('2026-10-30T15:20:59+00:00', '2026-10-30T15:06:51+00:00'));
    semearConsultas();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    await avancar(120_000);
    expect(chamadasDaVersao()).toBe(2);
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('com a RPC antiga (sem versao), cai para o atualizadoEm', async () => {
    mockRpc.mockResolvedValueOnce(versao(V1)).mockResolvedValue(versao(V2)); // versao(x) sem 2º argumento = shape antigo
    semearConsultas();
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    await avancar(120_000);
    expect(invalidada(CHAVE_VISAO)).toBe(true);
  });

  it('não invalida quando atualizadoEm não muda', async () => {
    mockRpc.mockResolvedValue(versao(V1));
    semearConsultas();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    await avancar(120_000);
    await avancar(120_000);

    expect(chamadasDaVersao()).toBe(3);
    expect(invalidar).not.toHaveBeenCalled();
    expect(invalidada(CHAVE_VISAO)).toBe(false);
    expect(invalidada(CHAVE_QUESTOES)).toBe(false);
  });

  it('não invalida a própria chave de versão', async () => {
    mockRpc.mockResolvedValueOnce(versao(V1)).mockResolvedValue(versao(V2));
    semearConsultas();
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    await avancar(120_000);

    expect(invalidada(CHAVE_VISAO)).toBe(true); // as do Engajamento foram
    // Uma consulta ativa invalidada é refeita na hora, então o sinal certo é o número de chamadas: a de versão
    // roda só no início e no intervalo de 2 min. Uma chamada a mais é ela mesma sendo invalidada.
    expect(chamadasDaVersao()).toBe(2);
    expect(queryClient.getQueryState(CHAVE_VERSAO)?.fetchStatus).toBe('idle');
  });

  it('não invalida consultas de outros módulos nem de outro usuário', async () => {
    mockRpc.mockResolvedValueOnce(versao(V1)).mockResolvedValue(versao(V2));
    const deOutroModulo = ['gestor', 'u1', 'visao-geral', 'ies-1'];
    const deOutroUsuario = ['gestor', 'u2', 'engajamento', 'visao-geral', 'ies-1'];
    queryClient.setQueryData(deOutroModulo, { data: {}, meta: META });
    queryClient.setQueryData(deOutroUsuario, { data: {}, meta: META });
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    await avancar(120_000);

    expect(invalidada(deOutroModulo)).toBe(false);
    expect(invalidada(deOutroUsuario)).toBe(false);
  });

  it('versão nula (pipeline nunca rodou) e depois preenchida conta como mudança', async () => {
    mockRpc.mockResolvedValueOnce(versao(null)).mockResolvedValue(versao(V1));
    semearConsultas();
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(0);
    expect(invalidada(CHAVE_VISAO)).toBe(false);
    await avancar(120_000);
    expect(invalidada(CHAVE_VISAO)).toBe(true);
  });

  it('sem IES (iesId nulo) ou sem usuário, não consulta', async () => {
    mockRpc.mockResolvedValue(versao(V1));
    renderHook(() => useEngajamentoVersao(null), { wrapper });
    await avancar(3 * 120_000);
    expect(mockRpc).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => useEngajamentoVersao('ies-1'), { wrapper });
    await avancar(3 * 120_000);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('trocar de IES memoriza a versão da nova IES e não conta como mudança', async () => {
    mockRpc
      .mockResolvedValueOnce(versao(V1)) // ies-1
      .mockResolvedValueOnce(versao(V2)); // ies-2: valor diferente, mas é outra IES
    semearConsultas();
    const { rerender } = renderHook(({ ies }: { ies: string }) => useEngajamentoVersao(ies), {
      wrapper,
      initialProps: { ies: 'ies-1' },
    });
    await avancar(0);
    rerender({ ies: 'ies-2' });
    await avancar(0);

    expect(invalidada(CHAVE_VISAO)).toBe(false);
  });
});
