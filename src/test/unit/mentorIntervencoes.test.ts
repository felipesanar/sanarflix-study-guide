import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  criarIntervencao, atualizarIntervencao, comentarIntervencao, listarIntervencoes,
} from '@/services/mentor/intervencoes';

const ok = (data: unknown) => Promise.resolve({ data, error: null });

describe('services/mentor/intervencoes', () => {
  beforeEach(() => mockRpc.mockReset());

  it('criarIntervencao manda p_* com defaults', async () => {
    mockRpc.mockReturnValue(ok({ intervencao_id: 'i1' }));
    await expect(criarIntervencao({ tipo: 'whatsapp', titulo: 'Chamar', alvo: 'turma' })).resolves.toEqual({ intervencao_id: 'i1' });
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencao_criar', {
      p_tipo: 'whatsapp', p_titulo: 'Chamar', p_nota: null, p_alvo: 'turma', p_alunos: [],
    });
  });

  it('criarIntervencao repassa nota e alunos', async () => {
    mockRpc.mockReturnValue(ok({ intervencao_id: 'i1' }));
    await criarIntervencao({ tipo: 'outro', titulo: 'T', nota: 'n', alvo: 'grupo', alunos: ['a@x.com', 'b@x.com'] });
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencao_criar', {
      p_tipo: 'outro', p_titulo: 'T', p_nota: 'n', p_alvo: 'grupo', p_alunos: ['a@x.com', 'b@x.com'],
    });
  });

  it('atualizarIntervencao manda só o status quando é o que muda', async () => {
    mockRpc.mockReturnValue(ok({ intervencao_id: 'i1', status: 'feito' }));
    await expect(atualizarIntervencao({ id: 'i1', status: 'feito' })).resolves.toEqual({ intervencao_id: 'i1', status: 'feito' });
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencao_atualizar', {
      p_id: 'i1', p_titulo: null, p_nota: null, p_status: 'feito',
    });
  });

  it('atualizarIntervencao repassa título e nota', async () => {
    mockRpc.mockReturnValue(ok({ intervencao_id: 'i1', status: 'a_fazer' }));
    await atualizarIntervencao({ id: 'i1', titulo: 'Novo', nota: 'Nota' });
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencao_atualizar', {
      p_id: 'i1', p_titulo: 'Novo', p_nota: 'Nota', p_status: null,
    });
  });

  it('comentarIntervencao manda id e texto', async () => {
    mockRpc.mockReturnValue(ok({ comentario_id: 'c1' }));
    await comentarIntervencao('i1', 'Falei com ele');
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencao_comentar', { p_id: 'i1', p_texto: 'Falei com ele' });
  });

  it('listarIntervencoes manda o período', async () => {
    const lista = { cards: [], planejadas: 0, realizadas: 0 };
    mockRpc.mockReturnValue(ok(lista));
    await expect(listarIntervencoes('2026-10-01', '2026-10-31')).resolves.toEqual(lista);
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencoes_listar', { p_de: '2026-10-01', p_ate: '2026-10-31' });
  });

  it('listarIntervencoes aceita período aberto', async () => {
    mockRpc.mockReturnValue(ok({ cards: [], planejadas: 0, realizadas: 0 }));
    await listarIntervencoes(null, null);
    expect(mockRpc).toHaveBeenCalledWith('mentor_intervencoes_listar', { p_de: null, p_ate: null });
  });

  it('erro da RPC vira Error com a mensagem', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'intervenção não encontrada' } }));
    await expect(comentarIntervencao('x', 'y')).rejects.toThrow('intervenção não encontrada');
  });
});
