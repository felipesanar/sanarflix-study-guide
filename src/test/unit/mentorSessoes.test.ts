import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  salvarSessao, marcarSessaoFeita, listarSessoes, definirLinkAgendamento, liberarAgenda, desligarAgenda,
} from '@/services/mentor/sessoes';

const ok = (data: unknown) => Promise.resolve({ data, error: null });

describe('services/mentor/sessoes', () => {
  beforeEach(() => mockRpc.mockReset());

  it('salvarSessao coletiva manda p_* com nulos e sem aluno', async () => {
    mockRpc.mockReturnValue(ok({ sessao_id: 's1', intervencao_id: 'i1', post_id: 'p1' }));
    await expect(
      salvarSessao({ tipo: 'coletiva', titulo: 'Revisão', inicio: '2026-10-20T20:00:00Z' }),
    ).resolves.toEqual({ sessao_id: 's1', intervencao_id: 'i1', post_id: 'p1' });
    expect(mockRpc).toHaveBeenCalledWith('mentor_sessao_salvar', {
      p_id: null, p_tipo: 'coletiva', p_titulo: 'Revisão', p_tema: null,
      p_inicio: '2026-10-20T20:00:00Z', p_duracao_min: null, p_meet_link: null, p_aluno_email: null,
    });
  });

  it('salvarSessao individual repassa aluno, tema, duração e meet', async () => {
    mockRpc.mockReturnValue(ok({ sessao_id: 's1', intervencao_id: 'i1', post_id: null }));
    await salvarSessao({
      id: 's1', tipo: 'individual', titulo: '1:1', tema: 'Plano', inicio: '2026-10-21T13:00:00Z',
      duracaoMin: 45, meetLink: 'https://meet.google.com/x', alunoEmail: 'a@x.com',
    });
    expect(mockRpc).toHaveBeenCalledWith('mentor_sessao_salvar', {
      p_id: 's1', p_tipo: 'individual', p_titulo: '1:1', p_tema: 'Plano',
      p_inicio: '2026-10-21T13:00:00Z', p_duracao_min: 45,
      p_meet_link: 'https://meet.google.com/x', p_aluno_email: 'a@x.com',
    });
  });

  it('marcarSessaoFeita chama mentor_sessao_marcar_feita (gravação opcional)', async () => {
    mockRpc.mockReturnValue(ok({ sessao_id: 's1' }));
    await marcarSessaoFeita('s1');
    expect(mockRpc).toHaveBeenCalledWith('mentor_sessao_marcar_feita', { p_id: 's1', p_gravacao_url: null });
    await marcarSessaoFeita('s1', 'https://drive/x');
    expect(mockRpc).toHaveBeenLastCalledWith('mentor_sessao_marcar_feita', { p_id: 's1', p_gravacao_url: 'https://drive/x' });
  });

  it('listarSessoes manda p_quando', async () => {
    mockRpc.mockReturnValue(ok([]));
    await expect(listarSessoes('proximas')).resolves.toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('mentor_sessoes_listar', { p_quando: 'proximas' });
  });

  it('definirLinkAgendamento manda p_url', async () => {
    mockRpc.mockReturnValue(ok({ link_agendamento: 'https://cal.google.com/x' }));
    await definirLinkAgendamento('https://cal.google.com/x');
    expect(mockRpc).toHaveBeenCalledWith('mentor_definir_link_agendamento', { p_url: 'https://cal.google.com/x' });
  });

  it('liberarAgenda manda e-mails e mensagem', async () => {
    mockRpc.mockReturnValue(ok({ liberados: 2, intervencoes: 2 }));
    await expect(liberarAgenda(['a@x.com', 'b@x.com'], 'Agende comigo')).resolves.toEqual({ liberados: 2, intervencoes: 2 });
    expect(mockRpc).toHaveBeenCalledWith('mentor_agenda_liberar', {
      p_emails: ['a@x.com', 'b@x.com'], p_mensagem: 'Agende comigo',
    });
  });

  it('desligarAgenda manda a lista, ou nulo para todos', async () => {
    mockRpc.mockReturnValue(ok({ desligados: 1 }));
    await desligarAgenda(['a@x.com']);
    expect(mockRpc).toHaveBeenCalledWith('mentor_agenda_desligar', { p_emails: ['a@x.com'] });
    await desligarAgenda(null);
    expect(mockRpc).toHaveBeenLastCalledWith('mentor_agenda_desligar', { p_emails: null });
  });

  it('erro da RPC vira Error com a mensagem', async () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: { message: 'mensagem obrigatória' } }));
    await expect(liberarAgenda(['a@x.com'], '')).rejects.toThrow('mensagem obrigatória');
  });
});
