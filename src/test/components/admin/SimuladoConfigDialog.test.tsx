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
 * ATUALIZAÇÃO 03/08 (decisão do Felipe): quem marca modalidade e data de
 * realização do simulado é o ADMIN (equipe B2B) nesta mesma tela — não o CX.
 * O dialog passou a conhecer `modalidade`/`data_realizacao` e agora ENVIA
 * `atualizarAgenda: true` em todo save de edição (antes ficava em `false` de
 * propósito, porque o form não conhecia esses campos). Os dois primeiros
 * testes abaixo foram ajustados para o novo contrato — a intenção que eles
 * protegem virou o oposto: antes provavam que a agenda NUNCA era tocada;
 * agora provam que ela é SEMPRE enviada, e com os valores certos (ver também
 * os testes de modalidade/data de realização mais abaixo).
 *
 * O que está travado aqui, e por quê:
 * - As 12 colunas do save, campo a campo (9 + modalidade + dataRealizacao +
 *   atualizarAgenda). A RPC anterior (`admin_set_simulado_agenda`) recebia só
 *   4 delas e nenhum `status` — foi exatamente isso que travou a primeira
 *   migração e motivou o alargamento.
 * - `atualizarAgenda: true` é enviado sempre — é o que faz a RPC GRAVAR
 *   `modalidade`/`data_realizacao` que este dialog agora edita.
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
    modalidade: null,
    data_realizacao: null,
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

  it('manda EXATAMENTE os 13 campos do save (10 anteriores + atualizarAgenda + modalidade + dataRealizacao), e nenhum a mais', async () => {
    renderDialog(makeSimulado());
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    expect(Object.keys(payloadDoUpdate()).sort()).toEqual(
      [
        'atualizarAgenda',
        'dataEncerramento',
        'dataLiberacao',
        'dataLiberacaoDesempenho',
        'dataRealizacao',
        'descricao',
        'duracaoMinutos',
        'iesIds',
        'liberacaoDesempenho',
        'modalidade',
        'nome',
        'simuladoId',
        'status',
      ].sort(),
    );
  });

  it('SEMPRE manda atualizarAgenda: true — esta tela agora é a dona da escrita de modalidade/data de realização', async () => {
    renderDialog(makeSimulado({ modalidade: null, data_realizacao: null }));
    await clicarAtualizar();
    await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

    const payload = payloadDoUpdate();
    expect(payload.atualizarAgenda).toBe(true);
    // As chaves existem no payload mesmo quando o valor é null — é isso que
    // permite o admin LIMPAR uma modalidade definida incorretamente.
    expect(payload).toHaveProperty('modalidade');
    expect(payload).toHaveProperty('dataRealizacao');
    expect(payload.modalidade).toBeNull();
    expect(payload.dataRealizacao).toBeNull();
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

  describe('modalidade e data de realização (decisão do Felipe, 03/08)', () => {
    it('inicializa modalidade e data de realização a partir do registro ao abrir para editar', () => {
      renderDialog(
        makeSimulado({ modalidade: 'presencial', data_realizacao: '2026-09-10T13:00:00.000Z' }),
      );

      // -3h em relação ao ISO salvo — mesmo padrão de brazilISOToDatetimeLocal
      // usado pelos outros campos de data desta tela.
      expect(screen.getByLabelText(/data de realização/i)).toHaveValue('2026-09-10T10:00');
      expect(screen.getByRole('combobox', { name: 'Modalidade' })).toHaveTextContent('Presencial');
    });

    it('P2-equivalente: salvar sem tocar na agenda preserva modalidade e data_realizacao do banco (não apaga)', async () => {
      const dataOriginal = '2026-09-10T13:00:00.000Z';
      renderDialog(makeSimulado({ modalidade: 'presencial', data_realizacao: dataOriginal }));
      await clicarAtualizar();
      await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

      const payload = payloadDoUpdate();
      expect(payload.modalidade).toBe('presencial');
      expect(payload.dataRealizacao).toBe(dataOriginal);
    });

    it('modalidade escolhida pelo admin no select é enviada no save', async () => {
      // Radix Select precisa de scrollIntoView/hasPointerCapture, ausentes no jsdom.
      Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
      Element.prototype.scrollIntoView = vi.fn();

      renderDialog(makeSimulado({ modalidade: null }));

      fireEvent.click(screen.getByRole('combobox', { name: 'Modalidade' }));
      const option = await screen.findByText('Online', { selector: '[role="option"], [role="option"] *' });
      fireEvent.click(option);

      await clicarAtualizar();
      await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

      expect(payloadDoUpdate().modalidade).toBe('online');
    });

    it('data de realização digitada pelo admin é convertida para ISO de Brasília e enviada', async () => {
      renderDialog(makeSimulado({ modalidade: 'presencial', data_realizacao: null }));

      fireEvent.change(screen.getByLabelText(/data de realização/i), {
        target: { value: '2026-10-05T09:00' },
      });

      await clicarAtualizar();
      await waitFor(() => expect(mockUpdateSimulado).toHaveBeenCalled());

      expect(payloadDoUpdate().dataRealizacao).toBe('2026-10-05T12:00:00.000Z');
    });

    it('avisa (sem bloquear) quando é online e não tem data de início', () => {
      renderDialog(makeSimulado({ modalidade: 'online', data_liberacao: null }));

      expect(screen.getByText(/sem data de início/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /atualizar simulado/i })).not.toBeDisabled();
    });

    it('avisa (sem bloquear) quando é presencial e não tem data de realização', () => {
      renderDialog(makeSimulado({ modalidade: 'presencial', data_realizacao: null }));

      expect(screen.getByText(/sem data de realização/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /atualizar simulado/i })).not.toBeDisabled();
    });

    it('avisa (sem bloquear) quando o término é anterior ao início', () => {
      renderDialog(
        makeSimulado({
          data_liberacao: '2027-06-10T13:00:00.000Z',
          data_encerramento: '2027-06-01T13:00:00.000Z',
        }),
      );

      expect(screen.getByText(/anterior ao início/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /atualizar simulado/i })).not.toBeDisabled();
    });
  });
});
