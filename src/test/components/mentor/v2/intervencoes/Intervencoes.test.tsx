import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { AlunoFlix, MeFlix } from '@/features/mentor/api/fonte';
import { ErroFonte } from '@/features/mentor/api/fonte';
import type { Intervencao, PeriodoIntervencoes, QuadroIntervencoes } from '@/features/mentor/api/types';
import {
  useAlunos, useAtualizarIntervencao, useCanais, useComentarIntervencao, useCriarIntervencao, useIntervencoes, useMe, useRegistrarEvento,
} from '@/features/mentor/api/queries';
import Intervencoes from '@/features/mentor/routes/v2/Intervencoes';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/mentor/api/queries', () => ({
  useMe: vi.fn(), useIntervencoes: vi.fn(), useCriarIntervencao: vi.fn(), useAtualizarIntervencao: vi.fn(),
  useComentarIntervencao: vi.fn(), useRegistrarEvento: vi.fn(), useAlunos: vi.fn(), useCanais: vi.fn(),
}));

// ─── Fixtures (dados do protótipo B2C/B2B, datas de outubro) ────────────────

function me(modalidade: 'b2c' | 'b2b' = 'b2c'): MeFlix {
  return {
    portalMentor: true,
    mentor: { id: 'm1', nome: 'Thiago Taniguchi', fotoUrl: null, agendaUrl: null, modalidade },
    tribos: [{ id: 't1', nome: 'Carcará', slug: 'carcara', modalidade, papel: 'titular', iconeUrl: null, iesNome: null, campus: null, totalAlunos: 87 }],
  } as MeFlix;
}
const aluno = (nome: string, email: string, whatsapp: string | null = '11988887777'): AlunoFlix => ({
  alunoId: email, nome, email, whatsapp, produto: 'pro', acessoAte: null, semestre: null, campus: null, triboId: 't1',
  entrouNaTriboEm: null, origemAlocacao: 'onboarding', ultimaAtividadeEm: '2026-10-08T12:00:00Z', meta: null,
});
const ALUNOS = [aluno('Caio Menezes', 'caio@x.com'), aluno('Marina Albuquerque', 'marina@x.com', null), aluno('Diego Pacheco', 'diego@x.com')];

const card = (over: Partial<Intervencao>): Intervencao => ({
  id: 'c1', tipo: 'individual', titulo: 'Conversa sobre a queda no 5º simulado', nota: null, destino: { alunoIds: ['caio@x.com'] },
  perfil: null, status: 'afazer', origem: 'agenda_liberada', referenciaId: null, criadaEm: '2026-09-29T15:00:00Z',
  historico: [{ em: '2026-09-29T15:00:00Z', texto: 'Intervenção criada' }], comentarios: [], ...over,
});
const CARDS_B2C: Intervencao[] = [
  card({}),
  card({ id: 'c2', tipo: 'coletiva', titulo: 'Vigilância em saúde: 44% de acerto da turma', destino: { turmaToda: true, alunoIds: ['caio@x.com', 'marina@x.com'] }, origem: 'tema_critico', criadaEm: '2026-09-30T15:00:00Z' }),
  card({ id: 'c3', tipo: 'mensagem', titulo: 'Chamar no WhatsApp os que sumiram', destino: { alunoIds: ['caio@x.com', 'marina@x.com'] }, origem: 'manual', criadaEm: '2026-09-30T16:00:00Z' }),
  card({ id: 'c4', tipo: 'individual', titulo: 'Entender por que sumiu', nota: 'Mandei áudio; respondeu que está em prova da faculdade.', destino: { alunoIds: ['marina@x.com'] }, origem: 'manual', status: 'andamento', criadaEm: '2026-09-26T15:00:00Z' }),
  card({ id: 'c5', tipo: 'individual', titulo: 'Replanejar meta: USP-SP x SUS-SP', destino: { alunoIds: ['diego@x.com'] }, status: 'feito', criadaEm: '2026-09-19T15:00:00Z' }),
];
const CARDS_B2B: Intervencao[] = [
  card({ id: 'b1', titulo: 'Plano para o 5º simulado', perfil: 'virada', origem: 'manual', criadaEm: '2026-10-14T15:00:00Z' }),
  card({ id: 'b2', tipo: 'mensagem', titulo: 'Sinalizar à coordenação: sem acesso há 19 dias', destino: { alunoIds: ['marina@x.com'] }, perfil: 'muito_baixo', origem: 'manual', criadaEm: '2026-10-10T15:00:00Z' }),
  card({ id: 'b3', tipo: 'coletiva', titulo: 'Pós-simulado 08/10: 20 mais erradas', destino: { turmaToda: true, alunoIds: [] }, origem: 'sessao_criada', status: 'feito', criadaEm: '2026-10-08T15:00:00Z' }),
];

