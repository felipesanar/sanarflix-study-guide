/**
 * Sessões B2C (Fase 6.3) sobre a fonte mock (dados do protótipo `Mentor B2C.dc.html`), com o relógio
 * fixado no "hoje" do protótipo (15/10/2026) para que "futura" e "realizada" batam com as capturas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { _definirConfigParaTestes, _resetarFontes, dadosAtivos, fonteAtiva } from '@/features/mentor/api/ativa';
import { ErroFonte } from '@/features/mentor/api/fonte';
import Sessoes from '@/features/mentor/routes/v2/Sessoes';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const HOJE = new Date('2026-10-15T12:00:00-03:00');

function Local() {
  const l = useLocation();
  return <output data-testid="url">{l.search}</output>;
}
function renderTela(caminho = '/mentor/sessoes') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const r = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes><Route path="/mentor/sessoes" element={<><Sessoes /><Local /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...r, user: userEvent.setup() };
}
const tabela = () => screen.findByRole('table', { name: 'Sessões' });
const linhas = async () => within(await tabela()).getAllByRole('row').slice(1);
const toast = () => screen.getByTestId('toast-sessoes');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HOJE);
  _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2c', latenciaMs: 0 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  _resetarFontes();
  _definirConfigParaTestes(null);
});

describe('Sessões B2C · dados', () => {
  it('lista as próximas em ordem cronológica, com tipo, quem, tema, link e ação pós-sessão', async () => {
    renderTela();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessões' })).toBeInTheDocument();
    const rows = await linhas();
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].querySelector('b')!.textContent)).toEqual(['Sex 16/10', 'Seg 19/10', 'Ter 20/10', 'Qui 12/11']);

    const [encontro, diego] = rows;
    expect(within(encontro).getByText('19h')).toBeInTheDocument();
    expect(within(encontro).getByText('Encontro da tribo')).toBeInTheDocument();
    expect(within(encontro).getByText('Tribo toda')).toBeInTheDocument();
    expect(within(encontro).getByText('Como estudar as últimas 6 semanas')).toBeInTheDocument();
    expect(within(encontro).getByText('Falta link')).toBeInTheDocument();
    expect(within(encontro).getByText('grava para o acervo')).toBeInTheDocument();
    expect(within(encontro).queryByRole('button', { name: /Marcar feita/ })).not.toBeInTheDocument();

    expect(within(diego).getByText('Individual')).toBeInTheDocument();
    expect(within(diego).getByText('Diego Pacheco')).toBeInTheDocument();
    expect(within(diego).getByText('agenda do mentor')).toBeInTheDocument();
    expect(within(diego).getByRole('button', { name: /Marcar feita/ })).toBeInTheDocument();

    const link = within(rows[3]).getByRole('link', { name: /meet\.google\.com\/kfx-qwbr-tpa/ });
    expect(link).toHaveAttribute('href', 'https://meet.google.com/kfx-qwbr-tpa');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    // Todas futuras e agendadas: todas podem ser excluídas.
    expect(screen.getAllByRole('button', { name: /Excluir sessão de/ })).toHaveLength(4);
  });

  it('realizadas: mais recente primeiro; coletiva no acervo e individual fora dele; sem excluir', async () => {
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('tab', { name: 'Realizadas' }));
    expect(screen.getByRole('tab', { name: 'Realizadas' })).toHaveAttribute('aria-selected', 'true');
    const rows = await linhas();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Qua 14/10')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Feita · não vai para o acervo')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Qui 17/09')).toBeInTheDocument();
    expect(within(rows[1]).getByText('No acervo de mentorias')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir sessão/ })).not.toBeInTheDocument();
  });

  it('sessão que já passou não pode ser excluída', async () => {
    vi.setSystemTime(new Date('2026-10-17T12:00:00-03:00'));
    renderTela();
    const rows = await linhas();
    expect(within(rows[0]).queryByRole('button', { name: /Excluir sessão/ })).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: /Excluir sessão/ })).toBeInTheDocument();
  });

  it('filtros por tipo com aria-pressed', async () => {
    const { user } = renderTela();
    await tabela();
    const ind = screen.getByRole('button', { name: 'Individuais' });
    await user.click(ind);
    expect(ind).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    expect((await linhas()).map((r) => within(r).getAllByRole('cell')[2].textContent)).toEqual(['Diego Pacheco', 'Caio Menezes']);
    await user.click(screen.getByRole('button', { name: 'Encontros da tribo' }));
    expect(await linhas()).toHaveLength(2);
  });

  it('deep link ?sessao= de uma realizada abre a aba Realizadas com a linha marcada', async () => {
    renderTela('/mentor/sessoes?sessao=mock-sessao-6');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Realizadas' })).toHaveAttribute('aria-selected', 'true'));
    expect(await screen.findByTestId('sessao-mock-sessao-6')).toHaveAttribute('data-selecionada', 'true');
  });
});

describe('Sessões B2C · estados', () => {
  it('carregando: skeleton na lista, título e "Nova sessão" visíveis', async () => {
    vi.spyOn(fonteAtiva(), 'sessoes').mockReturnValue(new Promise(() => {}));
    renderTela();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessões' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Carregando sessões' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova sessão/ })).toBeEnabled();
  });

  it('erro: EstadoErro com mensagem da fonte e "Tentar novamente" refaz só a lista', async () => {
    const fonte = fonteAtiva();
    const original = fonte.sessoes.bind(fonte);
    const spy = vi.spyOn(fonte, 'sessoes').mockRejectedValueOnce(new ErroFonte(503, 'rede', 'boom')).mockImplementation(original);
    const { user } = renderTela();
    expect(await screen.findByText('Não foi possível carregar agora. Tente novamente.')).toBeInTheDocument();
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
    // Agendas seguem utilizáveis com a lista em erro.
    expect(await screen.findByText('Diego Pacheco')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await tabela()).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('vazio sem filtro: só o texto; com filtro: "Limpar filtro" volta para Todas', async () => {
    const fonte = fonteAtiva();
    const todas = (await fonte.sessoes('x')).data;
    vi.spyOn(fonte, 'sessoes').mockResolvedValue({ data: todas.filter((s) => s.tipo === 'individual'), nextCursor: null });
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: 'Encontros da tribo' }));
    expect(screen.getByText('Nenhuma sessão neste filtro.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar filtro' }));
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(await linhas()).toHaveLength(2);
  });

  it('vazio total: sem ação de limpar', async () => {
    vi.spyOn(fonteAtiva(), 'sessoes').mockResolvedValue({ data: [], nextCursor: null });
    renderTela();
    expect(await screen.findByText('Nenhuma sessão neste filtro.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtro' })).not.toBeInTheDocument();
  });
});

describe('Sessões B2C · nova sessão', () => {
  it('abre inline com foco no tipo, valida tema e data com o texto do protótipo', async () => {
    const { user } = renderTela();
    await tabela();
    const nova = screen.getByRole('button', { name: /Nova sessão/ });
    await user.click(nova);
    expect(nova).toHaveAttribute('aria-expanded', 'true');
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    expect(within(form).getByRole('button', { name: 'Encontro da tribo' })).toHaveFocus();
    expect(within(form).getByText('Encontro da tribo avisa a turma no mural. Sem link, fica marcado "Falta link".')).toBeInTheDocument();
    expect(within(form).queryByRole('combobox', { name: 'Aluno' })).not.toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(within(form).getByText('Preencha data e tema.')).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: 'Tema' })).toHaveAttribute('aria-invalid', 'true');
    expect(within(form).getByRole('textbox', { name: 'Data' })).toHaveAttribute('aria-invalid', 'true');

    await user.click(within(form).getByRole('button', { name: 'Individual' }));
    expect(within(form).getByText('Individual entra no kanban como Reunião individual.')).toBeInTheDocument();
    expect(within(form).getByRole('combobox', { name: 'Aluno' })).toBeInTheDocument();
    expect(within(form).queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument();
    await user.type(within(form).getByRole('textbox', { name: 'Data' }), '29/10');
    await user.type(within(form).getByRole('textbox', { name: 'Tema' }), 'Plano');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(within(form).getByText('Escolha o aluno da sessão.')).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Nova sessão' })).not.toBeInTheDocument();
    await waitFor(() => expect(nova).toHaveFocus());
  });

  it('link inválido é recusado inline', async () => {
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: /Nova sessão/ }));
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    await user.type(within(form).getByRole('textbox', { name: 'Data' }), '29/10');
    await user.type(within(form).getByRole('textbox', { name: 'Tema' }), 'Revisão');
    await user.type(within(form).getByRole('textbox', { name: 'Link' }), 'javascript:alert(1)');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(within(form).getByText('Use um link https do Meet.')).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: 'Link' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('salva encontro sem link: aparece como "Falta link", toast e sessão na URL', async () => {
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: /Nova sessão/ }));
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    await user.type(within(form).getByRole('textbox', { name: 'Data' }), '29/10');
    await user.type(within(form).getByRole('textbox', { name: 'Hora' }), '19h30');
    await user.type(within(form).getByRole('textbox', { name: 'Tema' }), 'Revisão de Preventiva');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Encontro salvo · aviso publicado no mural da tribo'));
    expect(screen.queryByRole('form', { name: 'Nova sessão' })).not.toBeInTheDocument();
    const nova = (await linhas()).find((r) => r.textContent?.includes('Revisão de Preventiva'))!;
    expect(within(nova).getByText('Qui 29/10')).toBeInTheDocument();
    expect(within(nova).getByText('19h30')).toBeInTheDocument();
    expect(within(nova).getByText('Falta link')).toBeInTheDocument();
    expect(nova).toHaveAttribute('data-selecionada', 'true');
    expect(screen.getByTestId('url').textContent).toMatch(/sessao=mock-sessao-/);
  });

  it('salva individual com aluno: card "Reunião individual" em A fazer', async () => {
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: /Nova sessão/ }));
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    await user.click(within(form).getByRole('button', { name: 'Individual' }));
    await user.selectOptions(within(form).getByRole('combobox', { name: 'Aluno' }), 'Helena Queiroz');
    await user.type(within(form).getByRole('textbox', { name: 'Data' }), '27/10');
    await user.type(within(form).getByRole('textbox', { name: 'Tema' }), 'Metas de novembro');
    await user.click(within(form).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão salva · Reunião individual em A fazer'));
    const quadro = await dadosAtivos().intervencoes({ de: null, ate: null });
    expect(quadro.cards.some((c) => c.titulo === 'Metas de novembro' && c.status === 'afazer' && c.origem === 'sessao_criada')).toBe(true);
    const linha = (await linhas()).find((r) => r.textContent?.includes('Metas de novembro'))!;
    expect(within(linha).getByText('Helena Queiroz')).toBeInTheDocument();
  });
});

describe('Sessões B2C · ações da linha', () => {
  it('"Marcar feita" move a individual para Realizadas e o card para Feito', async () => {
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: 'Marcar feita a sessão com Diego Pacheco de Seg 19/10' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão com Diego Pacheco marcada como feita. Card movido para Feito.'));
    await waitFor(async () => expect((await linhas()).some((r) => r.textContent?.includes('Diego Pacheco'))).toBe(false));
    await user.click(screen.getByRole('tab', { name: 'Realizadas' }));
    const linha = (await linhas()).find((r) => r.textContent?.includes('Diego Pacheco'))!;
    expect(within(linha).getByText('Feita · não vai para o acervo')).toBeInTheDocument();
  });

  it('excluir sessão futura: some da lista, toast e foco no bloco', async () => {
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: 'Excluir sessão de Sex 16/10' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão excluída · aviso retirado do mural da tribo'));
    await waitFor(async () => expect(await linhas()).toHaveLength(3));
    expect(screen.getByRole('region', { name: 'Sessões' })).toHaveFocus();
  });

  it('"Falta link" tem ação: valida e grava o link do Meet', async () => {
    const { user } = renderTela();
    const [encontro] = await linhas();
    await user.click(within(encontro).getByRole('button', { name: 'Adicionar link' }));
    const campo = within(encontro).getByRole('textbox', { name: 'Link do Meet' });
    expect(campo).toHaveFocus();
    await user.type(campo, 'link qualquer');
    await user.click(within(encontro).getByRole('button', { name: 'Salvar link' }));
    expect(within(encontro).getByRole('alert')).toHaveTextContent('Use um link https do Meet.');
    await user.clear(campo);
    await user.type(campo, 'meet.google.com/abc-defg-hij{Enter}');
    await waitFor(() => expect(toast()).toHaveTextContent('Link do Meet salvo · a turma vê no mural'));
    const atualizado = (await linhas())[0];
    expect(within(atualizado).getByRole('link', { name: /meet\.google\.com\/abc-defg-hij/ })).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
    expect(within(atualizado).queryByText('Falta link')).not.toBeInTheDocument();
  });

  it('coletiva realizada sem gravação: "Aguardando gravação" + gravação manual leva ao acervo', async () => {
    await fonteAtiva().editarSessao('mock-sessao-1', { status: 'realizada' });
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('tab', { name: 'Realizadas' }));
    const linha = await screen.findByTestId('sessao-mock-sessao-1');
    expect(within(linha).getByText('Aguardando gravação')).toBeInTheDocument();
    await user.click(within(linha).getByRole('button', { name: 'Adicionar gravação' }));
    const campo = within(linha).getByRole('textbox', { name: 'Link da gravação' });
    await user.type(campo, 'http://inseguro.com/x');
    await user.click(within(linha).getByRole('button', { name: 'Salvar' }));
    expect(within(linha).getByRole('alert')).toHaveTextContent('Use um link https da gravação.');
    await user.clear(campo);
    await user.type(campo, 'https://drive.google.com/gravacao-16-10');
    await user.click(within(linha).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Gravação vinculada · no acervo de mentorias'));
    await waitFor(() => expect(within(screen.getByTestId('sessao-mock-sessao-1')).getByText('No acervo de mentorias')).toBeInTheDocument());
  });

  it('erro da fonte numa ação vira toast com mensagemErro (nada some da lista)', async () => {
    vi.spyOn(fonteAtiva(), 'excluirSessao').mockRejectedValue(new ErroFonte(400, 'validacao', 'Somente sessão futura e agendada pode ser excluída'));
    const { user } = renderTela();
    await tabela();
    await user.click(screen.getByRole('button', { name: 'Excluir sessão de Sex 16/10' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Somente sessão futura e agendada pode ser excluída'));
    expect(await linhas()).toHaveLength(4);
  });
});

describe('Sessões B2C · agendas liberadas', () => {
  it('lista os alunos com switch e desliga um', async () => {
    const { user } = renderTela();
    expect(await screen.findByRole('heading', { name: 'Agendamento individual liberado para 3 alunos' })).toBeInTheDocument();
    expect(screen.getByText('desde 18/09 · mensagem enviada')).toBeInTheDocument();
    const sw = screen.getByRole('switch', { name: 'Agendamento individual de Marina Albuquerque' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(sw);
    await waitFor(() => expect(toast()).toHaveTextContent('Agendamento de Marina Albuquerque desligado'));
    expect(await screen.findByRole('heading', { name: 'Agendamento individual liberado para 2 alunos' })).toBeInTheDocument();
  });

  it('"Desligar todos" esvazia a lista', async () => {
    const { user } = renderTela();
    await screen.findByRole('heading', { name: /liberado para 3 alunos/ });
    await user.click(screen.getByRole('button', { name: 'Desligar todos' }));
    expect(await screen.findByText('Nenhum aluno com agenda liberada.')).toBeInTheDocument();
    expect(toast()).toHaveTextContent('Agendamento desligado para todos');
    expect(screen.queryByRole('button', { name: 'Desligar todos' })).not.toBeInTheDocument();
  });

  it('erro nas agendas não derruba a lista de sessões', async () => {
    vi.spyOn(fonteAtiva(), 'convites').mockRejectedValue(new ErroFonte(500, 'rede', 'x'));
    renderTela();
    expect(await tabela()).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('Sessões B2C · acessibilidade', () => {
  it('sem violações do axe na tela carregada', async () => {
    const { container } = renderTela();
    await tabela();
    await screen.findByRole('heading', { name: /liberado para 3 alunos/ });
    expect(await axe(container)).toHaveNoViolations();
  });
});
