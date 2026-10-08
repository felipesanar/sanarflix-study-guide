import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { fetchMentorContexto } from '@/services/mentor/contexto';

describe('services/mentor/contexto', () => {
  beforeEach(() => mockRpc.mockReset());

  it('chama get_mentor_contexto sem argumentos e devolve o payload', async () => {
    const payload = {
      mentor: {
        user_id: 'm1', nome: 'Thiago Taniguchi', email: 't@x.com', tipo: 'b2c',
        turma_nome: 'Tribo Carcará', ies_id: null, ies_nome: null, ativo: true,
      },
      alunos_ativos: 87,
    };
    mockRpc.mockReturnValue(Promise.resolve({ data: payload, error: null }));
    await expect(fetchMentorContexto()).resolves.toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith('get_mentor_contexto', {});
  });

  it('propaga o erro da RPC', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'não autenticado' } }));
    await expect(fetchMentorContexto()).rejects.toThrow('não autenticado');
  });
});
