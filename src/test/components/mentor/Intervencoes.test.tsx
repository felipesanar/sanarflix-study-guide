import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/mentor/intervencoes', () => ({
  listarIntervencoes: vi.fn(),
  criarIntervencao: vi.fn(),
  atualizarIntervencao: vi.fn(),
  comentarIntervencao: vi.fn(),
}));
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: vi.fn() }));
vi.mock('@/services/mentor/sessoes', () => ({ liberarAgenda: vi.fn() }));

import * as svc from '@/services/mentor/intervencoes';
import { fetchTurma } from '@/services/mentor/turma';
import Intervencoes from '@/features/mentor/routes/Intervencoes';
import { intervaloPeriodo } from '@/features/mentor/components/intervencoes/util';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const card = (over: Record<string, unknown>) => ({
  id: 'c1',
  tipo: 'reuniao_individual',
  titulo: 'Reunião com Ana',
  nota: null,
  status: 'a_fazer',
  alvo: 'aluno',
  origem: 'manual',
  origem_ref: null,
  criado_em: '2026-10-10T15:00:00Z',
  alunos: ['ana@x.com'],
  comentarios: [],
  peso: 1,
  ...over,
});

const turma = [
  { email: 'ana@x.com', nome: 'Ana Souza', telefone: null, semestre: 5, segmento: 'ativo', dias_sem_atividade: 1 },
  { email: 'bia@x.com', nome: 'Bia Lima', telefone: null, semestre: 5, segmento: 'sumido', dias_sem_atividade: 12 },
];

function renderTela(url = '/mentor/intervencoes') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Intervencoes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mock(fetchTurma).mockResolvedValue(turma);
  mock(svc.listarIntervencoes).mockResolvedValue({
    cards: [
      card({ id: 'c1' }),
      card({
        id: 'c2',
        titulo: 'Agenda liberada',
        alunos: ['ana@x.com', 'bia@x.com', 'cris@x.com'],
        origem: 'auto',
        origem_ref: { kind: 'agenda_liberacao', id: 'l1' },
        peso: 3,
        status: 'em_andamento',
      }),
      card({
        id: 'c3',
        tipo: 'reuniao_coletiva',
        titulo: 'Mentoria coletiva',
        alvo: 'turma',
        alunos: [],
        peso: 1,
        status: 'feito',
        origem: 'auto',
        origem_ref: { kind: 'sessao', id: 's1' },
      }),
    ],
    planejadas: 5,
    realizadas: 1,
  });
  mock(svc.atualizarIntervencao).mockResolvedValue({ intervencao_id: 'c1', status: 'em_andamento' });
  mock(svc.criarIntervencao).mockResolvedValue({ intervencao_id: 'novo' });
});

