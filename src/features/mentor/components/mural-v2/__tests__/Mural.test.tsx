/**
 * Tela Mural (B2C) sobre a fonte mock (dados do protótipo `Mentor B2C.dc.html`): render, estados,
 * validações literais, publicar/editar/excluir/rascunho, destinatários, deep link e Canais da tribo.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { _definirConfigParaTestes, _resetarFontes, dadosAtivos, fonteAtiva } from '@/features/mentor/api/ativa';
import { ErroFonte } from '@/features/mentor/api/fonte';
import Mural from '@/features/mentor/routes/v2/Mural';
import { urlMuralComposer } from '../deepLinkMural';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const T = { timeout: 5000 };

function Local() {
  const l = useLocation();
  return <output data-testid="local">{l.pathname + l.search}</output>;
}
function renderMural(url = '/mentor/mural') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const r = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/mentor/mural" element={<><Mural /><Local /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...r, qc };
}
const composer = () => screen.getByRole('region', { name: 'Nova publicação' });
const publicadas = () => screen.getByRole('region', { name: 'Publicadas' });
const canais = () => screen.getByRole('region', { name: 'Canais da tribo' });
const previa = () => screen.getByTestId('previa-aluno');
const toast = () => screen.getAllByRole('status').find((el) => el.classList.contains('mural-toast-regiao'))!;
async function pronto() {
  await screen.findByRole('button', { name: 'Publicar para 12 alunos' }, T);
  await within(publicadas()).findAllByRole('listitem', {}, T);
}

beforeEach(() => {
  _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2c', latenciaMs: 0 });
  vi.mocked(global.fetch).mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  _resetarFontes();
  _definirConfigParaTestes(null);
});

describe('Mural · render com dados do protótipo', () => {
  it('composer, prévia, Publicadas e Canais com textos literais', async () => {
    renderMural();
    expect(screen.getByRole('heading', { level: 1, name: 'Mural' })).toBeInTheDocument();
    await pronto();
    const c = composer();
    const tags = within(c).getByRole('radiogroup', { name: 'Tag' });
    expect(within(tags).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Desempenho', 'Aviso', 'Fique por dentro']);
    expect(within(tags).getByRole('radio', { name: 'Desempenho' })).toHaveAttribute('aria-checked', 'true');
    const para = within(c).getByRole('radiogroup', { name: 'Para quem' });
    expect(within(para).getByRole('radio', { name: /Toda a turma/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(para).getByRole('radio', { name: /Toda a turma/ })).toHaveTextContent('12 alunos');
    expect(within(para).getByRole('radio', { name: /Selecionados/ })).toHaveTextContent('aba Pra você');
    expect(within(c).getByLabelText('Título')).toHaveAttribute('placeholder', 'Ex.: Sua nota caiu. Vamos entender o porquê?');
    expect(within(c).getByLabelText('Mensagem')).toHaveAttribute('placeholder', 'Escreva como se estivesse falando com o aluno.');
    expect(within(c).getByRole('checkbox', { name: 'Registrar como intervenção (Mensagem · 12 alunos)' })).toBeChecked();
    expect(within(c).getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();

    expect(screen.getByText('Como o aluno vê')).toBeInTheDocument();
    expect(within(previa()).getByText('Mural da Tribo Carcará')).toBeInTheDocument();
    expect(within(previa()).getByText('Coletivo')).toBeInTheDocument();
    expect(within(previa()).queryByText('Pra você')).toBeNull();
    expect(within(previa()).getByText('Título da publicação')).toBeInTheDocument();
    expect(within(previa()).getByText('A mensagem aparece aqui, como o aluno vai ler na home.')).toBeInTheDocument();
    expect(within(previa()).getByText('Thiago Taniguchi · Tribo Carcará')).toBeInTheDocument();

    const linhas = within(publicadas()).getAllByRole('listitem');
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toHaveTextContent('Liberei minha agenda pra você');
    expect(linhas[0]).toHaveTextContent('Aviso');
    expect(linhas[0]).toHaveTextContent('Caio Menezes · individual');
    expect(linhas[0]).toHaveTextContent('29/09');
    expect(linhas[2]).toHaveTextContent('Toda a turma');
    expect(within(linhas[1]).getByText(/alunos · individual$/)).toBeInTheDocument();

    expect(within(canais()).getByText('aparecem na página de cada aluno')).toBeInTheDocument();
    for (const nome of ['Grupo de avisos', 'Plantão de dúvidas', 'Grupo da Tribo Carcará']) expect(within(canais()).getByText(nome)).toBeInTheDocument();
    expect(within(canais()).getAllByText('Link geral, definido pela SanarFlix')).toHaveLength(2);
    expect(within(canais()).getByText('Único canal que você define')).toBeInTheDocument();
    expect(within(canais()).getByRole('link', { name: 'chat.whatsapp.com/Kc8tRbQ2xLm' })).toHaveAttribute('href', 'https://chat.whatsapp.com/Kc8tRbQ2xLm');
    expect(within(canais()).getAllByRole('button')).toHaveLength(1);
  });

  it('prévia ao vivo: tag, título, mensagem e título do link', async () => {
    renderMural();
    await pronto();
    fireEvent.click(within(composer()).getByRole('radio', { name: 'Aviso' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Encontro de novembro' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Quinta, 19h.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Inserir link' }));
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://meet.google.com/x' } });
    fireEvent.change(screen.getByLabelText('Título do link (obrigatório)'), { target: { value: 'Entrar no encontro' } });
    const p = within(previa());
    expect(p.getByText('Aviso')).toBeInTheDocument();
    expect(p.getByText('agora')).toBeInTheDocument();
    expect(p.getByText('Encontro de novembro')).toBeInTheDocument();
    expect(p.getByText('Quinta, 19h.')).toBeInTheDocument();
    expect(p.getByText('Entrar no encontro')).toBeInTheDocument();
  });
});

describe('Mural · validações (captura b2c/12)', () => {
  it('publicar vazio mostra "Informe o título." e "Escreva a mensagem.", marca os campos e foca o título', async () => {
    renderMural();
    await pronto();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    expect(await screen.findByText('Informe o título.')).toBeInTheDocument();
    expect(screen.getByText('Escreva a mensagem.')).toBeInTheDocument();
    const titulo = screen.getByLabelText('Título');
    expect(titulo).toHaveAttribute('aria-invalid', 'true');
    expect(titulo).toHaveAccessibleDescription('Informe o título.');
    expect(screen.getByLabelText('Mensagem')).toHaveAccessibleDescription('Escreva a mensagem.');
    await waitFor(() => expect(titulo).toHaveFocus());
    fireEvent.change(titulo, { target: { value: 'x' } });
    expect(screen.queryByText('Informe o título.')).toBeNull();
    expect(screen.getByText('Escreva a mensagem.')).toBeInTheDocument();
  });

  it('link sem título: "Link inserido precisa de título."; link não https é recusado', async () => {
    renderMural();
    await pronto();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    const botaoLink = screen.getByRole('button', { name: 'Inserir link' });
    expect(botaoLink).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botaoLink);
    expect(botaoLink).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://exemplo.com/aula' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    expect(await screen.findByText('Link inserido precisa de título.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Título do link (obrigatório)')).toHaveFocus());
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'http://exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    expect(await screen.findByText('Use um link https://.')).toBeInTheDocument();
  });

  it('Selecionados sem aluno: "Selecione pelo menos um aluno."', async () => {
    renderMural();
    await pronto();
    fireEvent.click(screen.getByRole('radio', { name: /Selecionados/ }));
    expect(screen.getByText('Nenhum aluno selecionado')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 0 alunos' }));
    expect(await screen.findByText('Selecione pelo menos um aluno.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Alunos selecionados' })).toHaveAccessibleDescription('Selecione pelo menos um aluno.');
  });
});

describe('Mural · publicar', () => {
  it('turma toda: toast "Publicado para 12 alunos · registrado em Intervenções", entra no topo e cria card Feito', async () => {
    renderMural();
    await pronto();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Revisão de Preventiva' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Assistam até sexta.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Publicado para 12 alunos · registrado em Intervenções'));
    await waitFor(() => expect(within(publicadas()).getAllByRole('listitem')[0]).toHaveTextContent('Revisão de Preventiva'));
    expect(within(publicadas()).getAllByRole('listitem')[0]).toHaveTextContent('Toda a turma');
    expect(screen.getByLabelText('Título')).toHaveValue('');
    const quadro = await dadosAtivos().intervencoes({ de: null, ate: null });
    expect(quadro.cards.find((x) => x.titulo === 'Revisão de Preventiva')).toMatchObject({ tipo: 'mensagem', status: 'feito', origem: 'mural' });
  });

  it('sem "Registrar como intervenção": toast sem sufixo e nenhum card', async () => {
    renderMural();
    await pronto();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sem card' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Registrar como intervenção/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    await waitFor(() => expect(toast()).toHaveTextContent(/^Publicado para 12 alunos$/));
    const quadro = await dadosAtivos().intervencoes({ de: null, ate: null });
    expect(quadro.cards.some((x) => x.titulo === 'Sem card')).toBe(false);
  });

  it('Selecionados (captura b2c/13): atalho por alerta, aba "Pra você", busca de aluno, contagem sem repetição e envio só para eles', async () => {
    const criar = vi.spyOn(fonteAtiva(), 'criarPublicacao');
    renderMural();
    await pronto();
    fireEvent.click(screen.getByRole('radio', { name: /Selecionados/ }));
    expect(within(previa()).getByText('Pra você')).toBeInTheDocument();
    const atalhos = await screen.findByRole('group', { name: 'Adicionar por alerta' }, T);
    const regrediram = await within(atalhos).findByRole('button', { name: /^Regrediram · \d+$/ }, T);
    const n = Number(regrediram.textContent!.split('· ')[1]);
    expect(within(atalhos).getByRole('button', { name: /^Sumiram · \d+$/ })).toBeInTheDocument();
    expect(within(atalhos).getByRole('button', { name: /^Não fizeram o 5º simulado · \d+$/ })).toBeInTheDocument();
    fireEvent.click(regrediram);
    expect(regrediram).toHaveAttribute('aria-pressed', 'true');
    const selecao = screen.getByRole('group', { name: 'Alunos selecionados' });
    expect(within(selecao).getByText(`Regrediram · ${n}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Publicar para ${n} alunos` })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: `Registrar como intervenção (Mensagem · ${n} alunos)` })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar aluno pelo nome' }), { target: { value: 'beatriz' } });
    fireEvent.click(within(screen.getByRole('list', { name: 'Alunos encontrados' })).getByRole('button', { name: 'Beatriz Sampaio' }));
    expect(within(selecao).getByText('Beatriz Sampaio')).toBeInTheDocument();
    const total = n + 1;
    expect(screen.getByRole('button', { name: `Publicar para ${total} alunos` })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Sua nota caiu' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Vamos conversar.' } });
    fireEvent.click(screen.getByRole('button', { name: `Publicar para ${total} alunos` }));
    await waitFor(() => expect(toast()).toHaveTextContent(`Publicado para ${total} alunos · registrado em Intervenções`));
    const pub = criar.mock.calls[0][1];
    expect(pub.destino).toMatchObject({ tipo: 'alunos' });
    expect((pub.destino as { alunoIds: string[] }).alunoIds).toHaveLength(total);
    expect((pub.destino as { alunoIds: string[] }).alunoIds).toContain('beatriz.sampaio@exemplo.com');
    expect(pub.registrarIntervencao).toBe(true);
  });

  it('remover chip tira o aluno da contagem', async () => {
    renderMural();
    await pronto();
    fireEvent.click(screen.getByRole('radio', { name: /Selecionados/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar aluno pelo nome' }), { target: { value: 'caio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Caio Menezes' }));
    expect(screen.getByRole('button', { name: 'Publicar para 1 aluno' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover Caio Menezes' }));
    expect(screen.getByText('Nenhum aluno selecionado')).toBeInTheDocument();
  });

  it('erro da fonte aparece com a mensagem de mensagemErro e nada é limpo', async () => {
    vi.spyOn(fonteAtiva(), 'criarPublicacao').mockRejectedValue(new ErroFonte(503, 'rede', 'boom'));
    renderMural();
    await pronto();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar agora. Tente novamente.');
    expect(screen.getByLabelText('Título')).toHaveValue('T');
  });

  it('erro de validação da fonte vai inline no campo', async () => {
    vi.spyOn(fonteAtiva(), 'criarPublicacao').mockRejectedValue(new ErroFonte(400, 'validacao', 'Título muito longo', 'titulo'));
    renderMural();
    await pronto();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    expect(await screen.findByText('Título muito longo')).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription('Título muito longo');
  });

  it('toast some depois de 3,2 s', async () => {
    renderMural();
    await pronto();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Publicado para 12 alunos'));
    act(() => { vi.advanceTimersByTime(3300); });
    expect(toast()).toBeEmptyDOMElement();
  });
});

describe('Mural · anexo', () => {
  it('recusa tipo inválido; aceito aparece e sobe pela fonte ao publicar', async () => {
    const upload = vi.spyOn(fonteAtiva(), 'pedirUpload');
    const criar = vi.spyOn(fonteAtiva(), 'criarPublicacao');
    renderMural();
    await pronto();
    const input = screen.getByTestId('mural-arquivo');
    fireEvent.change(input, { target: { files: [new File(['x'], 'nota.exe', { type: 'application/x-msdownload' })] } });
    expect(screen.getByText('Envie imagem (PNG, JPG, WebP) ou PDF.')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'roteiro.pdf', { type: 'application/pdf' })] } });
    expect(screen.queryByText('Envie imagem (PNG, JPG, WebP) ou PDF.')).toBeNull();
    expect(within(composer()).getByText('roteiro.pdf')).toBeInTheDocument();
    expect(within(previa()).getByText('roteiro.pdf')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    await waitFor(() => expect(criar).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledWith({ nome: 'roteiro.pdf', mime: 'application/pdf', bytes: 4 });
    expect(criar.mock.calls[0][1].anexo).toMatchObject({ nome: 'roteiro.pdf', mime: 'application/pdf' });
    expect(global.fetch).not.toHaveBeenCalled(); // mock devolve uploadUrl sem https: nada sai da máquina
  });
});

describe('Mural · Publicadas: editar, excluir, rascunho, filtro (captura b2c/11b)', () => {
  it('Editar carrega no composer, avisa "Editando: …" e salva como "· editada" sem novo card', async () => {
    const editar = vi.spyOn(fonteAtiva(), 'editarPublicacao');
    renderMural();
    await pronto();
    const linha = within(publicadas()).getAllByRole('listitem')[2];
    expect(linha).toHaveTextContent('Encontro de outubro: link e tema');
    fireEvent.click(within(linha).getByRole('button', { name: 'Editar Encontro de outubro: link e tema' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Editando: Encontro de outubro: link e tema'));
    expect(screen.getByLabelText('Título')).toHaveValue('Encontro de outubro: link e tema');
    expect(within(composer()).getByRole('radio', { name: 'Aviso' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: /Registrar como intervenção/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveFocus());
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Encontro de outubro: novo link' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    await waitFor(() => expect(toast()).toHaveTextContent(/^Publicado para 12 alunos$/));
    expect(editar.mock.calls[0][1]).toMatchObject({ titulo: 'Encontro de outubro: novo link', registrarIntervencao: false });
    const editada = await within(publicadas()).findByText('Encontro de outubro: novo link');
    expect(editada.closest('li')).toHaveTextContent(/25\/09 · editada/);
  });

  it('Cancelar edição volta ao composer vazio', async () => {
    renderMural();
    await pronto();
    fireEvent.click(within(publicadas()).getAllByRole('button', { name: /^Editar / })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar edição' }));
    expect(screen.getByLabelText('Título')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Cancelar edição' })).toBeNull();
  });

  it('Excluir remove a linha e avisa "Publicação excluída · some da home dos alunos"', async () => {
    renderMural();
    await pronto();
    fireEvent.click(within(publicadas()).getByRole('button', { name: 'Excluir Imunização: o calendário que mais cai' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Publicação excluída · some da home dos alunos'));
    await waitFor(() => expect(within(publicadas()).queryByText('Imunização: o calendário que mais cai')).toBeNull());
    expect(within(publicadas()).getAllByRole('listitem')).toHaveLength(3);
  });

  it('Salvar rascunho grava como rascunho, avisa "Rascunho salvo" e publicar depois usa o mesmo registro', async () => {
    const criar = vi.spyOn(fonteAtiva(), 'criarPublicacao');
    const editar = vi.spyOn(fonteAtiva(), 'editarPublicacao');
    renderMural();
    await pronto();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Rascunho de novembro' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Rascunho salvo'));
    expect(criar.mock.calls[0][1]).toMatchObject({ status: 'rascunho', registrarIntervencao: false });
    const linha = (await within(publicadas()).findByText('Rascunho de novembro')).closest('li')!;
    expect(linha).toHaveTextContent('Rascunho');
    expect(screen.getByLabelText('Título')).toHaveValue('Rascunho de novembro');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para 12 alunos' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Publicado para 12 alunos · registrado em Intervenções'));
    expect(criar).toHaveBeenCalledTimes(1);
    expect(editar.mock.calls[0][1]).toMatchObject({ status: 'publicada', registrarIntervencao: true });
  });

  it('rascunho não exige destinatário, mas exige título e mensagem', async () => {
    renderMural();
    await pronto();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText('Informe o título.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Selecionados/ }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Rascunho salvo'));
    expect(screen.queryByText('Selecione pelo menos um aluno.')).toBeNull();
  });

  it('filtro por tag (aria-pressed) e vazio com "Limpar filtro"', async () => {
    vi.spyOn(fonteAtiva(), 'publicacoes').mockResolvedValue({
      data: [{ id: 'p1', tag: 'aviso', titulo: 'Só aviso', mensagem: 'm', link: null, anexoUrl: null, destino: { tipo: 'turma' }, status: 'publicada', publicadaEm: '2026-10-01T15:00:00Z' }],
      nextCursor: null,
    });
    renderMural();
    await within(publicadas()).findByText('Só aviso', {}, T);
    const filtro = within(publicadas()).getByRole('group', { name: 'Filtrar por tag' });
    expect(within(filtro).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(filtro).getByRole('button', { name: 'Desempenho' }));
    expect(within(filtro).getByRole('button', { name: 'Desempenho' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(publicadas()).getByText('Nenhuma publicação com esta tag.')).toBeInTheDocument();
    fireEvent.click(within(publicadas()).getByRole('button', { name: 'Limpar filtro' }));
    expect(within(publicadas()).getByText('Só aviso')).toBeInTheDocument();
  });
});

describe('Mural · estados', () => {
  it('carregando: skeleton em Publicadas e Canais; o composer continua utilizável', async () => {
    vi.spyOn(fonteAtiva(), 'publicacoes').mockReturnValue(new Promise(() => {}));
    vi.spyOn(fonteAtiva(), 'canais').mockReturnValue(new Promise(() => {}));
    renderMural();
    expect(await screen.findByRole('status', { name: 'Carregando Publicadas' }, T)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Carregando Canais da tribo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toBeEnabled();
  });

  it('erro: EstadoErro com "Tentar novamente" refaz só o bloco', async () => {
    const lista = vi.spyOn(fonteAtiva(), 'publicacoes').mockRejectedValueOnce(new ErroFonte(503, 'rede', 'x'));
    vi.spyOn(fonteAtiva(), 'canais').mockRejectedValueOnce(new ErroFonte(503, 'rede', 'x'));
    renderMural();
    const erroPub = await within(publicadas()).findByRole('alert', {}, T);
    expect(erroPub).toHaveTextContent('Algo deu errado');
    expect(await within(canais()).findByRole('alert', {}, T)).toBeInTheDocument();
    fireEvent.click(within(erroPub).getByRole('button', { name: 'Tentar novamente' }));
    expect(await within(publicadas()).findByText('Liberei minha agenda pra você', {}, T)).toBeInTheDocument();
    expect(lista).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Título')).toBeEnabled();
  });

  it('vazio: "Nenhuma publicação ainda."', async () => {
    vi.spyOn(fonteAtiva(), 'publicacoes').mockResolvedValue({ data: [], nextCursor: null });
    renderMural();
    expect(await within(publicadas()).findByText('Nenhuma publicação ainda.', {}, T)).toBeInTheDocument();
  });

  it('sem simulado (V0): atalhos só de engajamento', async () => {
    const d = dadosAtivos();
    const original = await d.desempenhoTurma(null);
    vi.spyOn(d, 'desempenhoTurma').mockResolvedValue({ ...original, data: { ...original.data, alunos: [], simulados: [], participacaoUltimo: { simuladoId: null, fizeram: 0, total: 12 } } });
    renderMural();
    await pronto();
    fireEvent.click(screen.getByRole('radio', { name: /Selecionados/ }));
    const atalhos = await screen.findByRole('group', { name: 'Adicionar por alerta' }, T);
    await waitFor(() => expect(within(atalhos).queryByRole('button', { name: /Regrediram/ })).toBeNull());
    expect(within(atalhos).getByRole('button', { name: /^Sumiram · \d+$/ })).toBeInTheDocument();
  });
});

describe('Mural · deep link', () => {
  it('questão → Selecionados com o grupo "Marcaram C na Q12" e o título; a URL é limpa', async () => {
    const url = urlMuralComposer({
      emails: ['caio.menezes@exemplo.com', 'beatriz.sampaio@exemplo.com', 'fora@turma.com'],
      grupo: 'Marcaram C na Q12', titulo: 'Vigilância em saúde: o erro que mais apareceu', tag: 'desempenho',
    });
    renderMural(url);
    expect(await screen.findByRole('button', { name: 'Publicar para 2 alunos' }, T)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Selecionados/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByRole('group', { name: 'Alunos selecionados' })).getByText('Marcaram C na Q12 · 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('Vigilância em saúde: o erro que mais apareceu');
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent(/^\/mentor\/mural$/));
  });

  it('drawer/intervenção (?para= sem grupo) → um chip por aluno', async () => {
    renderMural('/mentor/mural?para=caio.menezes@exemplo.com');
    expect(await screen.findByRole('button', { name: 'Remover Caio Menezes' }, T)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar para 1 aluno' })).toBeInTheDocument();
  });

  it('diagnóstico → turma toda com título e mensagem', async () => {
    renderMural(urlMuralComposer({ titulo: 'Onde a turma perde ponto no 5º', mensagem: 'Preventiva em alta prevalência é o ponto mais fraco.' }));
    await pronto();
    expect(screen.getByRole('radio', { name: /Toda a turma/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Título')).toHaveValue('Onde a turma perde ponto no 5º');
    expect(screen.getByLabelText('Mensagem')).toHaveValue('Preventiva em alta prevalência é o ponto mais fraco.');
  });
});

describe('Mural · Canais da tribo', () => {
  it('Editar link valida chat.whatsapp.com, salva e devolve o foco ao gatilho', async () => {
    const salvar = vi.spyOn(fonteAtiva(), 'salvarGrupoTribo');
    renderMural();
    await pronto();
    const gatilho = within(canais()).getByRole('button', { name: 'Editar link' });
    fireEvent.click(gatilho);
    const input = within(canais()).getByRole('textbox', { name: 'Link do grupo da tribo' });
    expect(input).toHaveValue('https://chat.whatsapp.com/Kc8tRbQ2xLm');
    fireEvent.change(input, { target: { value: 'https://wa.me/5571999' } });
    fireEvent.click(within(canais()).getByRole('button', { name: 'Salvar' }));
    expect(within(canais()).getByText('Use um link de convite do WhatsApp (chat.whatsapp.com/…).')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(salvar).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'chat.whatsapp.com/NovoGrupo9' } });
    fireEvent.click(within(canais()).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast()).toHaveTextContent('Link do grupo atualizado na página dos alunos'));
    expect(salvar).toHaveBeenCalledWith(expect.any(String), 'https://chat.whatsapp.com/NovoGrupo9');
    expect(await within(canais()).findByRole('link', { name: 'chat.whatsapp.com/NovoGrupo9' }, T)).toBeInTheDocument();
    await waitFor(() => expect(within(canais()).getByRole('button', { name: 'Editar link' })).toHaveFocus());
  });

  it('Esc cancela a edição; erro da fonte aparece inline', async () => {
    vi.spyOn(fonteAtiva(), 'salvarGrupoTribo').mockRejectedValue(new ErroFonte(403, 'canal_nao_editavel', 'x'));
    renderMural();
    await pronto();
    fireEvent.click(within(canais()).getByRole('button', { name: 'Editar link' }));
    fireEvent.click(within(canais()).getByRole('button', { name: 'Salvar' }));
    expect(await within(canais()).findByText('Este canal não pode ser editado.')).toBeInTheDocument();
    fireEvent.keyDown(within(canais()).getByRole('textbox', { name: 'Link do grupo da tribo' }), { key: 'Escape' });
    expect(within(canais()).queryByRole('textbox')).toBeNull();
    expect(within(canais()).getByRole('button', { name: 'Editar link' })).toBeInTheDocument();
  });
});

describe('Mural · acessibilidade', () => {
  it('radiogroups navegam por setas e só o marcado entra no Tab', async () => {
    renderMural();
    await pronto();
    const desempenho = within(composer()).getByRole('radio', { name: 'Desempenho' });
    expect(desempenho).toHaveAttribute('tabindex', '0');
    expect(within(composer()).getByRole('radio', { name: 'Aviso' })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(desempenho, { key: 'ArrowRight' });
    const aviso = within(composer()).getByRole('radio', { name: 'Aviso' });
    expect(aviso).toHaveAttribute('aria-checked', 'true');
    expect(aviso).toHaveFocus();
  });

  it('sem violações de axe no estado com dados', async () => {
    const { container } = renderMural();
    await pronto();
    const { axe } = await import('vitest-axe');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});
