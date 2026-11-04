import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { listMentores, upsertMentor, importarVinculos, encerrarVinculo } from '@/services/admin/mentores';

const ok = (data: unknown) => Promise.resolve({ data, error: null });

describe('services/admin/mentores', () => {
  beforeEach(() => mockRpc.mockReset());

  it('listMentores chama admin_list_mentores', async () => {
    mockRpc.mockReturnValue(ok([]));
    await expect(listMentores()).resolves.toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('admin_list_mentores', {});
  });

  it('upsertMentor manda todos os p_* (ies nula no B2C)', async () => {
    mockRpc.mockReturnValue(ok({ user_id: 'm1', criado: true }));
    await upsertMentor({ userId: 'm1', tipo: 'b2c', turmaNome: 'Tribo Carcará' });
    expect(mockRpc).toHaveBeenCalledWith('admin_upsert_mentor', {
      p_user_id: 'm1',
      p_tipo: 'b2c',
      p_turma_nome: 'Tribo Carcará',
      p_ies_id: null,
      p_foto_url: null,
      p_formacao: null,
      p_link_agendamento: null,
      p_ativo: true,
    });
  });

  it('importarVinculos repassa dry run e trocar', async () => {
    const resultado = {
      dry_run: true, total: 1, novos: 1, ja_com_este_mentor: 0,
      com_outro_mentor: [], invalidos: [], inseridos: 0, trocados: 0,
    };
    mockRpc.mockReturnValue(ok(resultado));
    await expect(
      importarVinculos({ mentorId: 'm1', linhas: [{ email: 'a@x.com' }], trocar: false, dryRun: true }),
    ).resolves.toEqual(resultado);
    expect(mockRpc).toHaveBeenCalledWith('admin_importar_vinculos', {
      p_mentor_id: 'm1',
      p_linhas: [{ email: 'a@x.com' }],
      p_trocar: false,
      p_dry_run: true,
    });
  });

  it('encerrarVinculo chama admin_encerrar_vinculo', async () => {
    mockRpc.mockReturnValue(ok({ vinculo_id: 'v1', fim: '2026-10-08T12:00:00Z' }));
    await encerrarVinculo('v1');
    expect(mockRpc).toHaveBeenCalledWith('admin_encerrar_vinculo', { p_vinculo_id: 'v1' });
  });

  it('erro da RPC vira exceção com a mensagem do banco', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'mentor B2B precisa de IES' } }));
    await expect(upsertMentor({ userId: 'm1', tipo: 'b2b', turmaNome: 'FAI' })).rejects.toThrow('mentor B2B precisa de IES');
  });
});
