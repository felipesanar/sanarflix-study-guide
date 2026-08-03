import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import { ContratoSimuladosBoard } from '@/components/admin/contratos/ContratoSimuladosBoard';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchIesContratos,
  upsertIesContrato,
  setIesSimuladosPrevistos,
} from '@/services/admin/contratoSimulados';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/services/admin/contratoSimulados', () => ({
  fetchIesContratos: vi.fn(),
  upsertIesContrato: vi.fn().mockResolvedValue({ contrato_id: 'ct-1', criado: true }),
  deleteIesContrato: vi.fn().mockResolvedValue({ contrato_id: 'ct-1', slots_removidos: 0 }),
  setIesSimuladosPrevistos: vi.fn().mockResolvedValue({
    contrato_id: 'ct-1', slots: 2, criados: 0, atualizados: 2, removidos: 0,
  }),
  setSimuladoAgenda: vi.fn(),
}));

const IES_ROWS = [
  { id: 'ies-1', nome: 'Faculdade Alpha' },
  { id: 'ies-2', nome: 'Faculdade Beta' },
];

const SIMULADO_1 = {
  id: 'sim-1',
  nome: 'Simulado Diagnóstico',
  status: 'ativo',
  modalidade: 'presencial' as const,
  data_realizacao: '2026-08-10T13:00:00.000Z',
  data_liberacao: null,
  data_encerramento: null,
  data_agendada_original: '2026-08-01T13:00:00.000Z',
};

/** IES sem contrato nenhum. */
const PAYLOAD_VAZIO = {
  ies: { id: 'ies-1', nome: 'Faculdade Alpha' },
  contratos: [],
  simulados_disponiveis: [SIMULADO_1],
};

/** Contrato de 2 simulados com os 2 slots já criados (1 vinculado, 1 "A definir"). */
const PAYLOAD_COM_SLOTS = {
  ies: { id: 'ies-1', nome: 'Faculdade Alpha' },
  contratos: [
    {
      id: 'ct-1',
      nome_contrato: 'Contrato 2026',
      simulados_contratados: 2,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-12-31',
      created_at: '2026-07-01T00:00:00.000Z',
      slots: [
        { id: 'sl-1', ordem: 1, nome_previsto: 'Simulado 1', simulado_id: 'sim-1', simulado: SIMULADO_1 },
        { id: 'sl-2', ordem: 2, nome_previsto: null, simulado_id: null, simulado: null },
      ],
    },
  ],
  simulados_disponiveis: [SIMULADO_1],
};

/** Contrato de 2 simulados com 3 slots no banco — estado inválido que a tela precisa denunciar. */
const PAYLOAD_ACIMA_DO_CONTRATADO = {
  ...PAYLOAD_COM_SLOTS,
  contratos: [
    {
      ...PAYLOAD_COM_SLOTS.contratos[0],
      slots: [
        ...PAYLOAD_COM_SLOTS.contratos[0].slots,
        { id: 'sl-3', ordem: 3, nome_previsto: 'Extra', simulado_id: null, simulado: null },
      ],
    },
  ],
};

function mockIesList() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'ies') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: IES_ROWS, error: null }),
      } as any;
    }
    return {} as any;
  });
}

describe('ContratoSimuladosBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIesList();
  });

  it('carrega a lista de IES e seleciona a primeira, buscando o contrato dela', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    render(<ContratoSimuladosBoard />);

    await waitFor(() => {
      expect(fetchIesContratos).toHaveBeenCalledWith('ies-1');
    });
    expect(screen.getByLabelText('IES')).toHaveValue('ies-1');
  });

  it('estado vazio: IES sem contrato mostra o aviso e o formulário de novo contrato', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    render(<ContratoSimuladosBoard />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum contrato cadastrado')).toBeInTheDocument();
    });
    // O cronograma do gestor nasce vazio sem isso — o texto tem que dizer.
    expect(screen.getByText(/cronograma do gestor fica vazio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar contrato/i })).toBeInTheDocument();
  });

  it('criar contrato chama upsertIesContrato com os campos do formulário e recarrega', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByRole('button', { name: /Criar contrato/i }));

    fireEvent.change(screen.getByLabelText('Nome do contrato'), { target: { value: 'Contrato 2026' } });
    fireEvent.change(screen.getByLabelText('Simulados contratados'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Vigência — início'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Vigência — fim'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar contrato/i }));

    await waitFor(() => {
      expect(upsertIesContrato).toHaveBeenCalledWith({
        iesId: 'ies-1',
        nome: 'Contrato 2026',
        simuladosContratados: 7,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
      });
    });
    // Recarrega depois de salvar: 1ª chamada no mount + 1ª depois do upsert.
    await waitFor(() => expect(fetchIesContratos).toHaveBeenCalledTimes(2));
  });

  it('contrato com slots: renderiza uma linha por slot, com "A definir" no slot sem simulado', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_COM_SLOTS as any);
    render(<ContratoSimuladosBoard />);

    await waitFor(() => expect(screen.getByText('Contrato 2026')).toBeInTheDocument());
    expect(screen.getByText('2 slot(s) de 2 contratado(s)')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulado do slot 1')).toHaveValue('sim-1');
    expect(screen.getByLabelText('Simulado do slot 2')).toHaveValue('');
    // Cada <select> nativo tem sua própria option "A definir" no DOM (mesmo
    // quando não é a selecionada) — por isso getAllByText, não getByText.
    expect(screen.getAllByText('A definir').length).toBeGreaterThan(0);
  });

  it('contrato lotado: "Adicionar slot" fica desabilitado e explica o limite', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_COM_SLOTS as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByText('Contrato 2026'));

    expect(screen.getByRole('button', { name: /Adicionar slot/i })).toBeDisabled();
    expect(screen.getByText(/Limite de 2 slot\(s\) do contrato atingido/i)).toBeInTheDocument();
  });

  it('slots acima do contratado: mostra o alerta e bloqueia o salvamento', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_ACIMA_DO_CONTRATADO as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByText('Contrato 2026'));

    expect(screen.getByText(/3 slot\(s\) para 2 simulado\(s\) contratado\(s\)/i)).toBeInTheDocument();

    const salvar = screen.getByRole('button', { name: /Salvar slots/i });
    expect(salvar).toBeDisabled();
    fireEvent.click(salvar);
    expect(setIesSimuladosPrevistos).not.toHaveBeenCalled();
  });

  it('vincular um simulado a um slot e salvar envia o array completo de slots', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_COM_SLOTS as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByText('Contrato 2026'));

    // Desvincula o slot 1 (volta para "A definir") — mudança suficiente para habilitar o salvar.
    fireEvent.change(screen.getByLabelText('Simulado do slot 1'), { target: { value: '' } });

    const salvar = screen.getByRole('button', { name: /Salvar slots/i });
    await waitFor(() => expect(salvar).not.toBeDisabled());
    fireEvent.click(salvar);

    await waitFor(() => {
      expect(setIesSimuladosPrevistos).toHaveBeenCalledWith('ct-1', [
        { ordem: 1, nome_previsto: 'Simulado 1', simulado_id: null },
        { ordem: 2, nome_previsto: null, simulado_id: null },
      ]);
    });
  });

  it('erro no carregamento mostra AdminError com a mensagem e permite tentar de novo', async () => {
    vi.mocked(fetchIesContratos).mockRejectedValueOnce(new Error('admin role required'));
    render(<ContratoSimuladosBoard />);

    await waitFor(() => expect(screen.getByText('admin role required')).toBeInTheDocument());

    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    await waitFor(() => expect(screen.getByText('Nenhum contrato cadastrado')).toBeInTheDocument());
  });
});
