import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

const mockRpc = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe('useEffectiveFeatures — subscription realtime única por IES (refcount)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1', id_ies: 'ies-1', roles: [] } });
    mockRpc.mockResolvedValue({
      data: { bypass: false, ies_id: 'ies-1', features: { 'aluno.home': true } },
      error: null,
    });
    // Mimica o supabase-js: channel() devolve um objeto encadeável.
    const channelInstance = { on: mockOn, subscribe: mockSubscribe };
    mockOn.mockReturnValue(channelInstance);
    mockSubscribe.mockReturnValue(channelInstance);
    mockChannel.mockReturnValue(channelInstance);
  });

  it('dois consumidores simultâneos compartilham UM canal (bug de prod: .on após subscribe)', async () => {
    const a = renderHook(() => useEffectiveFeatures(), { wrapper });
    const b = renderHook(() => useEffectiveFeatures(), { wrapper });

    await waitFor(() => expect(a.result.current.loading).toBe(false));

    // Um único canal criado e inscrito — o segundo mount NÃO chama .on de novo
    // (era isso que lançava "cannot add postgres_changes callbacks after subscribe()").
    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockOn).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // O primeiro unmount não derruba o canal do consumidor restante…
    a.unmount();
    expect(mockRemoveChannel).not.toHaveBeenCalled();

    // …só o último remove.
    b.unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it('remonta o canal depois que todos os consumidores saíram', async () => {
    const a = renderHook(() => useEffectiveFeatures(), { wrapper });
    a.unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

    const b = renderHook(() => useEffectiveFeatures(), { wrapper });
    await waitFor(() => expect(b.result.current.loading).toBe(false));
    // Novo ciclo de vida: canal recriado uma vez.
    expect(mockChannel).toHaveBeenCalledTimes(2);
    b.unmount();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(2);
  });
});
