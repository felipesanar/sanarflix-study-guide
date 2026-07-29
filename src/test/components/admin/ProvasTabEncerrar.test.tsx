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
const mockEncerrarSimulado = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/services/admin/simulados', () => ({
  encerrarSimulado: (...args: unknown[]) => mockEncerrarSimulado(...args),
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
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    mockEncerrarSimulado.mockResolvedValue({
      simulado_id: 'sim-1',
      nome: 'Simulado Ativo',
      status_antes: 'ativo',
      status: 'encerrado',
    });
    mockLogAdminAction.mockResolvedValue(undefined);
  });

  it('encerra pela RPC, passando só o id do simulado alvo', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockEncerrarSimulado).toHaveBeenCalled());

    expect(mockEncerrarSimulado).toHaveBeenCalledWith('sim-1');
    expect(mockEncerrarSimulado).toHaveBeenCalledTimes(1);
  });

  it('NÃO escreve mais direto em simulados_admin', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockEncerrarSimulado).toHaveBeenCalled());

    // O update direto era o segundo caminho de escrita que a migração eliminou.
    // A leitura (`select`) continua indo por `from`, então não dá para afirmar
    // que `from` nunca é chamado — só que nada mais escreve.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('NÃO chama logAdminAction — a RPC já audita como encerrar_simulado', async () => {
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(mockEncerrarSimulado).toHaveBeenCalled());

    expect(mockLogAdminAction).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('erro da RPC avisa o usuário', async () => {
    mockEncerrarSimulado.mockRejectedValue(new Error('admin role required'));
    render(<ProvasTab />);
    await encerrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
