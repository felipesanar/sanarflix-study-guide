/**
 * TESTES DE CARACTERIZAÇÃO do save em modo edição.
 *
 * Escritos ANTES da migração para `admin_update_simulado` (escopo extra da Task
 * 10 da Fase 0b, decidido pelo Felipe em 28/07), quando o dialog escrevia via
 * `.from('simulados_admin').update(...)`. Os asserts foram reapontados para a
 * RPC, mas o COMPORTAMENTO exigido é o mesmo — é isso que prova a migração
 * equivalente em vez de apenas parecer. Até esta suíte existir, os dois call
 * sites de `simulados_admin` tinham ZERO cobertura.
 *
 * O que está travado aqui, e por quê:
 * - As 9 colunas do save, campo a campo. A RPC anterior
 *   (`admin_set_simulado_agenda`) recebia só 4 delas e nenhum `status` — foi
 *   exatamente isso que travou a migração e motivou o alargamento.
 * - `atualizarAgenda` NÃO é enviado como true: é o que faz a RPC preservar
 *   `modalidade`/`data_realizacao`, que este dialog não conhece. Se isso
 *   regredir, todo save apaga a agenda do simulado.
 * - Achado P2: editar sem tocar no agendamento NÃO reescreve `data_liberacao`
 *   para "agora" — mantém o valor que veio do banco.
 * - Achado P1: `statusDb === 'encerrado'` é preservado mesmo alterando datas;
 *   salvar nunca reabre uma prova encerrada manualmente.
 * - A auditoria agora é da RPC: `logAdminAction` NÃO deve mais ser chamado no
 *   save de edição, senão haveria duas linhas por save.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import SimuladoConfigDialog from '@/components/admin/simulados/SimuladoConfigDialog';
import type { IES, Simulado } from '@/components/admin/simulados/ProvasTab';

const mockFrom = vi.fn();
const mockUpdateSimulado = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/services/admin/simulados', () => ({
  updateSimulado: (...args: unknown[]) => mockUpdateSimulado(...args),
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

/** Captura o input passado a `updateSimulado`. */
function payloadDoUpdate(): Record<string, unknown> {
  expect(mockUpdateSimulado).toHaveBeenCalledTimes(1);
  return mockUpdateSimulado.mock.calls[0][0] as Record<string, unknown>;
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
    mockFrom.mockReturnValue({});
    mockUpdateSimulado.mockResolvedValue({ simulado_id: 'sim-1', reagendado: false });
    mockLogAdminAction.mockResolvedValue(undefined);
  });

  it('manda EXATAMENTE os 10 campos do save (9 colunas + o id), e nenhum a mais', async () => {
    renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    expect(Object.keys(payloadDoUpdate()).sort()).toEqual(
      [
        'dataEncerramento',
        'dataLiberacao',
        'dataLiberacaoDesempenho',
        'descricao',
        'duracaoMinutos',
        'iesIds',
        'liberacaoDesempenho',
        'nome',
        'simuladoId',
        'status',
      ].sort(),
    );
  });

  it('NÃO manda agenda: sem atualizarAgenda, modalidade nem data_realizacao', async () => {
    renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    const payload = payloadDoUpdate();
    // Omitir estes campos é o que faz a RPC PRESERVAR a agenda no banco.
    // Se algum deles aparecer com atualizarAgenda=true, todo save apaga
    // modalidade e data_realizacao do simulado.
    expect(payload.atualizarAgenda).toBeUndefined();
    expect(payload).not.toHaveProperty('modalidade');
    expect(payload).not.toHaveProperty('dataRealizacao');
  });

  it('identifica a linha pelo id do simulado', async () => {
    renderDialog(makeSimulado({ id: 'sim-42' }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    expect(payloadDoUpdate().simuladoId).toBe('sim-42');
  });

  it('P2: salvar sem tocar no agendamento preserva a data_liberacao do banco', async () => {
    const original = '2026-01-10T13:00:00.000Z';
    renderDialog(makeSimulado({ data_liberacao: original }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    // O bug P2 era reescrever para "agora" a cada save. Deve sair idêntico.
    expect(payloadDoUpdate().dataLiberacao).toBe(original);
  });

  it('P1: statusDb encerrado é preservado no save', async () => {
    renderDialog(makeSimulado({ statusDb: 'encerrado', status: 'encerrado' }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

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
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    const payload = payloadDoUpdate();
    expect(payload.nome).toBe('Simulado X');
    expect(payload.descricao).toBe('Texto');
    expect(payload.duracaoMinutos).toBe(240);
    expect(payload.iesIds).toEqual(['ies-1', 'ies-2']);
  });

  it('descricao vazia vira null (não string vazia)', async () => {
    renderDialog(makeSimulado({ descricao: '' }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    expect(payloadDoUpdate().descricao).toBeNull();
  });

  it('NÃO chama logAdminAction no save de edição — a RPC já audita', async () => {
    const { onSaved } = renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    // Chamar os dois daria duas linhas de auditoria por save.
    expect(mockLogAdminAction).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('erro da RPC mostra toast de erro e NÃO chama onSaved', async () => {
    mockUpdateSimulado.mockRejectedValue(new Error('status inválido: publicado'));
    const { onSaved } = renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(onSaved).not.toHaveBeenCalled();
  });

  it('NÃO escreve mais direto em simulados_admin', async () => {
    renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    // O ponto da migração: um só caminho de escrita, auditado.
    expect(mockFrom).not.toHaveBeenCalledWith('simulados_admin');
  });
});
