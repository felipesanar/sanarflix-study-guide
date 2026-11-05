import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { _definirConfigParaTestes, _resetarFontes, dadosAtivos, fonteAtiva } from '../../api/ativa';
import { ErroFonte } from '../../api/fonte';
import { EMAIL, renderDrawer, urlAluno } from './testUtils';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

beforeEach(() => { _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2c', latenciaMs: 0 }); });
afterEach(() => { _resetarFontes(); _definirConfigParaTestes(null); vi.restoreAllMocks(); });

const dialogo = () => screen.findByRole('dialog', { name: /Marina Albuquerque|Caio Menezes|Beatriz Sampaio/ }, { timeout: 5000 });
const local = () => screen.getByTestId('localizacao').textContent;

describe('DrawerAlunoHost · URL', () => {
  it('sem ?aluno= não abre nada', () => {
    renderDrawer('/mentor/turma');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('carregando mostra skeleton com o rótulo do aluno e o botão de fechar', async () => {
    renderDrawer(urlAluno(EMAIL.marina));
    expect(await screen.findByRole('status', { name: 'Carregando aluno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(await dialogo()).toBeInTheDocument();
  });

  it('fechar remove só o parâmetro aluno e devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    renderDrawer('/mentor/turma?seg=abaixo', { gatilho: EMAIL.marina });
    const gatilho = screen.getByRole('button', { name: 'Abrir aluno' });
    await user.click(gatilho);
    await dialogo();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(local()).toBe('/mentor/turma');
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it('Esc fecha o drawer', async () => {
    const user = userEvent.setup();
    renderDrawer(`${urlAluno(EMAIL.marina)}&seg=abaixo`);
    await dialogo();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(local()).toBe('/mentor/turma?seg=abaixo'));
  });
});

describe('Drawer B2C · cabeçalho e dados', () => {
  it('mostra identidade da tribo, participação, segmento e dados sem semestre', async () => {
    renderDrawer(urlAluno(EMAIL.marina));
    const d = await dialogo();
    expect(within(d).getByRole('heading', { name: 'Marina Albuquerque' })).toBeInTheDocument();
    expect(await within(d).findByText(/Tribo Carcará · participou de 3 de 5 simulados/)).toBeInTheDocument();
    expect(within(d).getByText('Abaixo do corte')).toBeInTheDocument();
    expect(within(d).getByText('(79) 9 9104-5582')).toBeInTheDocument();
    expect(within(d).getByText('dez/26')).toBeInTheDocument();
    expect(within(d).getByText('USP-SP · 84%')).toBeInTheDocument();
    expect(within(d).queryByText(/semestre|período/i)).not.toBeInTheDocument();
    expect(within(d).getByText('MA')).toBeInTheDocument();
  });

  it('consumo no Flix dos últimos 30 dias acima das notas', async () => {
    renderDrawer(urlAluno(EMAIL.beatriz));
    const d = await dialogo();
    const consumo = await within(d).findByRole('region', { name: 'Consumo no Flix' });
    for (const rotulo of ['Questões feitas', 'Acerto em questões', 'Aulas assistidas', 'PDFs']) expect(within(consumo).getByText(rotulo)).toBeInTheDocument();
    expect(within(consumo).getByText('últimos 30 dias')).toBeInTheDocument();
    expect(within(consumo).getByText('260')).toBeInTheDocument();
    const notas = within(d).getByRole('region', { name: 'Notas dos simulados' });
    expect(consumo.compareDocumentPosition(notas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('null nunca vira zero: consumo e notas sem dado mostram traço', async () => {
    const original = dadosAtivos().alunoDetalhe;
    vi.spyOn(dadosAtivos(), 'alunoDetalhe').mockImplementation(async (email) => {
      const r = await original(email);
      r.data.aluno = { ...r.data.aluno!, questoes30d: { respondidas: null, acertos: null, erros: null, pctAcerto: null }, conteudos30d: { videos: null, documentos: null, total: null }, temDadoConsumo: false, temDadoQuestoes: false, meta: null };
      r.data.notas = r.data.notas.map((n, i) => (i === 0 ? { ...n, acertoPct: null } : n));
      return r;
    });
    renderDrawer(urlAluno(EMAIL.beatriz));
    const d = await dialogo();
    const consumo = await within(d).findByRole('region', { name: 'Consumo no Flix' });
    expect(within(consumo).getAllByText('—')).toHaveLength(4);
    expect(within(consumo).queryByText('0')).not.toBeInTheDocument();
    expect(within(d).getByText('Aguardando Metas')).toBeInTheDocument();
    expect(within(d).getByText(/participou de 4 de 5 simulados/)).toBeInTheDocument();
  });

  it('erro mostra EstadoErro e "Tentar novamente" refaz a consulta', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(dadosAtivos(), 'alunoDetalhe').mockRejectedValueOnce(new ErroFonte(503, 'rede', 'falhou'));
    renderDrawer(urlAluno(EMAIL.marina));
    expect(await screen.findByText('Não foi possível carregar o aluno.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(await dialogo()).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Marina Albuquerque' })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('aluno fora da turma mostra vazio com a mensagem da fonte', async () => {
    renderDrawer(urlAluno('ninguem@exemplo.com'));
    expect(await screen.findByText('Aluno não encontrado')).toBeInTheDocument();
    expect(screen.getByText('Um dos alunos não está mais na turma. Atualize a lista.')).toBeInTheDocument();
  });
});

describe('Drawer B2C · notas dos simulados', () => {
  it('lista do mais recente ao mais antigo com vs corte; clique abre o Detalhamento com o simulado', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.marina));
    const d = await dialogo();
    const notas = within(d).getByRole('region', { name: 'Notas dos simulados' });
    const linhas = await within(notas).findAllByRole('button', { name: /Simulado PRO/ });
    expect(linhas.map((l) => l.textContent?.match(/\dº Simulado PRO/)?.[0])).toEqual(['3º Simulado PRO', '2º Simulado PRO', '1º Simulado PRO']);
    expect(within(linhas[0]).getByText('69%')).toBeInTheDocument();
    expect(within(linhas[0]).getByText('Abaixo do corte · −15 p.p.')).toBeInTheDocument();
    expect(within(linhas[0]).getByText(/27\/07\/2026/)).toBeInTheDocument();
    expect(within(notas).queryByRole('button', { name: /Ver todos os simulados/ })).not.toBeInTheDocument();
    await user.click(linhas[0]);
    await waitFor(() => expect(local()).toBe('/mentor/detalhamento?s=mock-sim-3'));
  });

  it('mostra 3 e expande para todos com "Ver todos os simulados"', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    const notas = within(d).getByRole('region', { name: 'Notas dos simulados' });
    expect(await within(notas).findAllByRole('button', { name: /Simulado PRO/ })).toHaveLength(3);
    const ver = within(notas).getByRole('button', { name: 'Ver todos os simulados' });
    expect(ver).toHaveAttribute('aria-expanded', 'false');
    await user.click(ver);
    expect(within(notas).getAllByRole('button', { name: /Simulado PRO/ })).toHaveLength(5);
    expect(within(notas).getByRole('button', { name: 'Mostrar menos' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(notas).getByText('Acima do corte · +2 p.p.')).toBeInTheDocument();
  });
});

describe('Drawer B2C · agenda individual', () => {
  it('ligar exige mensagem: erro inline, depois envia, cria card e mostra toast', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    const sw = await within(d).findByRole('switch', { name: 'Liberar agendamento individual' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(within(d).getByText('Para liberar, mande uma mensagem individual. Ela aparece na aba "Pra você" do aluno.')).toBeInTheDocument();
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(within(d).getByText('Falta 1 passo')).toBeInTheDocument();
    const campo = within(d).getByRole('textbox', { name: 'Mensagem individual' });
    expect(campo).toHaveAttribute('placeholder', 'Mensagem individual (obrigatória)');
    expect(within(d).getByText('Também registra "Reunião individual" em A fazer.')).toBeInTheDocument();
    await user.click(within(d).getByRole('button', { name: 'Enviar e liberar' }));
    expect(within(d).getByText('Sem mensagem, a agenda não é liberada.')).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    await user.type(campo, 'Caio, vamos conversar sobre o 5º simulado.');
    expect(within(d).queryByText('Sem mensagem, a agenda não é liberada.')).not.toBeInTheDocument();
    await user.click(within(d).getByRole('button', { name: 'Enviar e liberar' }));
    const toast = await within(d).findByText('Agenda liberada para Caio. "Reunião individual" entrou em A fazer.');
    expect(toast.closest('[role="status"]')).not.toBeNull();
    await waitFor(() => expect(within(d).getByText(/^Liberado desde \d\d\/\d\d\. Desligar remove o botão "Agendar com o mentor" do aluno\.$/)).toBeInTheDocument());
    const convites = await fonteAtiva().convites('t');
    expect(convites.find((c) => c.alunoId === EMAIL.caio)?.mensagem).toBe('Caio, vamos conversar sobre o 5º simulado.');
    const quadro = await dadosAtivos().intervencoes({ de: null, ate: null });
    expect(quadro.cards.some((c) => c.origem === 'agenda_liberada' && c.destino.alunoIds?.includes(EMAIL.caio) && c.status === 'afazer')).toBe(true);
  });

  it('Cancelar fecha o passo sem liberar', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    const sw = await within(d).findByRole('switch', { name: 'Liberar agendamento individual' });
    await user.click(sw);
    await user.click(within(d).getByRole('button', { name: 'Cancelar' }));
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(within(d).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('agenda já liberada: desligar remove a liberação', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.marina));
    const d = await dialogo();
    const sw = await within(d).findByRole('switch', { name: 'Liberar agendamento individual' });
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));
    expect(within(d).getByText('Liberado desde 26/09. Desligar remove o botão "Agendar com o mentor" do aluno.')).toBeInTheDocument();
    await user.click(sw);
    expect(await within(d).findByText('Agendamento desligado')).toBeInTheDocument();
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'));
    expect((await fonteAtiva().convites('t')).some((c) => c.alunoId === EMAIL.marina)).toBe(false);
  });

  it('sem link do Google Agenda o switch fica desabilitado com a mensagem de docs/07', async () => {
    await fonteAtiva().atualizarPerfil({ agendaUrl: '' });
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    const sw = await within(d).findByRole('switch', { name: 'Liberar agendamento individual' });
    expect(sw).toBeDisabled();
    expect(within(d).getByText('Cadastre seu link do Google Agenda no perfil para liberar agendamentos.')).toBeInTheDocument();
  });

  it('erro da fonte ao liberar aparece inline com mensagemErro', async () => {
    const user = userEvent.setup();
    vi.spyOn(fonteAtiva(), 'liberarAgenda').mockRejectedValueOnce(new ErroFonte(503, 'rede', 'x'));
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    await user.click(await within(d).findByRole('switch', { name: 'Liberar agendamento individual' }));
    await user.type(within(d).getByRole('textbox', { name: 'Mensagem individual' }), 'Oi');
    await user.click(within(d).getByRole('button', { name: 'Enviar e liberar' }));
    expect(await within(d).findByText('Não foi possível carregar agora. Tente novamente.')).toBeInTheDocument();
  });
});

describe('Drawer B2C · ações e log', () => {
  it('WhatsApp abre o wa.me e grava no log', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.beatriz));
    const d = await dialogo();
    const whats = await within(d).findByRole('link', { name: 'WhatsApp' });
    expect(whats).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/5571996412280\?text=/));
    expect(whats).toHaveAttribute('target', '_blank');
    await user.click(whats);
    expect(await within(d).findByText('WhatsApp aberto em nova aba · registrado no log')).toBeInTheDocument();
    const log = within(d).getByRole('region', { name: 'Log de interações' });
    expect(await within(log).findByText('WhatsApp aberto pelo Academy')).toBeInTheDocument();
  });

  it('Mensagem no mural leva o aluno como destinatário', async () => {
    renderDrawer(urlAluno(EMAIL.beatriz));
    const d = await dialogo();
    expect(await within(d).findByRole('link', { name: 'Mensagem no mural' })).toHaveAttribute('href', `/mentor/mural?para=${encodeURIComponent(EMAIL.beatriz)}`);
  });

  it('Criar intervenção cria card em A fazer e aparece no log com status', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.beatriz));
    const d = await dialogo();
    await user.click(await within(d).findByRole('button', { name: 'Criar intervenção' }));
    expect(await within(d).findByText('Intervenção criada em A fazer')).toBeInTheDocument();
    const log = within(d).getByRole('region', { name: 'Log de interações' });
    const item = await within(log).findByText('Acompanhar Beatriz');
    expect(within(item.closest('li')!).getByText('A fazer')).toBeInTheDocument();
  });

  it('filtros do log com aria-pressed e vazio com o texto do protótipo', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    const log = within(d).getByRole('region', { name: 'Log de interações' });
    expect(await within(log).findByText('Mural (pra você) · Sua nota caiu, vamos entender?')).toBeInTheDocument();
    expect(within(log).getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(log).getByRole('button', { name: 'Mural' }));
    expect(within(log).getByRole('button', { name: 'Mural' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(log).queryByText('WhatsApp aberto pelo Academy')).not.toBeInTheDocument();
    expect(within(log).getByText('Mural (pra você) · Sua nota caiu, vamos entender?')).toBeInTheDocument();
  });

  it('log vazio', async () => {
    renderDrawer(urlAluno(EMAIL.beatriz));
    const d = await dialogo();
    const log = within(d).getByRole('region', { name: 'Log de interações' });
    expect(await within(log).findByText('Nenhuma interação registrada ainda.')).toBeInTheDocument();
  });

  it('desempenho por área expande e recolhe por chevron', async () => {
    const user = userEvent.setup();
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    const area = within(d).getByRole('region', { name: 'Desempenho por área' });
    const botoes = await within(area).findAllByRole('button');
    const primeiro = botoes[0];
    expect(primeiro).toHaveAttribute('aria-expanded', 'true');
    const antes = within(area).getAllByRole('button').length;
    await user.click(primeiro);
    expect(primeiro).toHaveAttribute('aria-expanded', 'false');
    expect(within(area).getAllByRole('button').length).toBeLessThan(antes);
  });
});

describe('Drawer B2C · acessibilidade', () => {
  it('diálogo modal nomeado, sem violações do axe e foco inicial dentro do drawer', async () => {
    const { axe } = await import('vitest-axe');
    renderDrawer(urlAluno(EMAIL.caio));
    const d = await dialogo();
    await within(d).findByRole('switch', { name: 'Liberar agendamento individual' });
    expect(d.contains(document.activeElement)).toBe(true);
    expect(await axe(d)).toHaveNoViolations();
  });
});
