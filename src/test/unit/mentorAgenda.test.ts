import { describe, it, expect, vi, beforeEach } from 'vitest';

const from = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...a: unknown[]) => from(...a) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { fetchLinkAgendamento, listarLiberacoesLigadas } from '@/services/mentor/agenda';

describe('services/mentor/agenda', () => {
  beforeEach(() => from.mockReset());

  it('fetchLinkAgendamento lê mentores filtrando por user_id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { link_agendamento: ' https://cal.example/x ' }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    from.mockReturnValue({ select });
    await expect(fetchLinkAgendamento('m1')).resolves.toBe('https://cal.example/x');
    expect(from).toHaveBeenCalledWith('mentores');
    expect(select).toHaveBeenCalledWith('link_agendamento');
    expect(eq).toHaveBeenCalledWith('user_id', 'm1');
  });

  it('fetchLinkAgendamento devolve null sem linha ou com link vazio e lança no erro', async () => {
    const mk = (res: unknown) =>
      from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(res) }) }) });
    mk({ data: null, error: null });
    await expect(fetchLinkAgendamento('m1')).resolves.toBeNull();
    mk({ data: { link_agendamento: '  ' }, error: null });
    await expect(fetchLinkAgendamento('m1')).resolves.toBeNull();
    mk({ data: null, error: { message: 'nope' } });
    await expect(fetchLinkAgendamento('m1')).rejects.toThrow('nope');
  });

  it('listarLiberacoesLigadas filtra por mentor_id e ligado, mais recentes primeiro', async () => {
    const rows = [{ id: 'l1', aluno_email: 'a@x.com', mensagem: 'oi', desde: '2026-10-10T00:00:00Z' }];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eqLigado = vi.fn().mockReturnValue({ order });
    const eqMentor = vi.fn().mockReturnValue({ eq: eqLigado });
    const select = vi.fn().mockReturnValue({ eq: eqMentor });
    from.mockReturnValue({ select });
    await expect(listarLiberacoesLigadas('m1')).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith('mentoria_agenda_liberacoes');
    expect(eqMentor).toHaveBeenCalledWith('mentor_id', 'm1');
    expect(eqLigado).toHaveBeenCalledWith('ligado', true);
    expect(order).toHaveBeenCalledWith('desde', { ascending: false });
  });

  it('listarLiberacoesLigadas lança no erro', async () => {
    from.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) }) }),
    });
    await expect(listarLiberacoesLigadas('m1')).rejects.toThrow('x');
  });
});
