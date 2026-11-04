/**
 * Hooks sobre a fonte mock (VITE_MENTOR_FONTE=mock): shell (useMe, useContagensNav) e uma mutation
 * composta com invalidação.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { _definirConfigParaTestes, _resetarFontes } from '@/features/mentor/api/ativa';
import { chavesMentor, useContagensNav, useIntervencoes, useMe, useMural, usePublicar, useSimuladosMentor } from '@/features/mentor/api/queries';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const W = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, W };
}

afterEach(() => { _resetarFontes(); _definirConfigParaTestes(null); });

describe('hooks · mock B2C', () => {
  beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2c', latenciaMs: 0 }); });

  it('useMe devolve o mentor com a chave estável do shell', async () => {
    const { W, qc } = wrapper();
    const { result } = renderHook(() => useMe(), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.mentor.nome).toBe('Thiago Taniguchi');
    expect(qc.getQueryData(chavesMentor.me)).toBeTruthy();
  });

  it('useContagensNav: badge = cards "A fazer"; canais null no B2C', async () => {
    const { W } = wrapper();
    const { result } = renderHook(() => useContagensNav(), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ intervencoesAFazer: 3, canaisPendentes: null });
  });

  it('useSimuladosMentor lê os simulados do mock', async () => {
    const { W } = wrapper();
    const { result } = renderHook(() => useSimuladosMentor(), { wrapper: W });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.map((s) => s.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.current.meta).toBeUndefined();
  });

  it('usePublicar grava no mock e invalida mural e kanban', async () => {
    const { W } = wrapper();
    const { result } = renderHook(() => ({ mural: useMural(), quadro: useIntervencoes({ de: null, ate: null }), publicar: usePublicar() }), { wrapper: W });
    await waitFor(() => expect(result.current.mural.isSuccess && result.current.quadro.isSuccess).toBe(true));
    const antes = result.current.mural.data!.data.length;
    const cardsAntes = result.current.quadro.data!.cards.length;
    await act(async () => {
      await result.current.publicar.mutateAsync({ pub: { tag: 'aviso', titulo: 'Novo', mensagem: 'x', link: null, status: 'publicada', destino: { tipo: 'tribo' } }, registrarIntervencao: true });
    });
    await waitFor(() => expect(result.current.mural.data!.data.length).toBe(antes + 1));
    await waitFor(() => expect(result.current.quadro.data!.cards.length).toBe(cardsAntes + 1));
  });
});

describe('hooks · mock B2B', () => {
  beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2b', latenciaMs: 0 }); });

  it('useContagensNav: canais = itens da rotina de hoje sem enviado_em', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z')); // quinta-feira
    try {
      const { W } = wrapper();
      const { result } = renderHook(() => useContagensNav(), { wrapper: W });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ intervencoesAFazer: 2, canaisPendentes: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
