import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

const mockRpc = vi.fn();
const mockChannel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: () => mockChannel,
    removeChannel: vi.fn(),
  },
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { useAccessRules } from '@/hooks/useAccessRules';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useAccessRules (fonte única get_effective_features)', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockUseAuth.mockReturnValue({ user: { id: 'u1', id_ies: 'ies1', roles: ['gestor'] } });
  });

  it('mapeia chaves namespaced para AccessRules e respeita gestao.enabled', async () => {
    mockRpc.mockResolvedValue({
      data: {
        bypass: false,
        ies_id: 'ies1',
        features: {
          'aluno.home': true, 'aluno.guia_estudos': false, 'aluno.dashboard': true,
          'aluno.simulados': true, 'aluno.desempenho_simulados': false,
          'aluno.sanarclass': false, 'aluno.caderno_erros': true,
          'gestao.enabled': false, 'gestao.visao_institucional': false,
        },
      },
      error: null,
    });
    const { result } = renderHook(() => useAccessRules(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessRules.home).toBe(true);
    expect(result.current.accessRules.studyGuide).toBe(false);
    expect(result.current.accessRules.errorNotebook).toBe(true);
    // gestor NÃO tem mais bypass hardcoded: portal segue o contrato da IES
    expect(result.current.accessRules.desempenhoInstitucional).toBe(false);
    expect(result.current.accessRules.analytics).toBe(false);
    expect(result.current.accessRules.userManagement).toBe(false);
    expect(result.current.hasFeature('gestao.visao_institucional')).toBe(false);
  });

  it('bypass do servidor (admin/atendimento) liga tudo, inclusive userManagement', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u2', id_ies: '', roles: ['admin'] } });
    mockRpc.mockResolvedValue({
      data: { bypass: true, ies_id: null, features: { 'aluno.home': true, 'gestao.enabled': true } },
      error: null,
    });
    const { result } = renderHook(() => useAccessRules(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessRules.userManagement).toBe(true);
    expect(result.current.accessRules.desempenhoInstitucional).toBe(true);
  });

  it('sem usuário: tudo false, sem chamada à RPC', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useAccessRules(), { wrapper });
    expect(result.current.accessRules.simulados).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
