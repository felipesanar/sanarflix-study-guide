import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { fetchDesempenhoTurma, fetchDetalhamento, fetchAlunoNotas } from '@/services/mentor/desempenho';

describe('services/mentor/desempenho', () => {
  beforeEach(() => mockRpc.mockReset());

  it('fetchDesempenhoTurma sem filtro manda p_simulados nulo', async () => {
    const dado = { alunos: [], possivel_aprovacao_pct: null, acerto_medio_ultimo: null, participacao_ultimo: null };
    mockRpc.mockReturnValue(Promise.resolve({ data: dado, error: null }));
    await expect(fetchDesempenhoTurma()).resolves.toEqual(dado);
    expect(mockRpc).toHaveBeenCalledWith('mentor_desempenho_turma', { p_simulados: null });
  });

  it('fetchDesempenhoTurma repassa os simulados escolhidos', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: { alunos: [] }, error: null }));
    await fetchDesempenhoTurma(['s1', 's2']);
    expect(mockRpc).toHaveBeenCalledWith('mentor_desempenho_turma', { p_simulados: ['s1', 's2'] });
  });

  it('fetchDetalhamento chama mentor_detalhamento com p_simulados', async () => {
    const dado = { areas: [], questoes: [] };
    mockRpc.mockReturnValue(Promise.resolve({ data: dado, error: null }));
    await expect(fetchDetalhamento(['s1'])).resolves.toEqual(dado);
    expect(mockRpc).toHaveBeenCalledWith('mentor_detalhamento', { p_simulados: ['s1'] });
  });

  it('fetchAlunoNotas chama mentor_aluno_notas com p_email', async () => {
    const dado = { email: 'a@x.com', notas: [], areas: [] };
    mockRpc.mockReturnValue(Promise.resolve({ data: dado, error: null }));
    await expect(fetchAlunoNotas('A@x.com')).resolves.toEqual(dado);
    expect(mockRpc).toHaveBeenCalledWith('mentor_aluno_notas', { p_email: 'A@x.com' });
  });

  it('erro do banco vira exceção com a mensagem', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'mentor inativo ou sem cadastro' } }));
    await expect(fetchDesempenhoTurma()).rejects.toThrow('mentor inativo ou sem cadastro');
    await expect(fetchDetalhamento([])).rejects.toThrow('mentor inativo ou sem cadastro');
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'aluno x não é da sua turma' } }));
    await expect(fetchAlunoNotas('x')).rejects.toThrow('aluno x não é da sua turma');
  });
});
