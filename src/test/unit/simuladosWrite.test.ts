/**
 * Wrappers de escrita de simulado — `updateSimulado` e `encerrarSimulado`
 * (escopo extra da Task 10 da Fase 0b).
 *
 * O assert que carrega mais peso é o de `p_atualizar_agenda`: o default TEM de
 * ser `false`, porque é ele que faz a RPC preservar `modalidade` e
 * `data_realizacao` quando o dialog de edição salva. Se esse default virar
 * `true`, todo save do dialog apaga a agenda do simulado — exatamente o defeito
 * que motivou não migrar os call sites para a RPC anterior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { updateSimulado, encerrarSimulado } from '@/services/admin/simulados';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

const BASE = {
  simuladoId: 'sim-1',
  nome: 'Simulado 1',
  descricao: null,
  dataLiberacao: '2026-08-01T12:00:00.000Z',
  dataEncerramento: null,
  duracaoMinutos: 180,
  status: 'ativo' as const,
  iesIds: ['ies-1'],
  liberacaoDesempenho: 'imediato' as const,
  dataLiberacaoDesempenho: null,
};

const RETORNO = {
  simulado_id: 'sim-1',
  nome: 'Simulado 1',
  status: 'ativo',
  modalidade: null,
  data_realizacao: null,
  data_liberacao: '2026-08-01T12:00:00.000Z',
  data_encerramento: null,
  data_agendada_original: '2026-08-01T12:00:00.000Z',
  reagendado: false,
};

describe('services/admin/simulados — escrita', () => {
  beforeEach(() => mockRpc.mockReset());

  it('updateSimulado manda as 9 colunas com os nomes p_* da RPC', async () => {
    mockRpc.mockReturnValue(ok(RETORNO));
    await updateSimulado(BASE);

    expect(mockRpc).toHaveBeenCalledWith('admin_update_simulado', {
      p_simulado_id: 'sim-1',
      p_nome: 'Simulado 1',
      p_descricao: null,
      p_data_liberacao: '2026-08-01T12:00:00.000Z',
      p_data_encerramento: null,
      p_duracao_minutos: 180,
      p_status: 'ativo',
      p_ies_ids: ['ies-1'],
      p_liberacao_desempenho: 'imediato',
      p_data_liberacao_desempenho: null,
      p_atualizar_agenda: false,
      p_modalidade: null,
      p_data_realizacao: null,
      p_definitiva: false,
    });
  });

  it('p_atualizar_agenda default é FALSE — é o que preserva a agenda no save do dialog', async () => {
    mockRpc.mockReturnValue(ok(RETORNO));
    await updateSimulado(BASE);

    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_atualizar_agenda: false });
  });

  it('quando o chamador mexe na agenda, propaga modalidade, data e definitiva', async () => {
    mockRpc.mockReturnValue(ok({ ...RETORNO, modalidade: 'presencial' }));
    await updateSimulado({
      ...BASE,
      atualizarAgenda: true,
      modalidade: 'presencial',
      dataRealizacao: '2026-09-10T13:00:00.000Z',
      definitiva: true,
    });

    expect(mockRpc.mock.calls[0][1]).toMatchObject({
      p_atualizar_agenda: true,
      p_modalidade: 'presencial',
      p_data_realizacao: '2026-09-10T13:00:00.000Z',
      p_definitiva: true,
    });
  });

  it('devolve o payload da RPC, incluindo reagendado', async () => {
    mockRpc.mockReturnValue(ok({ ...RETORNO, reagendado: true }));
    const r = await updateSimulado(BASE);

    expect(r.simulado_id).toBe('sim-1');
    expect(r.reagendado).toBe(true);
  });

  it('erro do banco vira Error com a mensagem original', async () => {
    mockRpc.mockReturnValue(fail('status inválido: publicado'));
    await expect(updateSimulado({ ...BASE, status: 'publicado' as never })).rejects.toThrow(
      'status inválido: publicado',
    );
  });

  it('encerrarSimulado chama admin_encerrar_simulado com p_simulado_id', async () => {
    mockRpc.mockReturnValue(
      ok({ simulado_id: 'sim-1', nome: 'Simulado 1', status_antes: 'ativo', status: 'encerrado' }),
    );
    const r = await encerrarSimulado('sim-1');

    expect(mockRpc).toHaveBeenCalledWith('admin_encerrar_simulado', { p_simulado_id: 'sim-1' });
    expect(r.status).toBe('encerrado');
    expect(r.status_antes).toBe('ativo');
  });

  it('encerrarSimulado LANÇA em caso de erro — o DangerZone depende disso', async () => {
    mockRpc.mockReturnValue(fail('admin role required'));
    await expect(encerrarSimulado('sim-1')).rejects.toThrow('admin role required');
  });
});
