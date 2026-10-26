import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { useAdminEngajamento } from '@/services/admin/engajamento';
import { adminEngajamento } from '@/features/gestor/__tests__/fixtures/engajamento/admin';

/** Hook da RPC do admin (spec §10.4): nome e `p_*` exatos, envelope desembrulhado, chave com os filtros. */

const envolver = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe('useAdminEngajamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { data: adminEngajamento(), meta: {} }, error: null });
  });

  it('chama get_admin_engajamento com p_inicio, p_fim e, só com semestre, p_semestre', async () => {
    const { wrapper } = envolver();
    const { result } = renderHook(() => useAdminEngajamento('2026-05-01', '2026-10-22', 8), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('get_admin_engajamento', { p_inicio: '2026-05-01', p_fim: '2026-10-22', p_semestre: 8 });
  });

  it('sem semestre, o parâmetro nem vai (a RPC trata como "todos")', async () => {
    const { wrapper } = envolver();
    const { result } = renderHook(() => useAdminEngajamento('2026-05-01', '2026-10-22', null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('get_admin_engajamento', { p_inicio: '2026-05-01', p_fim: '2026-10-22' });
  });

  it('devolve o `data` do envelope', async () => {
    const { wrapper } = envolver();
    const { result } = renderHook(() => useAdminEngajamento('2026-05-01', '2026-10-22', null), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rede.baseAtiva).toBe(1000);
    expect(result.current.data?.ranking).toHaveLength(3);
  });

  it('a queryKey leva admin, engajamento e os filtros', async () => {
    const { wrapper, client } = envolver();
    const { result } = renderHook(() => useAdminEngajamento('2026-05-01', '2026-10-22', 8), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([['admin', 'engajamento', '2026-05-01', '2026-10-22', 8]]);
  });

  it('erro da RPC ("admin role required") vira erro da query', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'admin role required' } });
    const { wrapper } = envolver();
    const { result } = renderHook(() => useAdminEngajamento('2026-05-01', '2026-10-22', null), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('admin role required');
  });
});