describe('Intervencoes', () => {
  it('medidor usa as somas ponderadas da RPC (3 alunos pesa 3, turma pesa 1)', async () => {
    renderTela();
    expect(await screen.findByTestId('medidor')).toHaveTextContent(
      '1 de 5 intervenções planejadas realizadas no período',
    );
    expect(screen.getByText('Conta 3')).toBeInTheDocument();
  });

  it('mostra colunas com contagem e o rótulo de alvo e origem', async () => {
    renderTela();
    await screen.findByText('Reunião com Ana');
    expect(screen.getByTestId('contagem-a_fazer')).toHaveTextContent('1');
    expect(screen.getByTestId('contagem-em_andamento')).toHaveTextContent('1');
    expect(screen.getByTestId('contagem-feito')).toHaveTextContent('1');
    expect(screen.getByText('3 alunos')).toBeInTheDocument();
    expect(screen.getByText('Turma toda')).toBeInTheDocument();
    expect(screen.getByText('Auto · Agenda liberada')).toBeInTheDocument();
    expect(screen.getByText('Auto · Sessão')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('período padrão é a quinzena e consulta a RPC com datas', async () => {
    renderTela();
    await screen.findByText('Reunião com Ana');
    const [de, ate] = mock(svc.listarIntervencoes).mock.calls[0];
    expect(de).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(intervaloPeriodo('quinzena', '2026-10-14')).toEqual({ de: '2026-09-30', ate: '2026-10-14' });
    expect(intervaloPeriodo('semana', '2026-10-14')).toEqual({ de: '2026-10-12', ate: '2026-10-14' });
    expect(intervaloPeriodo('mes', '2026-10-14')).toEqual({ de: '2026-10-01', ate: '2026-10-14' });
  });

  it('filtra por tipo e busca', async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText('Reunião com Ana');
    await user.selectOptions(screen.getByLabelText('Filtrar por tipo'), 'reuniao_coletiva');
    expect(screen.queryByText('Reunião com Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Mentoria coletiva')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filtrar por tipo'), '');
    await user.type(screen.getByLabelText('Buscar intervenção'), 'bia');
    expect(screen.getByText('Agenda liberada')).toBeInTheDocument();
    expect(screen.queryByText('Mentoria coletiva')).not.toBeInTheDocument();
  });

  it('mudar status pelo menu do card chama atualizarIntervencao', async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText('Reunião com Ana');
    await user.selectOptions(screen.getByLabelText('Mover Reunião com Ana para'), 'em_andamento');
    await waitFor(() => expect(svc.atualizarIntervencao).toHaveBeenCalledWith({ id: 'c1', status: 'em_andamento' }));
  });

  it('criação inline exige tipo e alvo', async () => {
    const user = userEvent.setup();
    renderTela();
    await screen.findByText('Reunião com Ana');
    await user.click(screen.getByRole('button', { name: 'Nova intervenção' }));
    const form = screen.getByRole('form', { name: 'Nova intervenção' });
    await user.click(within(form).getByRole('button', { name: 'Criar' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Escolha o tipo');
    expect(svc.criarIntervencao).not.toHaveBeenCalled();

    await user.selectOptions(within(form).getByLabelText('Tipo'), 'whatsapp');
    await user.click(within(form).getByRole('button', { name: 'Criar' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('aluno ou turma');
    expect(svc.criarIntervencao).not.toHaveBeenCalled();

    await user.selectOptions(within(form).getByLabelText('Para quem'), 'turma');
    await user.click(within(form).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(svc.criarIntervencao).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'whatsapp', alvo: 'turma', alunos: [] }),
      ),
    );
  });

  it('?novo=1&aluno=x abre o criador pré-preenchido', async () => {
    renderTela('/mentor/intervencoes?novo=1&aluno=ana@x.com');
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    expect(within(form).getByLabelText('Para quem')).toHaveValue('aluno');
    await waitFor(() => expect(within(form).getByLabelText('Aluno')).toHaveValue('ana@x.com'));
  });

  it('?alunos=a,b abre o criador com os alunos selecionados e cria como grupo', async () => {
    const user = userEvent.setup();
    renderTela('/mentor/intervencoes?novo=1&alunos=ana@x.com,BIA@x.com,ana@x.com,lixo,%20');
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    expect(within(form).getByLabelText('Para quem')).toHaveValue('grupo');
    const lista = within(form).getByRole('list', { name: 'Alunos selecionados' });
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
    await waitFor(() => expect(within(lista).getByText('Ana Souza')).toBeInTheDocument());

    await user.selectOptions(within(form).getByLabelText('Tipo'), 'reuniao_coletiva');
    await user.click(within(form).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(svc.criarIntervencao).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'reuniao_coletiva', alvo: 'grupo', alunos: ['ana@x.com', 'bia@x.com'] }),
      ),
    );
  });

  it('?alunos= sem ?novo=1 também abre o criador; com 1 e-mail vira "Um aluno"', async () => {
    renderTela('/mentor/intervencoes?alunos=ana@x.com');
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    expect(within(form).getByLabelText('Para quem')).toHaveValue('aluno');
    await waitFor(() => expect(within(form).getByLabelText('Aluno')).toHaveValue('ana@x.com'));
  });

  it('?titulo=&alvo=turma abre o criador para a turma toda com o título pré-preenchido e cria com ele', async () => {
    const user = userEvent.setup();
    const titulo = encodeURIComponent('Tema: Diabetes (Clínica Médica)');
    renderTela(`/mentor/intervencoes?novo=1&alvo=turma&titulo=${titulo}`);
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    expect(within(form).getByLabelText('Para quem')).toHaveValue('turma');
    expect(within(form).getByLabelText('Título')).toHaveValue('Tema: Diabetes (Clínica Médica)');

    await user.selectOptions(within(form).getByLabelText('Tipo'), 'reuniao_coletiva');
    await user.click(within(form).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(svc.criarIntervencao).toHaveBeenCalledWith(
        expect.objectContaining({ alvo: 'turma', alunos: [], titulo: 'Tema: Diabetes (Clínica Médica)' }),
      ),
    );
  });

  it('?titulo= é texto simples: tags somem e passa de 120 caracteres é cortado', async () => {
    const longo = 'x'.repeat(200);
    renderTela(`/mentor/intervencoes?novo=1&titulo=${encodeURIComponent(`<b>Oi</b> ${longo}`)}`);
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    const valor = (within(form).getByLabelText('Título') as HTMLInputElement).value;
    expect(valor.startsWith('Oi xxx')).toBe(true);
    expect(valor).not.toMatch(/[<>]/);
    expect(valor.length).toBe(120);
  });

  it('sem ?titulo= o formulário não mostra o campo Título (como antes)', async () => {
    renderTela('/mentor/intervencoes?novo=1');
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    expect(within(form).queryByLabelText('Título')).toBeNull();
  });

  it('remover um aluno do grupo pré-preenchido tira ele do envio', async () => {
    const user = userEvent.setup();
    renderTela('/mentor/intervencoes?novo=1&alunos=ana@x.com,bia@x.com');
    const form = await screen.findByRole('form', { name: 'Nova intervenção' });
    await user.click(within(form).getAllByRole('button', { name: /^Remover / })[0]);
    await user.selectOptions(within(form).getByLabelText('Tipo'), 'whatsapp');
    await user.click(within(form).getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(svc.criarIntervencao).toHaveBeenCalledWith(expect.objectContaining({ alvo: 'grupo', alunos: ['bia@x.com'] })),
    );
  });

  it('mostra erro com "Tentar de novo"', async () => {
    mock(svc.listarIntervencoes).mockRejectedValue(new Error('boom'));
    renderTela();
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('mostra erro inline com "Tentar de novo" quando a turma não carrega', async () => {
    mock(fetchTurma).mockRejectedValueOnce(new Error('boom'));
    renderTela();
    expect(await screen.findByText(/Não foi possível carregar a turma/)).toBeInTheDocument();
    expect(await screen.findByText('Reunião com Ana')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByText(/Não foi possível carregar a turma/)).not.toBeInTheDocument());
    expect(fetchTurma).toHaveBeenCalledTimes(2);
  });

  it('mostra vazio quando não há cards', async () => {
    mock(svc.listarIntervencoes).mockResolvedValue({ cards: [], planejadas: 0, realizadas: 0 });
    renderTela();
    expect(await screen.findByText(/Nenhuma intervenção neste período/)).toBeInTheDocument();
  });
});
