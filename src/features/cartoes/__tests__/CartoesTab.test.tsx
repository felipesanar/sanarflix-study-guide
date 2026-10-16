import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const api = vi.hoisted(() => ({
  listarSimulados: vi.fn(),
  listarIes: vi.fn(),
  listarAlunosDaIes: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/features/cartoes/api', async (original) => ({ ...(await original<typeof import('@/features/cartoes/api')>()), ...api }));
vi.mock('sonner', () => ({ toast }));

import CartoesTab from '@/components/admin/simulados/CartoesTab';

const SIM = '9d6c1f0e-0a5b-4c3a-8d2e-123456789abc';
const IES_A = { id: '11111111-1111-4111-8111-111111111111', nome: 'Faculdade Exemplo' };
const IES_UA = { id: '22222222-2222-4222-8222-222222222222', nome: 'VALENÇA' };
const ALUNOS = [
  { userId: '7f3a9c21-5b1e-4f0a-9c3d-0123456789ab', nome: 'Maria Exemplo da Silva', matricula: '20240001' },
  { userId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', nome: 'Çãtia Ñandú Öztürk', matricula: null },
  { userId: '22222222-3333-4444-8555-666666666666', nome: 'Álvaro Falso', matricula: '20240003' },
];

function prepararSimulado(ies: Array<{ id: string; nome: string }>, alunos = ALUNOS) {
  api.listarSimulados.mockResolvedValue([
    { id: SIM, nome: 'SIMULADO ENAMED 2026', iesIds: ies.map((i) => i.id), data: '2026-10-25' },
  ]);
  api.listarIes.mockResolvedValue(ies);
  api.listarAlunosDaIes.mockResolvedValue(alunos);
}

async function escolherSimulado() {
  const select = await screen.findByLabelText('Simulado');
  await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
  fireEvent.change(select, { target: { value: SIM } });
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:cartoes');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('CartoesTab', () => {
  it('lista os simulados e, com uma só IES, já a seleciona e carrega os alunos', async () => {
    prepararSimulado([IES_A]);
    render(<CartoesTab />);
    await escolherSimulado();
    await waitFor(() => expect(screen.getByLabelText('IES')).toHaveValue(IES_A.id));
    await waitFor(() => expect(api.listarAlunosDaIes).toHaveBeenCalledWith(expect.anything(), IES_A.id));
    expect(await screen.findByText('Maria Exemplo da Silva')).toBeInTheDocument();
    expect(screen.getByText('3 de 3 selecionados')).toBeInTheDocument();
    expect(screen.getByLabelText('Data da prova (no cabeçalho)')).toHaveValue('2026-10-25');
    expect(screen.getByRole('button', { name: /Gerar PDF \(3 cartões\)/ })).toBeEnabled();
  });

  it('busca por nome ignorando acento e marca só os listados', async () => {
    prepararSimulado([IES_A]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    fireEvent.change(screen.getByLabelText('Buscar aluno'), { target: { value: 'alvaro' } });
    expect(screen.queryByText('Maria Exemplo da Silva')).not.toBeInTheDocument();
    expect(screen.getByText('Álvaro Falso')).toBeInTheDocument();
    // desmarca só o listado (Álvaro) e confere o contador
    fireEvent.click(screen.getByLabelText('Marcar todos os alunos listados'));
    expect(screen.getByText('2 de 3 selecionados')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar aluno'), { target: { value: '20240001' } });
    expect(screen.getByText('Maria Exemplo da Silva')).toBeInTheDocument();
  });

  it('desmarcar um aluno tira o cartão dele da conta', async () => {
    prepararSimulado([IES_A]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    fireEvent.click(screen.getByLabelText('Cartão para Maria Exemplo da Silva'));
    expect(screen.getByRole('button', { name: /Gerar PDF \(2 cartões\)/ })).toBeEnabled();
  });

  it('gera o PDF só com os alunos marcados e baixa o arquivo', async () => {
    prepararSimulado([IES_A]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    fireEvent.click(screen.getByLabelText('Cartão para Álvaro Falso'));
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success.mock.calls[0]![1]).toMatchObject({ description: expect.stringContaining('2 cartão(ões)') });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(10_000);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Baixar de novo \(2 cartões\)/ })).toBeInTheDocument();
  });

  it('IES do grupo UniAtenas: modelo único pré-selecionado, sem lista de alunos', async () => {
    prepararSimulado([IES_UA]);
    render(<CartoesTab />);
    await escolherSimulado();
    await waitFor(() => expect(screen.getByLabelText(/UniAtenas: cartão único/)).toBeChecked());
    expect(api.listarAlunosDaIes).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Quantidade de cartões no PDF'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF \(3 cartões\)/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success.mock.calls[0]![1]).toMatchObject({ description: expect.stringContaining('3 cartão(ões)') });
  });

  it('IES comum permite trocar para o modelo UniAtenas', async () => {
    prepararSimulado([IES_A]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    fireEvent.click(screen.getByLabelText(/UniAtenas: cartão único/));
    expect(await screen.findByLabelText('Quantidade de cartões no PDF')).toBeInTheDocument();
    expect(screen.queryByText('Maria Exemplo da Silva')).not.toBeInTheDocument();
  });

  it('com mais de uma IES, espera a escolha antes de carregar os alunos', async () => {
    prepararSimulado([IES_A, IES_UA]);
    render(<CartoesTab />);
    await escolherSimulado();
    await waitFor(() => expect(screen.getByLabelText('IES')).not.toBeDisabled());
    expect(api.listarAlunosDaIes).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Gerar PDF/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('IES'), { target: { value: IES_A.id } });
    await waitFor(() => expect(api.listarAlunosDaIes).toHaveBeenCalledTimes(1));
  });

  it('IES sem alunos mostra o estado vazio e não deixa gerar', async () => {
    prepararSimulado([IES_A], []);
    render(<CartoesTab />);
    await escolherSimulado();
    expect(await screen.findByText('Nenhum aluno nesta IES')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF \(0 cartões\)/ })).toBeDisabled();
  });

  it('falha ao carregar os alunos: mostra o erro e tenta de novo', async () => {
    prepararSimulado([IES_A]);
    api.listarAlunosDaIes.mockRejectedValueOnce(new Error('sem permissão')).mockResolvedValue(ALUNOS);
    render(<CartoesTab />);
    await escolherSimulado();
    expect(await screen.findByText('Falha ao carregar os alunos')).toBeInTheDocument();
    expect(screen.getByText('sem permissão')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(await screen.findByText('Maria Exemplo da Silva')).toBeInTheDocument();
  });

  it('falha ao carregar os simulados: mostra o erro com nova tentativa', async () => {
    api.listarSimulados.mockRejectedValueOnce(new Error('rede caiu'));
    render(<CartoesTab />);
    expect(await screen.findByText('Falha ao carregar simulados')).toBeInTheDocument();
    api.listarSimulados.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(await screen.findByLabelText('Simulado')).toBeInTheDocument();
  });

  it('um id de aluno inválido falha com mensagem e não baixa nada', async () => {
    prepararSimulado([IES_A], [{ userId: 'nao-e-uuid', nome: 'Fulano', matricula: null }]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Fulano');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0]![1]).toMatchObject({ description: expect.stringMatching(/UUID/) });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