// ─── Mocks dos hooks ────────────────────────────────────────────────────────

type Q = { data?: QuadroIntervencoes; isPending?: boolean; isError?: boolean; error?: unknown };
let quadro: (p: PeriodoIntervencoes) => Q;
const refetch = vi.fn();
const criar = vi.fn();
const atualizar = vi.fn();
const comentar = vi.fn();
const registrar = vi.fn();
const mutacao = (fn: ReturnType<typeof vi.fn>, extra = {}) => ({ mutate: fn, isPending: false, reset: vi.fn(), ...extra });
const sucesso = (fn: ReturnType<typeof vi.fn>) => fn.mockImplementation((_v: unknown, o?: { onSuccess?: (r: unknown) => void }) => o?.onSuccess?.({ id: 'novo' }));

function mockMe(modalidade: 'b2c' | 'b2b' = 'b2c') {
  vi.mocked(useMe).mockReturnValue({ data: me(modalidade), isPending: false, isError: false } as unknown as ReturnType<typeof useMe>);
}
function ok(cards: Intervencao[], realizadas = 9): Q {
  return { data: { cards, planejadas: cards.length, realizadas }, isPending: false, isError: false };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00-03:00'));
  mockMe();
  quadro = () => ok(CARDS_B2C);
  vi.mocked(useIntervencoes).mockImplementation(((p: PeriodoIntervencoes = { de: null, ate: null }) => ({ refetch, isFetching: false, ...quadro(p) })) as never);
  vi.mocked(useAlunos).mockReturnValue({ data: ALUNOS, isPending: false, isError: false } as unknown as ReturnType<typeof useAlunos>);
  vi.mocked(useCanais).mockReturnValue({ data: [{ tipo: 'grupo_turma', url: 'https://chat.whatsapp.com/abc', editavel: true, configurado: true }], isPending: false, isError: false } as unknown as ReturnType<typeof useCanais>);
  [criar, atualizar, comentar, registrar, refetch].forEach((f) => f.mockReset());
  sucesso(criar); sucesso(atualizar); sucesso(comentar); sucesso(registrar);
  vi.mocked(useCriarIntervencao).mockReturnValue(mutacao(criar) as never);
  vi.mocked(useAtualizarIntervencao).mockReturnValue(mutacao(atualizar) as never);
  vi.mocked(useComentarIntervencao).mockReturnValue(mutacao(comentar) as never);
  vi.mocked(useRegistrarEvento).mockReturnValue(mutacao(registrar) as never);
});
afterEach(() => vi.useRealTimers());

function Local() {
  const l = useLocation();
  return <output data-testid="url">{l.pathname + l.search}</output>;
}
function renderTela(path = '/mentor/intervencoes') {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={[path]}><Intervencoes /><Local /></MemoryRouter>);
  return user;
}
const coluna = (nome: string) => screen.getByRole('region', { name: new RegExp(`^${nome}`) });
const periodosChamados = () => vi.mocked(useIntervencoes).mock.calls.map((c) => c[0]);

// ─── Testes ─────────────────────────────────────────────────────────────────

