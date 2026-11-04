/**
 * Sessões de mentoria B2B (Fase 6.4) sobre a fonte mock (`Mentor B2B.dc.html`), "hoje" = 15/10/2026.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { _definirConfigParaTestes, _resetarFontes, fonteAtiva } from '@/features/mentor/api/ativa';
import { ErroFonte } from '@/features/mentor/api/fonte';
import Sessoes from '@/features/mentor/routes/v2/Sessoes';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const HOJE = new Date('2026-10-15T12:00:00-03:00');

function Local() {
  return <output data-testid="url">{useLocation().search}</output>;
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
const lista = () => screen.findByRole('list', { name: 'Sessões' });
const itens = async () => within(await lista()).getAllByRole('listitem').filter((li) => li.classList.contains('ms-sessao'));
const gatilho = (li: HTMLElement) => li.querySelector<HTMLButtonElement>('.ms-sessao-gatilho')!;
const toast = () => screen.getByTestId('toast-sessoes');
const url = () => screen.getByTestId('url').textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HOJE);
  _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2b', latenciaMs: 0 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  _resetarFontes();
  _definirConfigParaTestes(null);
});

describe('Sessões B2B · lista', () => {
  it('título, faixa do contrato e próximas em ordem cronológica com status de statusSessao', async () => {
    renderTela();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sessões de mentoria' })).toBeInTheDocument();
    const ciclo = await screen.findByRole('region', { name: 'Ciclo do contrato' });
    expect(ciclo).toHaveTextContent('Contrato UniAtenas: 2 encontros síncronos por mês');
    await waitFor(() => expect(ciclo).toHaveTextContent('Out: 1 de 2 realizados'));
    expect(ciclo).toHaveTextContent('Nov: 2 de 2 agendados');

    const li = await itens();
    expect(li.map((x) => x.querySelector('.ms-num')!.textContent)).toEqual(['20/10', '22/10', '05/11', '19/11']);
    expect(li.map((x) => x.querySelector('.ms-status')!.textContent)).toEqual(['Agendada', 'Agendada', 'Falta link', 'Falta link e pauta']);
    expect(within(li[0]).getByText('Individual')).toBeInTheDocument();
    expect(within(li[0]).getByText('Bruno Teles · agenda liberada')).toBeInTheDocument();
    expect(within(li[1]).getByText('Oficina de questões')).toBeInTheDocument();
    expect(within(li[1]).getByText('5 pré-teste → comentário → ficha → 5 pós')).toBeInTheDocument();
    expect(within(li[2]).getByText('Pós-simulado')).toBeInTheDocument();
    expect(within(li[3]).getByText('Tema a definir')).toBeInTheDocument();
    expect(within(li[3]).getByText('escolha a partir dos temas críticos')).toBeInTheDocument();
    expect(li[2].querySelector('.ms-status')).toHaveAttribute('data-tom', 'pendencia');
  });

  it('a próxima coletiva abre expandida: pauta, link e "Marcar realizada"', async () => {
    renderTela();
    const li = await itens();
    expect(gatilho(li[0])).toHaveAttribute('aria-expanded', 'false');
    expect(gatilho(li[1])).toHaveAttribute('aria-expanded', 'true');
    const corpo = within(li[1]).getByRole('region');
    expect(within(corpo).getByText('Pauta')).toBeInTheDocument();
    expect(within(corpo).getByText('Vigilância em saúde · 38% de acerto')).toBeInTheDocument();
    expect(within(corpo).getAllByText('tema crítico')).toHaveLength(2);
    expect(within(corpo).getByRole('link', { name: /meet\.google\.com\/uniatenas-ofic-2210/ })).toHaveAttribute('href', 'https://meet.google.com/uniatenas-ofic-2210');
    expect(within(corpo).getByRole('button', { name: /Marcar realizada/ })).toBeInTheDocument();
  });

  it('expandir outra fecha a anterior e grava a sessão aberta na URL; fechar limpa', async () => {
    const { user } = renderTela();
    const li = await itens();
    await user.click(gatilho(li[3]));
    expect(gatilho(li[3])).toHaveAttribute('aria-expanded', 'true');
    expect(gatilho(li[1])).toHaveAttribute('aria-expanded', 'false');
    expect(url()).toContain('sessao=mock-sessao-5');
    const corpo = within(li[3]).getByRole('region');
    expect(within(corpo).getByText('Sem itens na pauta.')).toBeInTheDocument();
    expect(within(corpo).getByRole('textbox', { name: 'Link do Meet' })).toHaveAttribute('placeholder', 'Colar link do Meet');
    // Coletiva sem link não pode ser marcada como realizada.
    expect(within(corpo).queryByRole('button', { name: /Marcar realizada/ })).not.toBeInTheDocument();
    await user.click(gatilho(li[3]));
    expect(gatilho(li[3])).toHaveAttribute('aria-expanded', 'false');
    expect(url()).toBe('?sessao=');
  });

  it('colar o link do Meet tira o "Falta link" do status', async () => {
    const { user } = renderTela('/mentor/sessoes?sessao=mock-sessao-5');
    const li = (await itens())[3];
    const campo = within(li).getByRole('textbox', { name: 'Link do Meet' });
    await user.type(campo, 'meet.google.com/uniatenas-ofic-1911');
    await user.click(within(li).getByRole('button', { name: 'Salvar link' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Link do Meet salvo · a turma vê no mural'));
    await waitFor(() => expect((screen.getByTestId('sessao-mock-sessao-5').querySelector('.ms-status'))!.textContent).toBe('Pauta pendente'));
  });

  it('remover item da pauta grava a pauta restante', async () => {
    const { user } = renderTela();
    const li = (await itens())[1];
    await user.click(within(li).getByRole('button', { name: 'Remover da pauta: Vigilância em saúde · 38% de acerto' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Item removido da pauta'));
    await waitFor(() => expect(within(screen.getByTestId('sessao-mock-sessao-2')).queryByText('Vigilância em saúde · 38% de acerto')).not.toBeInTheDocument());
    expect(within(screen.getByTestId('sessao-mock-sessao-2')).getByText('Hepatites virais · 42% de acerto')).toBeInTheDocument();
    const salva = (await fonteAtiva().sessoes('x')).data.find((s) => s.id === 'mock-sessao-2')!;
    expect(salva.pauta.map((p) => p.texto)).toEqual(['Hepatites virais · 42% de acerto']);
  });

  it('"Marcar realizada" leva a sessão para Realizadas', async () => {
    const { user } = renderTela();
    const li = (await itens())[1];
    await user.click(within(li).getByRole('button', { name: /Marcar realizada/ }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão marcada como realizada · card em Feito'));
    await waitFor(async () => expect((await itens()).map((x) => x.querySelector('.ms-num')!.textContent)).toEqual(['20/10', '05/11', '19/11']));
    await user.click(screen.getByRole('tab', { name: 'Realizadas' }));
    expect((await itens()).map((x) => x.querySelector('.ms-num')!.textContent)).toEqual(['22/10', '08/10', '24/09']);
  });

  it('individual realizada não vai ao acervo; coletiva sem gravação aceita gravação manual', async () => {
    await fonteAtiva().editarSessao('mock-sessao-3', { status: 'realizada' });
    const { user } = renderTela();
    await lista();
    await user.click(screen.getByRole('tab', { name: 'Realizadas' }));
    const li = await itens();
    expect(li.map((x) => x.querySelector('.ms-num')!.textContent)).toEqual(['20/10', '08/10', '24/09']);
    expect(li.every((x) => x.querySelector('.ms-status')!.textContent === 'Realizada')).toBe(true);
    await user.click(gatilho(li[0]));
    expect(within(li[0]).getByText('Individual não vai para o acervo')).toBeInTheDocument();
    await user.click(gatilho(li[1]));
    expect(within(li[1]).getByText('No acervo de mentorias')).toBeInTheDocument();
    await user.click(gatilho(li[2]));
    expect(within(li[2]).getByText('Aguardando gravação')).toBeInTheDocument();
    expect(within(li[2]).queryByRole('button', { name: /Remover da pauta/ })).not.toBeInTheDocument();
    await user.click(within(li[2]).getByRole('button', { name: 'Adicionar gravação' }));
    await user.type(within(li[2]).getByRole('textbox', { name: 'Link da gravação' }), 'https://drive.google.com/oficina-2409{Enter}');
    await waitFor(() => expect(toast()).toHaveTextContent('Gravação vinculada · no acervo de mentorias'));
    await waitFor(() => expect(within(screen.getByTestId('sessao-mock-sessao-6')).getByText('No acervo de mentorias')).toBeInTheDocument());
  });

  it('excluir sessão futura pela linha expandida', async () => {
    const { user } = renderTela('/mentor/sessoes?sessao=mock-sessao-4');
    const li = (await itens())[2];
    await user.click(within(li).getByRole('button', { name: /Excluir sessão/ }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão excluída · aviso retirado do mural'));
    await waitFor(async () => expect(await itens()).toHaveLength(3));
  });

  it('filtros por tipo (aria-pressed) e deep link de realizada', async () => {
    const { user, unmount } = renderTela();
    await lista();
    await user.click(screen.getByRole('button', { name: 'Oficina de questões' }));
    expect(screen.getByRole('button', { name: 'Oficina de questões' })).toHaveAttribute('aria-pressed', 'true');
    expect((await itens()).map((x) => x.querySelector('.ms-num')!.textContent)).toEqual(['22/10', '19/11']);
    unmount();
    renderTela('/mentor/sessoes?sessao=mock-sessao-1');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Realizadas' })).toHaveAttribute('aria-selected', 'true'));
    expect(gatilho(await screen.findByTestId('sessao-mock-sessao-1'))).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Sessões B2B · nova sessão', () => {
  it('tipos com descrição do formato, data obrigatória e hora padrão 20h', async () => {
    const { user } = renderTela();
    await lista();
    await user.click(screen.getByRole('button', { name: /Nova sessão/ }));
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    expect(within(form).getByRole('button', { name: 'Pós-simulado' })).toHaveFocus();
    expect(within(form).getByText('Discussão dos temas mais críticos do simulado. Pauta sugerida: as 20 mais erradas e os distratores.')).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: 'Hora' })).toHaveValue('20h');
    await user.click(within(form).getByRole('button', { name: 'Salvar sessão' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Informe a data da sessão.');
    expect(within(form).getByRole('textbox', { name: 'Data' })).toHaveAttribute('aria-invalid', 'true');

    await user.click(within(form).getByRole('button', { name: 'Oficina de questões' }));
    expect(within(form).getByText('Prática ativa: 5 questões pré-teste → comentário → ficha resumo → 5 pós-aula. Alunos votam a alternativa no chat.')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Individual' }));
    expect(within(form).getByText('Reunião com um aluno. Entra no kanban como Reunião individual.')).toBeInTheDocument();
    expect(within(form).getByRole('combobox', { name: 'Aluno' })).toBeInTheDocument();
    expect(within(form).queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument();
  });

  it('aviso "acima do contrato" aparece e não bloqueia o salvamento', async () => {
    const { user } = renderTela();
    await lista();
    await user.click(screen.getByRole('button', { name: /Nova sessão/ }));
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    await user.type(within(form).getByRole('textbox', { name: 'Data' }), '26/11');
    expect(within(form).getByTestId('aviso-contrato')).toHaveTextContent('Já há 2 sessões coletivas neste mês. O contrato da UniAtenas prevê 2; uma terceira não conta no ciclo.');
    await user.type(within(form).getByRole('textbox', { name: 'Tema' }), 'Pós 5º simulado');
    await user.click(within(form).getByRole('button', { name: 'Salvar sessão' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão salva · falta o link do Meet'));
    const nova = (await itens()).find((x) => x.textContent?.includes('Pós 5º simulado'))!;
    expect(nova.querySelector('.ms-num')!.textContent).toBe('26/11');
    expect(gatilho(nova)).toHaveAttribute('aria-expanded', 'true');
    expect(nova.querySelector('.ms-status')!.textContent).toBe('Falta link');
    expect(screen.getByRole('region', { name: 'Ciclo do contrato' })).toHaveTextContent('Nov: 3 de 2 agendados');
  });

  it('individual no mesmo mês não dispara o aviso; warning da fonte vira aviso no toast', async () => {
    const fonte = fonteAtiva();
    const original = fonte.criarSessao.bind(fonte);
    vi.spyOn(fonte, 'criarSessao').mockImplementation(async (t, s) => ({ ...(await original(t, s)), warnings: ['acima_do_contrato'] }));
    const { user } = renderTela();
    await lista();
    await user.click(screen.getByRole('button', { name: /Nova sessão/ }));
    const form = screen.getByRole('form', { name: 'Nova sessão' });
    await user.click(within(form).getByRole('button', { name: 'Individual' }));
    await user.type(within(form).getByRole('textbox', { name: 'Data' }), '26/11');
    expect(within(form).queryByTestId('aviso-contrato')).not.toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Oficina de questões' }));
    await user.type(within(form).getByRole('textbox', { name: 'Link' }), 'https://meet.google.com/abc');
    await user.click(within(form).getByRole('button', { name: 'Salvar sessão' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Sessão salva · turma avisada no mural · acima do contrato, não conta no ciclo'));
  });
});

describe('Sessões B2B · estados', () => {
  it('carregando e erro com "Tentar novamente"', async () => {
    const fonte = fonteAtiva();
    const original = fonte.sessoes.bind(fonte);
    vi.spyOn(fonte, 'sessoes').mockRejectedValueOnce(new ErroFonte(403, 'sem_acesso_tribo', 'x')).mockImplementation(original);
    const { user } = renderTela();
    expect(await screen.findByText('Você não tem acesso a esta turma.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await lista()).toBeInTheDocument();
  });

  it('sem contrato cadastrado a faixa do ciclo não aparece (não inventa meta)', async () => {
    const fonte = fonteAtiva();
    const me = await fonte.me();
    vi.spyOn(fonte, 'me').mockResolvedValue({ ...me, tribos: me.tribos.map((t) => ({ ...t, encontrosPorMes: null })) });
    renderTela();
    await lista();
    expect(screen.queryByRole('region', { name: 'Ciclo do contrato' })).not.toBeInTheDocument();
  });

  it('sem violações do axe', async () => {
    const { container } = renderTela();
    await lista();
    expect(await axe(container)).toHaveNoViolations();
  });
});
