import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const listarSessoes = vi.fn();
const salvarSessao = vi.fn();
const marcarSessaoFeita = vi.fn();
const definirLinkAgendamento = vi.fn();
const liberarAgenda = vi.fn();
const desligarAgenda = vi.fn();
vi.mock('@/services/mentor/sessoes', () => ({
  listarSessoes: (...a: unknown[]) => listarSessoes(...a),
  salvarSessao: (...a: unknown[]) => salvarSessao(...a),
  marcarSessaoFeita: (...a: unknown[]) => marcarSessaoFeita(...a),
  definirLinkAgendamento: (...a: unknown[]) => definirLinkAgendamento(...a),
  liberarAgenda: (...a: unknown[]) => liberarAgenda(...a),
  desligarAgenda: (...a: unknown[]) => desligarAgenda(...a),
}));

const fetchTurma = vi.fn();
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: () => fetchTurma() }));

const listarLiberacoesLigadas = vi.fn();
const fetchLinkAgendamento = vi.fn();
vi.mock('@/services/mentor/agenda', () => ({
  listarLiberacoesLigadas: (...a: unknown[]) => listarLiberacoesLigadas(...a),
  fetchLinkAgendamento: (...a: unknown[]) => fetchLinkAgendamento(...a),
}));

const fetchMentorContexto = vi.fn();
vi.mock('@/services/mentor/contexto', () => ({ fetchMentorContexto: () => fetchMentorContexto() }));

import Sessoes from '@/features/mentor/routes/Sessoes';

const T = { timeout: 3000 };

const alunos = [
  { email: 'ana@x.com', nome: 'Ana Lima', telefone: null, semestre: 6, acesso_ate: null, b2b: false, academy_user_id: null, sanarflix_user_id: null, ultima_atividade: null, dias_sem_atividade: null, segmento: 'ativo' },
  { email: 'bia@x.com', nome: 'Bia Costa', telefone: null, semestre: 6, acesso_ate: null, b2b: false, academy_user_id: null, sanarflix_user_id: null, ultima_atividade: null, dias_sem_atividade: null, segmento: 'sumido' },
];