describe('Intervenções · kanban B2C', () => {
  it('renderiza cabeçalho, período, filtros de tipo, medidor e 3 colunas', () => {
    renderTela();
    expect(screen.getByRole('heading', { level: 1, name: 'Intervenções' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova intervenção' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Quinzena' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('01/10 a 15/10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos os tipos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Coletiva' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('medidor')).toHaveTextContent('9 de 15 intervenções planejadas realizadas em outubro');
    expect(screen.getByTestId('medidor')).toHaveTextContent('faltam 6 até 31/10');
    const barra = screen.getByRole('progressbar', { name: /Meta do mês/ });
    expect(barra).toHaveAttribute('aria-valuenow', '9');
    expect(barra).toHaveAttribute('aria-valuemax', '15');
    expect(within(coluna('A fazer')).getAllByRole('button', { name: /Abrir intervenção/ })).toHaveLength(3);
    expect(within(coluna('Em andamento')).getAllByRole('button', { name: /Abrir intervenção/ })).toHaveLength(1);
    expect(within(coluna('Feito')).getAllByRole('button', { name: /Abrir intervenção/ })).toHaveLength(1);
    expect(within(coluna('A fazer')).getByText('3')).toBeInTheDocument();
  });

  it('card mostra tipo (ícone + texto neutro), data, título, para quem e origem', () => {
    renderTela();
    const c1 = screen.getByRole('button', { name: /Conversa sobre a queda no 5º simulado/ });
    expect(c1).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(c1).getByText('Reunião individual')).toBeInTheDocument();
    expect(within(c1).getByText('29/09')).toBeInTheDocument();
    expect(within(c1).getByText('Caio Menezes')).toBeInTheDocument();
    expect(within(c1).getByText('Auto · agenda liberada')).toBeInTheDocument();
    const c2 = screen.getByRole('button', { name: /Vigilância em saúde/ });
    expect(within(c2).getByText('Reunião coletiva')).toBeInTheDocument();
    expect(within(c2).getByText('Turma toda')).toBeInTheDocument();
    expect(within(c2).getByText('Auto · tema crítico')).toBeInTheDocument();
    const c3 = screen.getByRole('button', { name: /Chamar no WhatsApp/ });
    expect(within(c3).getByText('2 alunos')).toBeInTheDocument();
    expect(within(c3).getByText('Manual')).toBeInTheDocument();
    const c4 = screen.getByRole('button', { name: /Entender por que sumiu/ });
    expect(within(c4).getByText(/Mandei áudio/)).toBeInTheDocument();
  });

  it('consulta o quadro pelo período e o medidor pelo mês', async () => {
    const user = renderTela();
    expect(periodosChamados()).toContainEqual({ de: '2026-10-01', ate: '2026-10-15' });
    expect(periodosChamados()).toContainEqual({ de: '2026-10-01', ate: '2026-10-31' });
    await user.click(screen.getByRole('tab', { name: 'Esta semana' }));
    expect(screen.getByText('12/10 a 18/10')).toBeInTheDocument();
    expect(periodosChamados()).toContainEqual({ de: '2026-10-12', ate: '2026-10-18' });
    await user.click(screen.getByRole('tab', { name: 'Mês' }));
    expect(screen.getByText('outubro')).toBeInTheDocument();
  });

  it('intervalo de datas valida a ordem e só consulta quando válido', async () => {
    const user = renderTela();
    await user.click(screen.getByRole('tab', { name: 'Intervalo' }));
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-09' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-02' } });
    expect(screen.getByText('A data inicial precisa ser anterior à final.')).toBeInTheDocument();
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true');
    expect(periodosChamados()).not.toContainEqual({ de: '2026-10-09', ate: '2026-10-02' });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-12' } });
    expect(screen.queryByText('A data inicial precisa ser anterior à final.')).not.toBeInTheDocument();
    expect(periodosChamados()).toContainEqual({ de: '2026-10-09', ate: '2026-10-12' });
  });

  it('filtro de tipo e vazio com "Limpar filtro"', async () => {
    quadro = () => ok(CARDS_B2C.filter((c) => c.tipo !== 'mensagem'));
    const user = renderTela();
    await user.click(screen.getByRole('button', { name: 'Coletiva' }));
    expect(screen.getByRole('button', { name: 'Coletiva' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /Abrir intervenção/ })).toHaveLength(1);
    expect(within(coluna('Em andamento')).getByText('Nada aqui neste período.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mensagem' }));
    expect(screen.getByText('Nenhuma intervenção com este filtro.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar filtro' }));
    expect(screen.getByRole('button', { name: 'Todos os tipos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /Abrir intervenção/ })).toHaveLength(4);
  });

  it('carregando: skeletons e título/ações visíveis', () => {
    quadro = () => ({ isPending: true, isError: false });
    renderTela();
    expect(screen.getByRole('heading', { name: 'Intervenções' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova intervenção' })).toBeInTheDocument();
    expect(screen.getAllByRole('status', { name: /Carregando/ }).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('medidor')).not.toBeInTheDocument();
  });

  it('erro: EstadoErro com "Tentar novamente" e o medidor nunca vira zero', async () => {
    quadro = () => ({ isPending: false, isError: true, error: new ErroFonte(500, 'rede', 'x') });
    const user = renderTela();
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/0 de 15/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Tentar novamente' })[0]);
    expect(refetch).toHaveBeenCalled();
  });

  it('período sem intervenções mostra o vazio', () => {
    quadro = () => ok([], 0);
    renderTela();
    expect(screen.getByText('Nenhuma intervenção neste período.')).toBeInTheDocument();
    expect(screen.getByTestId('medidor')).toHaveTextContent('0 de 15');
    expect(screen.getByTestId('medidor')).toHaveTextContent('faltam 15 até 31/10');
  });

  it('nome ausente cai para o e-mail; destino vazio mostra "—"', () => {
    quadro = () => ok([card({ destino: { alunoIds: ['sem@nome.com'] } }), card({ id: 'z', titulo: 'Sem destino', destino: {} })]);
    renderTela();
    expect(screen.getByText('sem@nome.com')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Sem destino/ })).getByText('—')).toBeInTheDocument();
  });
});

