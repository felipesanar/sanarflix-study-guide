import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  fetchIesContratos,
  upsertIesContrato,
  deleteIesContrato,
  setIesSimuladosPrevistos,
  setSimuladoAgenda,
} from '@/services/admin/contratoSimulados';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

describe('services/admin/contratoSimulados', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('fetchIesContratos chama admin_get_ies_contratos com p_ies_id e devolve o payload', async () => {
    const payload = {
      ies: { id: 'ies-1', nome: 'Faculdade Alpha' },
      contratos: [],
      simulados_disponiveis: [],
    };
    mockRpc.mockReturnValue(ok(payload));

    await expect(fetchIesContratos('ies-1')).resolves.toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith('admin_get_ies_contratos', { p_ies_id: 'ies-1' });
  });

  it('upsertIesContrato chama admin_upsert_ies_contrato com os 5 parâmetros p_*', async () => {
    mockRpc.mockReturnValue(ok({ contrato_id: 'ct-1', criado: true }));

    const result = await upsertIesContrato({
      iesId: 'ies-1',
      nome: 'Contrato 2026',
      simuladosContratados: 7,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
    });

    expect(result).toEqual({ contrato_id: 'ct-1', criado: true });
    expect(mockRpc).toHaveBeenCalledWith('admin_upsert_ies_contrato', {
      p_ies_id: 'ies-1',
      p_nome: 'Contrato 2026',
      p_simulados_contratados: 7,
      p_vigencia_inicio: '2026-01-01',
      p_vigencia_fim: '2026-12-31',
    });
  });

  it('deleteIesContrato chama admin_delete_ies_contrato com p_contrato_id', async () => {
    mockRpc.mockReturnValue(ok({ contrato_id: 'ct-1', slots_removidos: 3 }));

    await expect(deleteIesContrato('ct-1')).resolves.toEqual({ contrato_id: 'ct-1', slots_removidos: 3 });
    expect(mockRpc).toHaveBeenCalledWith('admin_delete_ies_contrato', { p_contrato_id: 'ct-1' });
  });

  it('setIesSimuladosPrevistos envia os slots como array no p_slots, na ordem recebida', async () => {
    mockRpc.mockReturnValue(ok({ contrato_id: 'ct-1', slots: 2, criados: 2, atualizados: 0, removidos: 0 }));

    await setIesSimuladosPrevistos('ct-1', [
      { ordem: 1, nome_previsto: 'Simulado 1', simulado_id: 'sim-1' },
      { ordem: 2, nome_previsto: null, simulado_id: null },
    ]);

    expect(mockRpc).toHaveBeenCalledWith('admin_set_ies_simulados_previstos', {
      p_contrato_id: 'ct-1',
      p_slots: [
        { ordem: 1, nome_previsto: 'Simulado 1', simulado_id: 'sim-1' },
        { ordem: 2, nome_previsto: null, simulado_id: null },
      ],
    });
  });

  it('setSimuladoAgenda chama admin_set_simulado_agenda e default de p_definitiva é false', async () => {
    mockRpc.mockReturnValue(
      ok({
        simulado_id: 'sim-1',
        nome: 'Simulado 1',
        modalidade: 'presencial',
        data_realizacao: '2026-08-10T13:00:00.000Z',
        data_liberacao: null,
        data_encerramento: null,
        data_agendada_original: '2026-08-01T13:00:00.000Z',
        reagendado: true,
      }),
    );

    const result = await setSimuladoAgenda({
      simuladoId: 'sim-1',
      modalidade: 'presencial',
      dataRealizacao: '2026-08-10T13:00:00.000Z',
      dataLiberacao: null,
      dataEncerramento: null,
    });

    expect(result.reagendado).toBe(true);
    expect(result.id).toBe('sim-1');
    expect(mockRpc).toHaveBeenCalledWith('admin_set_simulado_agenda', {
      p_simulado_id: 'sim-1',
      p_modalidade: 'presencial',
      p_data_realizacao: '2026-08-10T13:00:00.000Z',
      p_data_liberacao: null,
      p_data_encerramento: null,
      p_definitiva: false,
    });
  });

  it('propaga p_definitiva=true quando a data nova é definitiva', async () => {
    mockRpc.mockReturnValue(ok({ simulado_id: 'sim-1', nome: 'Simulado 1', modalidade: 'online', data_realizacao: null, data_liberacao: '2026-09-01T12:00:00.000Z', data_encerramento: null, data_agendada_original: '2026-09-01T12:00:00.000Z', reagendado: false }));

    await setSimuladoAgenda({
      simuladoId: 'sim-1',
      modalidade: 'online',
      dataRealizacao: null,
      dataLiberacao: '2026-09-01T12:00:00.000Z',
      dataEncerramento: null,
      definitiva: true,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'admin_set_simulado_agenda',
      expect.objectContaining({ p_definitiva: true }),
    );
  });

  it('erro da RPC vira Error com a mensagem do banco', async () => {
    mockRpc.mockReturnValue(fail('3 slot(s) excedem os 2 simulado(s) contratado(s)'));

    await expect(setIesSimuladosPrevistos('ct-1', [])).rejects.toThrow(
      '3 slot(s) excedem os 2 simulado(s) contratado(s)',
    );
  });
});
