/**
 * TESTES DE CARACTERIZAÇÃO — fixam o comportamento ATUAL do save em modo edição
 * antes da migração para `admin_update_simulado` (escopo extra da Task 10 da
 * Fase 0b, decidido pelo Felipe em 28/07).
 *
 * Este arquivo NÃO descreve o comportamento desejado; ele descreve o que o
 * código faz hoje, para que a migração seja provada equivalente em vez de
 * apenas parecer. Até esta suíte existir, os dois call sites de
 * `simulados_admin` tinham ZERO cobertura.
 *
 * O que está sendo travado aqui, e por quê:
 * - O payload de 9 colunas do `.update()`, campo a campo. É o contrato que a
 *   RPC nova precisa reproduzir; ela só recebe 4 dessas colunas na assinatura
 *   original, e foi isso que travou a migração.
 * - Achado P2: editar sem tocar no agendamento NÃO reescreve `data_liberacao`
 *   para "agora" — mantém o valor que veio do banco.
 * - Achado P1: `statusDb === 'encerrado'` é preservado mesmo alterando datas;
 *   salvar nunca reabre uma prova encerrada manualmente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import SimuladoConfigDialog from '@/components/admin/simulados/SimuladoConfigDialog';
import type { IES, Simulado } from '@/components/admin/simulados/ProvasTab';

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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

const IES_LIST: IES[] = [
  { id: 'ies-1', nome: 'Faculdade Alpha' },
  { id: 'ies-2', nome: 'Faculdade Beta' },
];

/** Simulado 'ativo' com data_liberacao no PASSADO e encerramento no futuro. */
function makeSimulado(overrides: Partial<Simulado> = {}): Simulado {
  return {
    id: 'sim-1',
    nome: 'Simulado Diagnóstico',
    descricao: 'Descrição original',
    data_liberacao: '2026-01-10T13:00:00.000Z',
    data_encerramento: '2027-12-20T13:00:00.000Z',
    duracao_minutos: 180,
    status: 'ativo',
    statusDb: 'ativo',
    created_at: '2026-01-01T00:00:00.000Z',
    ies_ids: ['ies-1'],
    questoes_count: 40,
    liberacao_desempenho: 'imediato',
    data_liberacao_desempenho: null,
    ...overrides,
  };
}

/** Captura o objeto passado ao `.update()` do supabase. */
function payloadDoUpdate(): Record<string, unknown> {
  expect(mockFrom).toHaveBeenCalledWith('simulados_admin');
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  return mockUpdate.mock.calls[0][0] as Record<string, unknown>;
}

function renderDialog(simulado: Simulado, onSaved = vi.fn()) {
  render(
    <SimuladoConfigDialog
      open
      onOpenChange={vi.fn()}
      mode="edit"
      simulado={simulado}
      iesList={IES_LIST}
      onSaved={onSaved}
    />,
  );
  return { onSaved };
}

const clicarAtualizar = async () => {
  const btn = screen.getByRole('button', { name: /atualizar simulado/i });
  expect(btn).not.toBeDisabled();
  fireEvent.click(btn);
};

describe('SimuladoConfigDialog — caracterização do save em modo edição', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: (...a: unknown[]) => mockEq(...a) });
    mockFrom.mockReturnValue({ update: (...a: unknown[]) => mockUpdate(...a) });
    mockLogAdminAction.mockResolvedValue(undefined);
  });

  it('escreve EXATAMENTE as 9 colunas conhecidas, e nenhuma a mais', async () => {
    renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    expect(Object.keys(payloadDoUpdate()).sort()).toEqual(
      [
        'data_encerramento',
        'data_liberacao',
        'data_liberacao_desempenho',
        'descricao',
        'duracao_minutos',
        'ies_ids',
        'liberacao_desempenho',
        'nome',
        'status',
      ].sort(),
    );
  });

  it('NÃO escreve modalidade, data_realizacao nem data_agendada_original', async () => {
    renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    const payload = payloadDoUpdate();
    expect(payload).not.toHaveProperty('modalidade');
    expect(payload).not.toHaveProperty('data_realizacao');
    expect(payload).not.toHaveProperty('data_agendada_original');
  });

  it('filtra a linha pelo id do simulado', async () => {
    renderDialog(makeSimulado({ id: 'sim-42' }));
    await clicarAtualizar();
    await waitFor(() => expect(mockEq).toHaveBeenCalled());

    expect(mockEq).toHaveBeenCalledWith('id', 'sim-42');
  });

  it('P2: salvar sem tocar no agendamento preserva a data_liberacao do banco', async () => {
    const original = '2026-01-10T13:00:00.000Z';
    renderDialog(makeSimulado({ data_liberacao: original }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    // O bug P2 era reescrever para "agora" a cada save. Deve sair idêntico.
    expect(payloadDoUpdate().data_liberacao).toBe(original);
  });

  it('P1: statusDb encerrado é preservado no save', async () => {
    renderDialog(makeSimulado({ statusDb: 'encerrado', status: 'encerrado' }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    expect(payloadDoUpdate().status).toBe('encerrado');
  });

  it('propaga nome, descricao, duracao e ies_ids vindos do simulado', async () => {
    renderDialog(
      makeSimulado({
        nome: 'Simulado X',
        descricao: 'Texto',
        duracao_minutos: 240,
        ies_ids: ['ies-1', 'ies-2'],
      }),
    );
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    const payload = payloadDoUpdate();
    expect(payload.nome).toBe('Simulado X');
    expect(payload.descricao).toBe('Texto');
    expect(payload.duracao_minutos).toBe(240);
    expect(payload.ies_ids).toEqual(['ies-1', 'ies-2']);
  });

  it('descricao vazia vira null (não string vazia)', async () => {
    renderDialog(makeSimulado({ descricao: '' }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    expect(payloadDoUpdate().descricao).toBeNull();
  });

  it('audita como editar_simulado e chama onSaved no sucesso', async () => {
    const { onSaved } = renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    expect(mockLogAdminAction).toHaveBeenCalledWith('editar_simulado', null, {
      simulado_id: 'sim-1',
      nome: 'Simulado Diagnóstico',
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('erro no update mostra toast de erro e NÃO chama onSaved', async () => {
    mockEq.mockResolvedValue({ error: { message: 'permission denied' } });
    const { onSaved } = renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(onSaved).not.toHaveBeenCalled();
    expect(mockLogAdminAction).not.toHaveBeenCalled();
  });
});
