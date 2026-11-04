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
  { userId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', nome: 'Çãtia Ñandú Öztürk', matricula: '20240002' },
  { userId: '22222222-3333-4444-8555-666666666666', nome: 'Álvaro Falso', matricula: '20240003' },
];
const SEM_MATRICULA = { userId: '33333333-4444-4555-8666-777777777777', nome: 'Beltrano Sem RA', matricula: null, email: 'Beltrano@X.com' };
const REPETIDA_1 = { userId: '44444444-5555-4666-8777-888888888888', nome: 'Cadastro Errado Um', matricula: '99-G-99999', email: 'um@x.com' };
const REPETIDA_2 = { userId: '55555555-6666-4777-8888-999999999999', nome: 'Cadastro Errado Dois', matricula: '99-G-99999', email: 'dois@x.com' };
const COM_ESPACO = { userId: '66666666-7777-4888-8999-aaaaaaaaaaaa', nome: 'Matrícula Com Espaço', matricula: '12 34', email: 'espaco@x.com' };
const SEM_NADA = { userId: '77777777-8888-4999-8aaa-bbbbbbbbbbbb', nome: 'Sem Nada No Cadastro', matricula: null, email: null };
const SEM_NADA_2 = { userId: '88888888-9999-4aaa-8bbb-cccccccccccc', nome: 'Também Sem Nada', matricula: '', email: 'sem-arroba' };

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
    expect(await screen.findByText('Nenhum usuário nesta IES')).toBeInTheDocument();
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

  it('quem não tem matrícula utilizável é identificado pelo e-mail e entra no PDF, com aviso', async () => {
    prepararSimulado([IES_A], [...ALUNOS, SEM_MATRICULA, REPETIDA_1, REPETIDA_2, COM_ESPACO, SEM_NADA]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    expect(screen.getByText('7 de 7 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF \(7 cartões\)/ })).toBeEnabled();
    expect(screen.getByText(/4 usuários não têm matrícula utilizável no cadastro e serão identificados pelo e-mail/)).toBeInTheDocument();
    expect(screen.getAllByText('por e-mail')).toHaveLength(4);
    expect(screen.getByText('beltrano@x.com', { exact: false })).toBeInTheDocument();
    // a matrícula repetida e a com espaço também caem no plano B
    expect(screen.getByText('um@x.com')).toBeInTheDocument();
    expect(screen.getByText('espaco@x.com')).toBeInTheDocument();
  });

  it('só fica fora do PDF quem não tem matrícula nem e-mail utilizáveis, com o motivo dos dois', async () => {
    prepararSimulado([IES_A], [...ALUNOS, SEM_NADA, SEM_NADA_2]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    expect(screen.getByText('3 de 3 selecionados')).toBeInTheDocument();
    expect(screen.getByText('2 usuários ficam fora do PDF')).toBeInTheDocument();
    const fora = within(screen.getByLabelText('Alunos fora do PDF'));
    expect(fora.getByText('sem matrícula cadastrada / sem e-mail cadastrado')).toBeInTheDocument();
    expect(fora.getByText('sem matrícula cadastrada / e-mail inválido para o QR')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cartão para Sem Nada No Cadastro')).not.toBeInTheDocument();
  });

  it('o CSV dos excluídos traz nome, matrícula, e-mail, semestre e o motivo', async () => {
    prepararSimulado([IES_A], [...ALUNOS, SEM_NADA, SEM_NADA_2]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('2 usuários ficam fora do PDF');
    fireEvent.click(screen.getByRole('button', { name: /Baixar CSV/ }));
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as Blob;
    expect(blob.type).toContain('text/csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM, para o Excel abrir em UTF-8
    const texto = new TextDecoder().decode(bytes.slice(3));
    expect(texto.startsWith('nome;matricula;email;semestre;papel;motivo\r\n')).toBe(true);
    expect(texto).toContain('Sem Nada No Cadastro;;;;;sem matrícula cadastrada / sem e-mail cadastrado');
    expect(texto).toContain('Também Sem Nada;;sem-arroba;;;sem matrícula cadastrada / e-mail inválido para o QR');
  });

  it('IES em que ninguém tem matrícula nem e-mail utilizáveis: explica e não deixa gerar', async () => {
    prepararSimulado([IES_A], [SEM_NADA, SEM_NADA_2]);
    render(<CartoesTab />);
    await escolherSimulado();
    expect(await screen.findByText('Nenhum usuário com matrícula ou e-mail utilizável nesta IES')).toBeInTheDocument();
    expect(screen.getByText('2 usuários ficam fora do PDF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF \(0 cartões\)/ })).toBeDisabled();
  });

  it('IES onde só há e-mail (nenhuma matrícula) emite para todos', async () => {
    prepararSimulado([IES_A], [SEM_MATRICULA, REPETIDA_1]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Beltrano Sem RA');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF \(2 cartões\)/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('busca também por e-mail', async () => {
    prepararSimulado([IES_A], [...ALUNOS, SEM_MATRICULA]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Beltrano Sem RA');
    fireEvent.change(screen.getByLabelText('Buscar aluno'), { target: { value: 'beltrano@x' } });
    expect(screen.getByText('Beltrano Sem RA')).toBeInTheDocument();
    expect(screen.queryByText('Maria Exemplo da Silva')).not.toBeInTheDocument();
  });

  it('depois de gerar, baixa a lista da emissão com matrícula e e-mail para o script de leitura', async () => {
    prepararSimulado([IES_A], [{ ...ALUNOS[0]!, matricula: ' ab-1 ' }, ALUNOS[2]!, SEM_MATRICULA]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    expect(screen.queryByRole('button', { name: /Baixar lista da emissão/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF/ }));
    const botao = await screen.findByRole('button', { name: /Baixar lista da emissão/ });
    fireEvent.click(botao);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as Blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const crlf = String.fromCharCode(13, 10);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(
      ['identificacao;tipo;nome', '20240003;matricula;Álvaro Falso', 'beltrano@x.com;email;Beltrano Sem RA', 'AB-1;matricula;Maria Exemplo da Silva', ''].join(crlf),
    );
  });

  it('o PDF sai com a matrícula normalizada de cada aluno marcado', async () => {
    prepararSimulado([IES_A], [{ ...ALUNOS[0]!, matricula: ' ab-1 ' }]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Maria Exemplo da Silva');
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });
});

const POR_SEMESTRE = [
  { userId: 'a1000000-0000-4000-8000-000000000001', nome: 'Ana Sexto', matricula: '2024001', semestre: 6 },
  { userId: 'a1000000-0000-4000-8000-000000000002', nome: 'Beto Sétimo', matricula: '2024002', semestre: 7 },
  { userId: 'a1000000-0000-4000-8000-000000000003', nome: 'Carla Sétimo', matricula: '2024003', semestre: 7 },
  { userId: 'a1000000-0000-4000-8000-000000000004', nome: 'Davi Oitavo', matricula: '2024004', semestre: 8 },
  { userId: 'a1000000-0000-4000-8000-000000000005', nome: 'Eva Sem Semestre', matricula: '2024005', semestre: null },
  { userId: 'a1000000-0000-4000-8000-000000000006', nome: 'Fabio Sétimo Sem RA', matricula: null, semestre: 7 },
  { userId: 'a1000000-0000-4000-8000-000000000007', nome: 'Gil Oitavo Sem RA', matricula: null, semestre: 8 },
];

describe('CartoesTab: filtro de semestre', () => {
  async function abrir() {
    prepararSimulado([IES_A], POR_SEMESTRE);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Ana Sexto');
    return screen.getByRole('group', { name: 'Filtrar por semestre' });
  }

  it('mostra um botão por semestre existente, com a contagem, e começa sem filtro', async () => {
    const grupo = await abrir();
    const botoes = within(grupo).getAllByRole('button').map((b) => b.textContent);
    expect(botoes).toEqual(['6º (1)', '7º (3)', '8º (2)', 'Sem semestre (1)']);
    expect(screen.getByText('5 de 5 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF \(5 cartões\)/ })).toBeEnabled();
  });

  it('escolher um semestre deixa só ele na lista, na conta e no painel de excluídos', async () => {
    const grupo = await abrir();
    fireEvent.click(within(grupo).getByRole('button', { name: '7º (3)' }));
    expect(screen.getByText('Beto Sétimo')).toBeInTheDocument();
    expect(screen.getByText('Carla Sétimo')).toBeInTheDocument();
    expect(screen.queryByText('Ana Sexto')).not.toBeInTheDocument();
    expect(screen.queryByText('Davi Oitavo')).not.toBeInTheDocument();
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF \(2 cartões\)/ })).toBeEnabled();
    const fora = within(screen.getByLabelText('Alunos fora do PDF'));
    expect(fora.getByText('Fabio Sétimo Sem RA')).toBeInTheDocument();
    expect(fora.queryByText('Gil Oitavo Sem RA')).not.toBeInTheDocument();
    expect(screen.getByText('1 usuário fica fora do PDF')).toBeInTheDocument();
  });

  it('vários semestres somam, e "Limpar filtro" volta a todos', async () => {
    const grupo = await abrir();
    fireEvent.click(within(grupo).getByRole('button', { name: '6º (1)' }));
    fireEvent.click(within(grupo).getByRole('button', { name: '8º (2)' }));
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: '6º (1)' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(grupo).getByRole('button', { name: 'Limpar filtro' }));
    expect(screen.getByText('5 de 5 selecionados')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).not.toBeInTheDocument();
  });

  it('"Sem semestre" pega quem não tem semestre cadastrado', async () => {
    const grupo = await abrir();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Sem semestre (1)' }));
    expect(screen.getByText('Eva Sem Semestre')).toBeInTheDocument();
    expect(screen.getByText('1 de 1 selecionados')).toBeInTheDocument();
  });

  it('o PDF só leva os alunos do filtro, e o arquivo traz o semestre no nome', async () => {
    const grupo = await abrir();
    fireEvent.click(within(grupo).getByRole('button', { name: '6º (1)' }));
    fireEvent.click(within(grupo).getByRole('button', { name: '7º (3)' }));
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF \(3 cartões\)/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success.mock.calls[0]![1]).toMatchObject({
      description: expect.stringContaining('3 cartão(ões) em cartoes_faculdade-exemplo_simulado-enamed-2026_sem-6-7.pdf'),
    });
    // a lista da emissão acompanha: só quem recebeu cartão
    fireEvent.click(await screen.findByRole('button', { name: /Baixar lista da emissão/ }));
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as Blob;
    const texto = new TextDecoder().decode((await blob.arrayBuffer()).slice(3));
    expect(texto).toContain('2024001;matricula;Ana Sexto');
    expect(texto).toContain('2024003;matricula;Carla Sétimo');
    expect(texto).not.toContain('Davi');
    expect(texto).not.toContain('Eva');
  });

  it('desmarcar um aluno e depois trocar o filtro remarca todos do novo filtro', async () => {
    const grupo = await abrir();
    fireEvent.click(within(grupo).getByRole('button', { name: '7º (3)' }));
    fireEvent.click(screen.getByLabelText('Cartão para Beto Sétimo'));
    expect(screen.getByText('1 de 2 selecionados')).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: '8º (2)' }));
    expect(screen.getByText('3 de 3 selecionados')).toBeInTheDocument();
  });

  it('o CSV dos excluídos respeita o filtro e traz o semestre', async () => {
    const grupo = await abrir();
    fireEvent.click(within(grupo).getByRole('button', { name: '8º (2)' }));
    fireEvent.click(screen.getByRole('button', { name: /Baixar CSV/ }));
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as Blob;
    const texto = new TextDecoder().decode((await blob.arrayBuffer()).slice(3));
    expect(texto).toContain('Gil Oitavo Sem RA;;;8;;sem matrícula cadastrada / sem e-mail cadastrado');
    expect(texto).not.toContain('Fabio');
  });

  it('com um só semestre na IES o filtro nem aparece', async () => {
    prepararSimulado([IES_A], [POR_SEMESTRE[1]!, POR_SEMESTRE[2]!]);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Beto Sétimo');
    expect(screen.queryByRole('group', { name: 'Filtrar por semestre' })).not.toBeInTheDocument();
  });

  it('trocar de IES zera o filtro', async () => {
    prepararSimulado([IES_A, IES_UA], POR_SEMESTRE);
    render(<CartoesTab />);
    await escolherSimulado();
    await waitFor(() => expect(screen.getByLabelText('IES')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('IES'), { target: { value: IES_A.id } });
    const grupo = await screen.findByRole('group', { name: 'Filtrar por semestre' });
    fireEvent.click(within(grupo).getByRole('button', { name: '7º (3)' }));
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('IES'), { target: { value: IES_UA.id } });
    fireEvent.change(screen.getByLabelText('IES'), { target: { value: IES_A.id } });
    await screen.findByText('Ana Sexto');
    expect(screen.getByText('5 de 5 selecionados')).toBeInTheDocument();
  });
});

const UVA = [
  { userId: 'b1000000-0000-4000-8000-000000000001', nome: 'Aluno Sétimo Um', matricula: '1', email: 'um@x.com', semestre: 7, papeis: [] },
  { userId: 'b1000000-0000-4000-8000-000000000002', nome: 'Aluno Sétimo Dois', matricula: '2', email: 'dois@x.com', semestre: 7, papeis: [] },
  { userId: 'b1000000-0000-4000-8000-000000000003', nome: 'Ana Professora', matricula: null, email: 'ana.prof@x.com', semestre: null, papeis: ['professor'] },
  { userId: 'b1000000-0000-4000-8000-000000000004', nome: 'Alberto Professor', matricula: '4', email: 'alberto@x.com', semestre: null, papeis: ['professor'] },
  { userId: 'b1000000-0000-4000-8000-000000000005', nome: 'Aline Gestora', matricula: null, email: 'aline@x.com', semestre: null, papeis: ['gestor', 'professor'] },
  { userId: 'b1000000-0000-4000-8000-000000000006', nome: 'Sem Nada Equipe', matricula: null, email: null, semestre: null, papeis: ['professor'] },
];

describe('CartoesTab: todos os usuários da IES (inclui a equipe)', () => {
  async function abrir() {
    prepararSimulado([IES_A], UVA);
    render(<CartoesTab />);
    await escolherSimulado();
    await screen.findByText('Aluno Sétimo Um');
  }

  it('lista todo mundo, e o total da tela bate com o da IES', async () => {
    await abrir();
    expect(screen.getByTestId('resumo-ies')).toHaveTextContent('6 usuários na IES: 2 alunos e 4 da equipe');
    // aptos na lista (5) + 1 fora do PDF (equipe sem matrícula nem e-mail) = 6
    expect(screen.getAllByLabelText(/^Cartão para /)).toHaveLength(5);
    expect(screen.getByText('1 usuário fica fora do PDF')).toBeInTheDocument();
    expect(screen.getByText('Ana Professora')).toBeInTheDocument();
    expect(screen.getByText('Alberto Professor')).toBeInTheDocument();
    expect(screen.getByText('Aline Gestora')).toBeInTheDocument();
  });

  it('a equipe vem com selo e desmarcada: só os alunos entram no PDF por padrão', async () => {
    await abrir();
    expect(screen.getByText('2 de 5 selecionados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar PDF \(2 cartões\)/ })).toBeEnabled();
    expect(within(screen.getByLabelText('Alunos da IES')).getAllByText('equipe: professor')).toHaveLength(2);
    expect(screen.getByText('equipe: gestor, professor')).toBeInTheDocument();
    expect(screen.getByLabelText('Cartão para Ana Professora')).not.toBeChecked();
    expect(screen.getByLabelText('Cartão para Aluno Sétimo Um')).toBeChecked();
  });

  it('dá para marcar a equipe e emitir o cartão dela (matrícula ou e-mail)', async () => {
    await abrir();
    fireEvent.click(screen.getByLabelText('Cartão para Ana Professora'));
    fireEvent.click(screen.getByLabelText('Cartão para Alberto Professor'));
    expect(screen.getByRole('button', { name: /Gerar PDF \(4 cartões\)/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /Baixar lista da emissão/ }));
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as Blob;
    const texto = new TextDecoder().decode((await blob.arrayBuffer()).slice(3));
    expect(texto).toContain('ana.prof@x.com;email;Ana Professora');
    expect(texto).toContain('4;matricula;Alberto Professor');
    expect(texto).not.toContain('Aline');
  });

  it('"Marcar todos" marca também a equipe', async () => {
    await abrir();
    fireEvent.click(screen.getByLabelText('Marcar todos os alunos listados'));
    expect(screen.getByText('5 de 5 selecionados')).toBeInTheDocument();
  });

  it('usuários sem semestre aparecem (é o caso de toda a equipe) e o filtro "Sem semestre" os pega', async () => {
    await abrir();
    const grupo = screen.getByRole('group', { name: 'Filtrar por semestre' });
    expect(within(grupo).getByRole('button', { name: 'Sem semestre (4)' })).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: '7º (2)' }));
    // o filtro remarca só alunos: a equipe do filtro fica desmarcada
    expect(screen.getByText('2 de 2 selecionados')).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: '7º (2)' }));
    fireEvent.click(within(grupo).getByRole('button', { name: 'Sem semestre (4)' }));
    expect(screen.getByText('0 de 3 selecionados')).toBeInTheDocument();
    expect(screen.getByText('Ana Professora')).toBeInTheDocument();
  });

  it('o CSV dos excluídos traz o papel de quem é equipe', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /Baixar CSV/ }));
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as Blob;
    const texto = new TextDecoder().decode((await blob.arrayBuffer()).slice(3));
    expect(texto).toContain('Sem Nada Equipe;;;;professor;sem matrícula cadastrada / sem e-mail cadastrado');
  });
});
