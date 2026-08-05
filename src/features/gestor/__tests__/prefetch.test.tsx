import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { FiltrosGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { useVisaoGeral } from '@/features/gestor/api/queries';
import { prefetchVisaoGeral, visaoGeralQueryKey } from '@/features/gestor/api/prefetch';

const META = {
  periodo: '2026.1',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'proficiência >= 60',
  partial: false,
  lowSample: false,
};

const envelope = (data: unknown) => ({ data: { data, meta: META }, error: null });

const FILTROS: FiltrosGestor = { iesId: 'ies-1', semestre: '6ano', simulados: [] };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/gestor?ies=ies-1']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

/**
 * Achado 1 (revisão de 03/08): a queryKey do prefetch precisa bater EXATAMENTE
 * com a que `useVisaoGeral`/`useEnvelope` observa (card 107: `user.id` logo
 * após o namespace `'gestor'`) — senão o cache aquecido no hover nunca é lido
 * e a RPC mais cara do portal (`get_gestor_visao_geral`) roda duas vezes.
 */
describe('prefetchVisaoGeral / visaoGeralQueryKey (achado 1, revisão de 03/08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'u1' } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockRpc.mockResolvedValue(envelope({ kpis: [] }));
  });

  it('visaoGeralQueryKey inclui o userId logo após o namespace, igual ao useEnvelope (card 107)', () => {
    expect(visaoGeralQueryKey('u1', 'ies-1', '6ano')).toEqual([
      'gestor',
      'u1',
      'visao-geral',
      'ies-1',
      '6ano',
    ]);
  });

  it('a chave aquecida no prefetch é EXATAMENTE a que useVisaoGeral observa para o mesmo usuário/recorte', async () => {
    // Aquece o cache como o hover em DirecionadoresGestor faria.
    await prefetchVisaoGeral(queryClient, 'u1', FILTROS.iesId, FILTROS.semestre);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_visao_geral', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
    });

    // Monta a Visão Geral com o MESMO queryClient, como a navegação faria.
    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Cache hit: nenhuma segunda chamada à RPC mais cara do portal.
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ kpis: [] });

    // A chave observada pelo hook é a mesma que o prefetch calculou.
    const chaves = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(chaves).toEqual([visaoGeralQueryKey('u1', 'ies-1', '6ano')]);
  });

  it('usuários diferentes não herdam a entrada aquecida um do outro (mesmo raciocínio do card 107)', async () => {
    await prefetchVisaoGeral(queryClient, 'u1', FILTROS.iesId, FILTROS.semestre);
    expect(mockRpc).toHaveBeenCalledTimes(1);

    mockUseAuth.mockReturnValue({ user: { id: 'u2' } });
    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // u2 não é u1: cache miss esperado, segunda chamada à RPC.
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
