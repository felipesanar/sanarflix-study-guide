import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { fetchTurma, fetchAluno } from '@/services/mentor/turma';

describe('services/mentor/turma', () => {
  beforeEach(() => mockRpc.mockReset());

  it('fetchTurma chama mentor_turma sem argumentos e devolve a lista', async () => {
    const lista = [
      {
        email: 'a@x.com', nome: 'Ana', telefone: null, semestre: 5, acesso_ate: null, b2b: false,
        academy_user_id: 'u1', sanarflix_user_id: null, ultima_atividade: null,
        dias_sem_atividade: null, segmento: 'sem_dado',
      },
    ];
    mockRpc.mockReturnValue(Promise.resolve({ data: lista, error: null }));
    await expect(fetchTurma()).resolves.toEqual(lista);
    expect(mockRpc).toHaveBeenCalledWith('mentor_turma', {});
  });

  it('fetchAluno chama mentor_aluno com p_email e devolve o detalhe', async () => {
    const detalhe = { aluno: null, liberacao: null, intervencoes: [], log: [] };
    mockRpc.mockReturnValue(Promise.resolve({ data: detalhe, error: null }));
    await expect(fetchAluno('A@x.com')).resolves.toEqual(detalhe);
    expect(mockRpc).toHaveBeenCalledWith('mentor_aluno', { p_email: 'A@x.com' });
  });

  it('erro do banco vira exceção com a mensagem', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'mentor inativo ou sem cadastro' } }));
    await expect(fetchTurma()).rejects.toThrow('mentor inativo ou sem cadastro');
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'aluno x não é da sua turma' } }));
    await expect(fetchAluno('x')).rejects.toThrow('aluno x não é da sua turma');
  });
});