describe('Intervenções · nova intervenção', () => {
  it('abre o formulário no topo de A fazer, valida "para quem" e cria com o aluno escolhido', async () => {
    const user = renderTela();
    await user.click(screen.getByRole('button', { name: 'Coletiva' }));
    await user.click(screen.getByRole('button', { name: 'Nova intervenção' }));
    // abrir o criador volta o filtro para "Todos os tipos" (protótipo).
    expect(screen.getByRole('button', { name: 'Todos os tipos' })).toHaveAttribute('aria-pressed', 'true');
    const form = within(coluna('A fazer')).getByRole('form', { name: 'Nova intervenção' });
    const para = within(form).getByRole('combobox', { name: 'Para quem' });
    expect(para).toHaveFocus();
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }));
    expect(within(form).getByText('Diga para quem é a intervenção.')).toBeInTheDocument();
    expect(para).toHaveAttribute('aria-invalid', 'true');
    expect(criar).not.toHaveBeenCalled();
    await user.type(para, 'cai');
    await user.click(screen.getByRole('option', { name: 'Caio Menezes' }));
    expect(within(form).queryByText('Diga para quem é a intervenção.')).not.toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Remover Caio Menezes' })).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }));
    expect(criar).toHaveBeenCalledWith(
      { tipo: 'individual', titulo: 'Reunião individual com Caio Menezes', nota: null, destino: { alunoIds: ['caio@x.com'] } },
      expect.anything(),
    );
    expect(screen.getByText('Intervenção adicionada em A fazer').closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('form', { name: 'Nova intervenção' })).not.toBeInTheDocument();
  });

  it('turma toda, tipo e descrição viram o card', async () => {
    const user = renderTela();
    await user.click(screen.getByRole('button', { name: 'Nova intervenção' }));
    const form = screen.getByRole('form', { name: 'Nova intervenção' });
    await user.click(within(form).getByRole('button', { name: 'Coletiva' }));
    expect(within(form).getByRole('button', { name: 'Coletiva' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(form).getByRole('combobox', { name: 'Para quem' }));
    await user.click(screen.getByRole('option', { name: 'Turma toda' }));
    await user.type(within(form).getByRole('textbox', { name: 'Descrição' }), 'Revisar Preventiva');
    await user.click(within(form).getByRole('button', { name: 'Adicionar' }));
    expect(criar).toHaveBeenCalledWith(
      { tipo: 'coletiva', titulo: 'Revisar Preventiva', nota: null, destino: { turmaToda: true } }, expect.anything(),
    );
  });

  it('teclado no seletor: setas + Enter escolhem; Backspace remove; Cancelar fecha', async () => {
    const user = renderTela();
    await user.click(screen.getByRole('button', { name: 'Nova intervenção' }));
    const para = screen.getByRole('combobox', { name: 'Para quem' });
    await user.type(para, 'ma');
    expect(para).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('button', { name: 'Remover Marina Albuquerque' })).toBeInTheDocument();
    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Remover Marina Albuquerque' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Nova intervenção' })).not.toBeInTheDocument();
  });

  it('erro da fonte aparece inline via mensagemErro', async () => {
    criar.mockImplementation((_v: unknown, o?: { onError?: (e: unknown) => void }) => o?.onError?.(new ErroFonte(400, 'aluno_fora_da_tribo', 'x')));
    const user = renderTela();
    await user.click(screen.getByRole('button', { name: 'Nova intervenção' }));
    await user.type(screen.getByRole('combobox', { name: 'Para quem' }), 'caio');
    await user.click(screen.getByRole('option', { name: 'Caio Menezes' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Um dos alunos não está mais na turma. Atualize a lista.');
    expect(screen.getByRole('form', { name: 'Nova intervenção' })).toBeInTheDocument();
  });

  it('deep link ?novo=1&aluno= abre o criador com o aluno e limpa a URL ao criar', async () => {
    const user = renderTela('/mentor/intervencoes?novo=1&aluno=caio%40x.com');
    expect(screen.getByRole('form', { name: 'Nova intervenção' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Caio Menezes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(criar).toHaveBeenCalled();
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/mentor\/intervencoes$/);
  });
});

describe('Intervenções · drawer do card', () => {
  it('abre pelo card, guarda ?card= na URL, muda status e fecha devolvendo o foco', async () => {
    const user = renderTela();
    const gatilho = screen.getByRole('button', { name: /Conversa sobre a queda/ });
    await user.click(gatilho);
    expect(screen.getByTestId('url')).toHaveTextContent('/mentor/intervencoes?card=c1');
    const drawer = screen.getByRole('dialog', { name: 'Conversa sobre a queda no 5º simulado' });
    expect(within(drawer).getByText('Reunião individual · Auto · agenda liberada')).toBeInTheDocument();
    expect(within(drawer).getByText('Caio Menezes')).toBeInTheDocument();
    const status = within(drawer).getByRole('group', { name: 'Status' });
    expect(within(status).getByRole('button', { name: 'A fazer' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(status).getByRole('button', { name: 'Em andamento' }));
    expect(atualizar).toHaveBeenCalledWith({ id: 'c1', status: 'andamento' }, expect.anything());
    expect(within(drawer).getByRole('status')).toHaveTextContent('Intervenção movida para Em andamento');
    await user.click(within(status).getByRole('button', { name: 'A fazer' }));
    expect(atualizar).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/mentor\/intervencoes$/);
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it('histórico mostra criação, mudanças de status e comentários; comentar grava', async () => {
    quadro = () => ok([card({
      historico: [
        { em: '2026-09-29T15:00:00Z', texto: 'Intervenção criada' },
        { em: '2026-10-01T15:00:00Z', texto: 'Status alterado para Em andamento' },
      ],
      comentarios: [{ em: '2026-10-02T15:00:00Z', texto: 'Mandei áudio' }],
    })]);
    const user = renderTela('/mentor/intervencoes?card=c1');
    const drawer = screen.getByRole('dialog');
    const hist = within(drawer).getByRole('list', { name: 'Histórico' });
    expect(within(hist).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Criada · Auto · agenda liberada29/09', 'Status → Em andamento01/10', 'Comentário: Mandei áudio02/10',
    ]);
    const comentar = within(drawer).getByRole('button', { name: 'Comentar' });
    expect(comentar).toBeDisabled();
    await user.type(within(drawer).getByRole('textbox', { name: 'Escrever comentário' }), 'Retomar 06/10');
    await user.click(comentar);
    expect(vi.mocked(useComentarIntervencao)().mutate).toHaveBeenCalledWith({ id: 'c1', texto: 'Retomar 06/10' }, expect.anything());
    expect(within(drawer).getByRole('textbox', { name: 'Escrever comentário' })).toHaveValue('');
  });

  it('WhatsApp do aluno registra no log; mensagem no mural leva o destinatário', async () => {
    const user = renderTela('/mentor/intervencoes?card=c1');
    const drawer = screen.getByRole('dialog');
    const zap = within(drawer).getByRole('link', { name: 'WhatsApp' });
    expect(zap).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/5511988887777/));
    expect(zap).toHaveAttribute('target', '_blank');
    await user.click(zap);
    expect(registrar).toHaveBeenCalledWith({ tipo: 'whatsapp_aberto', alunoId: 'caio@x.com' }, expect.anything());
    expect(within(drawer).getByRole('link', { name: 'Mensagem no mural' })).toHaveAttribute('href', '/mentor/mural?para=caio%40x.com');
  });

  it('turma toda usa o grupo da tribo; aluno sem WhatsApp fica indisponível', async () => {
    const user = renderTela('/mentor/intervencoes?card=c2');
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://chat.whatsapp.com/abc');
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Mensagem no mural' })).toHaveAttribute('href', '/mentor/mural');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Entender por que sumiu/ }));
    const zap = within(screen.getByRole('dialog')).getByRole('button', { name: 'WhatsApp' });
    expect(zap).toBeDisabled();
    expect(zap).toHaveAccessibleDescription('Aluno sem WhatsApp cadastrado.');
  });

  it('erro ao mudar status aparece no drawer', async () => {
    atualizar.mockImplementation((_v: unknown, o?: { onError?: (e: unknown) => void }) => o?.onError?.(new ErroFonte(503, 'rede', 'x')));
    const user = renderTela('/mentor/intervencoes?card=c1');
    await user.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'Feito' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Não foi possível carregar agora. Tente novamente.');
  });

  it('card inexistente na URL é descartado', async () => {
    renderTela('/mentor/intervencoes?card=nao-existe');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(/^\/mentor\/intervencoes$/));
  });
});

describe('Intervenções · B2B', () => {
  beforeEach(() => {
    mockMe('b2b');
    quadro = () => ok(CARDS_B2B, 4);
  });

  it('filtro por perfil no lugar do tipo, tag de perfil e "Sessão coletiva"', async () => {
    const user = renderTela();
    expect(screen.queryByRole('button', { name: 'Todos os tipos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    ['Potencial de virada', 'Muito baixo', 'Muito bom'].forEach((n) => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    const b1 = screen.getByRole('article', { name: 'Plano para o 5º simulado' });
    expect(within(b1).getByText('Potencial de virada')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: /Pós-simulado/ })).getByText('Sessão coletiva')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Muito baixo' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(within(screen.getByRole('article')).getByText('Desempenho muito baixo')).toBeInTheDocument();
  });

  it('move entre colunas pelos botões do card', async () => {
    const user = renderTela();
    const b1 = screen.getByRole('article', { name: 'Plano para o 5º simulado' });
    expect(within(b1).queryByRole('button', { name: '→ A fazer' })).not.toBeInTheDocument();
    await user.click(within(b1).getByRole('button', { name: '→ Feito' }));
    expect(atualizar).toHaveBeenCalledWith({ id: 'b1', status: 'feito' }, expect.anything());
    expect(screen.getByText('Intervenção movida para Feito').closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
  });

  it('drawer B2B leva a mensagem para Canais', async () => {
    renderTela('/mentor/intervencoes?card=b2');
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('Desempenho muito baixo', { exact: false })).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Mensagem no mural' })).toHaveAttribute('href', '/mentor/canais?para=marina%40x.com');
  });
});

describe('Intervenções · acessibilidade e navegação', () => {
  it('quadro e drawer sem violações do axe', async () => {
    vi.useRealTimers();
    const { container } = render(<MemoryRouter initialEntries={['/mentor/intervencoes']}><Intervencoes /></MemoryRouter>);
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: /Conversa sobre a queda/ }));
    const drawer = await screen.findByRole('dialog');
    expect(await axe(drawer)).toHaveNoViolations();
  });

  it('setas movem entre as abas do período', async () => {
    const user = renderTela();
    screen.getByRole('tab', { name: 'Quinzena' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Mês' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Mês' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Quinzena' })).toHaveAttribute('tabindex', '-1');
  });

  it('card aberto fora do período é buscado no quadro completo', () => {
    quadro = (p) => (p.de === null ? ok([card({ id: 'antigo', titulo: 'Card de agosto', criadaEm: '2026-08-10T15:00:00Z' })]) : ok([], 0));
    renderTela('/mentor/intervencoes?card=antigo');
    expect(screen.getByRole('dialog', { name: 'Card de agosto' })).toBeInTheDocument();
  });
});

describe('toast', () => {
  it('some depois de 3,2 s', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00-03:00'));
    renderTela('/mentor/intervencoes');
    fireEvent.click(screen.getByRole('button', { name: 'Nova intervenção' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Para quem' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Turma toda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByText('Intervenção adicionada em A fazer')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3300); });
    expect(screen.queryByText('Intervenção adicionada em A fazer')).not.toBeInTheDocument();
  });
});