const sessaoAgendada = {
  id: 's1',
  tipo: 'coletiva',
  titulo: 'Revisão de cardio',
  tema: 'Revisão de cardio',
  inicio: '2026-10-20T20:00:00Z',
  duracao_min: 60,
  meet_link: null,
  gravacao_url: null,
  aluno_email: null,
  status: 'agendada',
  realizada_em: null,
  origem: 'academy',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mentor/sessoes']}>
        <Sessoes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

describe('Sessoes', () => {
  beforeEach(() => {
    [listarSessoes, salvarSessao, marcarSessaoFeita, definirLinkAgendamento, liberarAgenda, desligarAgenda, fetchTurma, listarLiberacoesLigadas, fetchLinkAgendamento, fetchMentorContexto].forEach((m) => m.mockReset());
    listarSessoes.mockResolvedValue([sessaoAgendada]);
    fetchTurma.mockResolvedValue(alunos);
    listarLiberacoesLigadas.mockResolvedValue([]);
    fetchLinkAgendamento.mockResolvedValue(null);
    fetchMentorContexto.mockResolvedValue({ mentor: { user_id: 'm1', nome: 'Mentor' }, alunos_ativos: 2 });
    salvarSessao.mockResolvedValue({ sessao_id: 's2', intervencao_id: null, post_id: null });
    marcarSessaoFeita.mockResolvedValue({ sessao_id: 's1' });
    definirLinkAgendamento.mockResolvedValue({ link_agendamento: 'https://calendar.app.google/x' });
    liberarAgenda.mockResolvedValue({ liberados: 1, intervencoes: 1 });
    desligarAgenda.mockResolvedValue({ desligados: 2 });
  });

  it('mostra a agenda em horário de São Paulo e "Falta link" na coletiva sem link', async () => {
    renderPage();
    expect(await screen.findByText('Revisão de cardio', undefined, T)).toBeInTheDocument();
    expect(screen.getByText('20/10/2026 17:00')).toBeInTheDocument();
    expect(screen.getByText('Falta link')).toBeInTheDocument();
    expect(listarSessoes).toHaveBeenCalledWith('todas');
  });

  it('mostra estado vazio e erro com "Tentar de novo"', async () => {
    listarSessoes.mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    expect(await screen.findByText(/Nenhuma sessão agendada/, undefined, T)).toBeInTheDocument();
    unmount();
    listarSessoes.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/Não foi possível carregar as sessões/, undefined, T)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('trocar para Realizadas consulta realizadas e arquivo 2025 fica sem ações', async () => {
    listarSessoes.mockResolvedValue([
      sessaoAgendada,
      { ...sessaoAgendada, id: 'a1', titulo: 'Mentoria geral 2025', tema: 'Mentoria geral 2025', status: 'realizada', origem: 'arquivo_2025', gravacao_url: 'https://rec.example/1' },
    ]);
    renderPage();
    await screen.findByText('Revisão de cardio', undefined, T);
    fireEvent.click(screen.getByRole('button', { name: 'Realizadas' }));
    expect(await screen.findByText('Mentoria geral 2025', undefined, T)).toBeInTheDocument();
    expect(screen.queryByText('Revisão de cardio')).not.toBeInTheDocument();
    expect(screen.getByText('Arquivo 2025')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver gravação' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar feita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('"Marcar feita" chama marcarSessaoFeita com a gravação', async () => {
    renderPage();
    await screen.findByText('Revisão de cardio', undefined, T);
    fireEvent.change(screen.getByLabelText(/Link da gravação/), { target: { value: 'https://rec.example/9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar feita' }));
    await waitFor(() => expect(marcarSessaoFeita).toHaveBeenCalledWith('s1', 'https://rec.example/9'), T);
  });

  it('sessão individual exige aluno; com aluno chama salvarSessao', async () => {
    renderPage();
    await screen.findByText('Revisão de cardio', undefined, T);
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    fireEvent.change(within(form).getByLabelText('Tipo da sessão'), { target: { value: 'individual' } });
    fireEvent.change(within(form).getByLabelText('Tema'), { target: { value: 'Plano de estudo' } });
    fireEvent.change(within(form).getByLabelText('Data e horário'), { target: { value: '2026-10-22T14:30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }));
    expect(await within(form).findByText(/Escolha o aluno/)).toBeInTheDocument();
    expect(salvarSessao).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByLabelText('Aluno'), { target: { value: 'ana@x.com' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }));
    await waitFor(() => expect(salvarSessao).toHaveBeenCalled(), T);
    expect(salvarSessao.mock.calls[0][0]).toMatchObject({
      tipo: 'individual',
      titulo: 'Plano de estudo',
      alunoEmail: 'ana@x.com',
      inicio: '2026-10-22T17:30:00.000Z',
    });
  });

  it('criar sessão coletiva invalida o mural (a RPC cria um post), mas não o contexto', async () => {
    const { client } = renderPage();
    client.setQueryData(['mentor', 'mural', 'posts', '', ''], []);
    await screen.findByText('Revisão de cardio', undefined, T);
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    fireEvent.change(within(form).getByLabelText('Tema'), { target: { value: 'Revisão de nefro' } });
    fireEvent.change(within(form).getByLabelText('Data e horário'), { target: { value: '2026-10-22T14:30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar sessão' }));
    await waitFor(() => expect(salvarSessao).toHaveBeenCalled(), T);
    await waitFor(() => expect(client.getQueryState(['mentor', 'mural', 'posts', '', ''])?.isInvalidated).toBe(true), T);
    expect(client.getQueryState(['mentor', 'contexto'])?.isInvalidated).toBe(false);
  });

  it('salvar o link do Google Agenda refaz a busca do link-agendamento do mentor', async () => {
    renderPage();
    await screen.findByLabelText('Selecionar Ana Lima', undefined, T);
    await waitFor(() => expect(fetchLinkAgendamento).toHaveBeenCalledTimes(1), T);
    fireEvent.change(screen.getByLabelText('Link do seu Google Agenda'), { target: { value: 'https://calendar.app.google/novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    await waitFor(() => expect(definirLinkAgendamento).toHaveBeenCalled(), T);
    await waitFor(() => expect(fetchLinkAgendamento.mock.calls.length).toBeGreaterThan(1), T);
  });

  it('avisa com "Tentar de novo" quando o contexto do mentor falha e o painel de liberação some', async () => {
    fetchMentorContexto.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/liberação de sessão individual está indisponível/, undefined, T)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Liberar sessão individual' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tentar de novo' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: 'Liberar sessão individual' }, T)).toBeInTheDocument();
    expect(screen.queryByText(/está indisponível/)).not.toBeInTheDocument();
  });

  it('liberar sem link do Google Agenda mostra o aviso e não chama a RPC', async () => {
    renderPage();
    await screen.findByLabelText('Selecionar Ana Lima', undefined, T);
    fireEvent.click(screen.getByLabelText('Selecionar Ana Lima'));
    fireEvent.change(screen.getByLabelText('Mensagem para o aluno'), { target: { value: 'Vamos conversar' } });
    fireEvent.click(screen.getByRole('button', { name: /Liberar para 1 aluno/ }));
    expect(await screen.findByText(/Cadastre o link do seu Google Agenda/)).toBeInTheDocument();
    expect(liberarAgenda).not.toHaveBeenCalled();
    expect(definirLinkAgendamento).not.toHaveBeenCalled();
  });

  it('liberar sem mensagem não chama a RPC', async () => {
    renderPage();
    await screen.findByLabelText('Selecionar Ana Lima', undefined, T);
    fireEvent.change(screen.getByLabelText('Link do seu Google Agenda'), { target: { value: 'https://calendar.app.google/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    expect(await screen.findByText('Link salvo', undefined, T)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Selecionar Ana Lima'));
    fireEvent.click(screen.getByRole('button', { name: /Liberar para 1 aluno/ }));
    expect(await screen.findByText(/Sem mensagem não libera/)).toBeInTheDocument();
    expect(liberarAgenda).not.toHaveBeenCalled();
  });

  it('link do Agenda só aceita https', async () => {
    renderPage();
    await screen.findByLabelText('Link do seu Google Agenda', undefined, T);
    fireEvent.change(screen.getByLabelText('Link do seu Google Agenda'), { target: { value: 'http://inseguro.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    expect(await screen.findByText(/link https válido/)).toBeInTheDocument();
    expect(definirLinkAgendamento).not.toHaveBeenCalled();
  });

  it('com link salvo e mensagem, libera para os selecionados', async () => {
    renderPage();
    await screen.findByLabelText('Selecionar Ana Lima', undefined, T);
    fireEvent.change(screen.getByLabelText('Link do seu Google Agenda'), { target: { value: 'https://calendar.app.google/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    await screen.findByText('Link salvo', undefined, T);
    fireEvent.click(screen.getByLabelText('Selecionar Ana Lima'));
    fireEvent.click(screen.getByLabelText('Selecionar Bia Costa'));
    fireEvent.change(screen.getByLabelText('Mensagem para o aluno'), { target: { value: 'Vamos conversar' } });
    fireEvent.click(screen.getByRole('button', { name: /Liberar para 2 alunos/ }));
    await waitFor(() => expect(liberarAgenda).toHaveBeenCalledWith(['ana@x.com', 'bia@x.com'], 'Vamos conversar'), T);
  });

  it('lista "Liberada para N alunos"; toggle desliga um e "Desligar todos" chama desligarAgenda(null)', async () => {
    listarLiberacoesLigadas.mockResolvedValue([
      { id: 'l1', aluno_email: 'ana@x.com', mensagem: 'Oi Ana', desde: '2026-10-10T12:00:00Z' },
      { id: 'l2', aluno_email: 'bia@x.com', mensagem: 'Oi Bia', desde: '2026-10-11T12:00:00Z' },
    ]);
    renderPage();
    expect(await screen.findByText('Liberada para 2 alunos', undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Oi Ana')).toBeInTheDocument();
    expect(screen.getByText('10/10/2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Agenda liberada para Ana Lima' }));
    await waitFor(() => expect(desligarAgenda).toHaveBeenCalledWith(['ana@x.com']), T);

    fireEvent.click(screen.getByRole('button', { name: 'Desligar todos' }));
    expect(desligarAgenda).not.toHaveBeenCalledWith(null);
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, desligar todos' }));
    await waitFor(() => expect(desligarAgenda).toHaveBeenCalledWith(null), T);
    expect(await screen.findByRole('status', undefined, T)).toHaveTextContent('Agenda desligada para 2 alunos');
  });

  it('sessão agendada que já passou continua em Próximas, marcada como pendente, com Marcar feita', async () => {
    listarSessoes.mockResolvedValue([
      { ...sessaoAgendada, id: 'p2', titulo: 'Sessão futura', tema: 'Sessão futura', inicio: '2099-01-01T12:00:00Z' },
      { ...sessaoAgendada, id: 'p1', titulo: 'Sessão de ontem', tema: 'Sessão de ontem', inicio: '2020-01-01T12:00:00Z' },
    ]);
    renderPage();
    expect(await screen.findByText('Sessão de ontem', undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Pendente · marque como feita')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Marcar feita' })).toHaveLength(2);
    const linhas = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    expect(linhas.findIndex((t) => t.includes('Sessão de ontem'))).toBeLessThan(linhas.findIndex((t) => t.includes('Sessão futura')));
  });

  it('não renderiza href com javascript: nem outros esquemas', async () => {
    listarSessoes.mockResolvedValue([
      { ...sessaoAgendada, id: 'x1', meet_link: 'javascript:alert(1)' },
      { ...sessaoAgendada, id: 'x2', titulo: 'Gravada', tema: 'Gravada', status: 'realizada', gravacao_url: 'data:text/html,<b>x</b>' },
    ]);
    renderPage();
    await screen.findByText('Revisão de cardio', undefined, T);
    expect(screen.getByText('link inválido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Realizadas' }));
    expect(await screen.findByText('Gravada', undefined, T)).toBeInTheDocument();
    expect(screen.getByText('link inválido')).toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript:"], a[href^="data:"]')).toBeNull();
  });

  it('pré-preenche o link do Agenda cadastrado e só chama definirLinkAgendamento quando muda', async () => {
    fetchLinkAgendamento.mockResolvedValue('https://calendar.app.google/antigo');
    renderPage();
    const campo = await screen.findByDisplayValue('https://calendar.app.google/antigo', undefined, T);
    expect(fetchLinkAgendamento).toHaveBeenCalledWith('m1');
    await screen.findByLabelText('Selecionar Ana Lima', undefined, T);

    fireEvent.click(screen.getByLabelText('Selecionar Ana Lima'));
    fireEvent.change(screen.getByLabelText('Mensagem para o aluno'), { target: { value: 'Oi' } });
    fireEvent.click(screen.getByRole('button', { name: /Liberar para 1 aluno/ }));
    await waitFor(() => expect(liberarAgenda).toHaveBeenCalledWith(['ana@x.com'], 'Oi'), T);
    expect(definirLinkAgendamento).not.toHaveBeenCalled();
    expect(await screen.findByText(/Agenda liberada para 1 aluno/, undefined, T)).toHaveAttribute('role', 'status');

    fireEvent.change(campo, { target: { value: 'https://calendar.app.google/novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar link' }));
    await waitFor(() => expect(definirLinkAgendamento).toHaveBeenCalledWith('https://calendar.app.google/novo'), T);
  });

  it('erro ao liberar limpa a mensagem de sucesso anterior', async () => {
    fetchLinkAgendamento.mockResolvedValue('https://calendar.app.google/x');
    renderPage();
    await screen.findByDisplayValue('https://calendar.app.google/x', undefined, T);
    await screen.findByLabelText('Selecionar Ana Lima', undefined, T);
    fireEvent.click(screen.getByLabelText('Selecionar Ana Lima'));
    fireEvent.change(screen.getByLabelText('Mensagem para o aluno'), { target: { value: 'Oi' } });
    fireEvent.click(screen.getByRole('button', { name: /Liberar para 1 aluno/ }));
    await screen.findByText(/Agenda liberada para 1 aluno/, undefined, T);
    liberarAgenda.mockRejectedValueOnce(new Error('falhou geral'));
    fireEvent.click(screen.getByLabelText('Selecionar Bia Costa'));
    fireEvent.change(screen.getByLabelText('Mensagem para o aluno'), { target: { value: 'Oi 2' } });
    fireEvent.click(screen.getByRole('button', { name: /Liberar para 1 aluno/ }));
    expect(await screen.findByText('falhou geral', undefined, T)).toBeInTheDocument();
    expect(screen.queryByText(/Agenda liberada para 1 aluno/)).not.toBeInTheDocument();
  });
});
