import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/contexts/AuthContext');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

// Este arquivo é .ts (não .tsx) por convenção dos outros testes de hook do
// repo (ver useBulkRunner.test.ts) -- por isso o wrapper usa
// React.createElement em vez de JSX (o parser esbuild/SWC de .ts não aceita
// sintaxe JSX, só .tsx).
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useGestorPortalVersao', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
  });

  it('retorna portalNovo=true quando a RPC devolve true', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as never);
    const { result } = renderHook(() => useGestorPortalVersao(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.portalNovo).toBe(true);
  });

  it('retorna portalNovo=false quando a RPC devolve false', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as never);
    const { result } = renderHook(() => useGestorPortalVersao(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.portalNovo).toBe(false);
  });

  it('trata erro da RPC como console antigo (fail-safe) e reporta o erro', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    const { result } = renderHook(() => useGestorPortalVersao(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.portalNovo).toBe(false);
  });
});
