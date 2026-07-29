/**
 * TESTES DE CARACTERIZAÇÃO — fixam o comportamento ATUAL do "encerrar simulado"
 * antes da migração para `admin_encerrar_simulado` (escopo extra da Task 10).
 *
 * Este call site é o mais mal compreendido dos dois: a decisão do Felipe o
 * agrupou com o `SimuladoConfigDialog` como "escrita direta em simulados_admin",
 * mas ele NÃO escreve agenda — escreve uma única coluna, `status: 'encerrado'`.
 * Roteá-lo pela `admin_set_simulado_agenda` deixaria a prova `ativo` no banco e
 * zeraria modalidade + as 3 datas. Estes testes travam exatamente isso.
 *
 * O contrato menos óbvio, e que é fácil perder na migração: o catch faz
 * `toast.error` E **relança**, de propósito, para o `DangerZone` continuar
 * aberto para nova tentativa. Um wrapper de serviço que engula o erro quebraria
 * esse fluxo sem quebrar nenhum teste — até agora.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import ProvasTab from '@/components/admin/simulados/ProvasTab';

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockLogAdminAction = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/admin/logAction', () => ({
  logAdminAction: (...args: unknown[]) => mockLogAdminAction(...args),
}));

import { toast } from 'sonner';

/** Linha de `simulados_admin` que o fetch devolve: ativa, logo encerrável. */
const ROW_ATIVO = {
  id: 'sim-1',
  nome: 'Simulado Ativo',
  descricao: null,
  data_liberacao: '2026-01-10T13:00:00.000Z',
  data_encerramento: '2027-12-20T13:00:00.000Z',
  duracao_minutos: 180,
  status: 'ativo',
  created_at: '2026-01-01T00:00:00.000Z',
  ies_ids: ['ies-1'],
  liberacao_desempenho: 'imediato',
  data_liberacao_desempenho: null,
};

function armarSupabase() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'ies') {
      return { select: () => ({ order: () => Promise.resolve({ data: [{ id: 'ies-1', nome: 'Alpha' }], error: null }) }) };
    }
    if (table === 'simulados_admin') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [ROW_ATIVO], error: null }) }),
        update: (...a: unknown[]) => mockUpdate(...a),
      };
    }
    return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
  });
  mockRpc.mockResolvedValue({ data: [{ simulado_id: 'sim-1', total: 40 }], error: null });
}

/** Abre o DangerZone de encerramento e confirma. */
async function encerrar() {
  const abrir = await screen.findByTitle('Encerrar simulado');
  fireEvent.click(abrir);
  const confirmar = await screen.findByRole('button', { name: /^encerrar simulado$/i });
  fireEvent.click(confirmar);
}

describe('ProvasTab — caracterização do encerrar simulado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    armarSupabase();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: (...a: unknown[]) => mockEq(...a) });
    mockLogAdminAction.mockResolvedValue(undefined);
  });

  it('escreve SOMENTE a coluna status, com o valor encerrado', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual({ status: 'encerrado' });
    expect(Object.keys(payload)).toHaveLength(1);
  });

  it('não toca em modalidade nem em nenhuma das datas', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    for (const col of [
      'modalidade',
      'data_realizacao',
      'data_liberacao',
      'data_encerramento',
      'data_agendada_original',
    ]) {
      expect(payload).not.toHaveProperty(col);
    }
  });

  it('filtra pelo id do simulado alvo', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockEq).toHaveBeenCalled());

    expect(mockEq).toHaveBeenCalledWith('id', 'sim-1');
  });

  it('audita como encerrar_simulado e avisa o sucesso', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockLogAdminAction).toHaveBeenCalled());

    expect(mockLogAdminAction).toHaveBeenCalledWith('encerrar_simulado', null, {
      simulado_id: 'sim-1',
      nome: 'Simulado Ativo',
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('erro no update avisa e NÃO audita', async () => {
    mockEq.mockResolvedValue({ error: { message: 'permission denied' } });
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });
});
