/**
 * Tela Canais (B2B) sobre a fonte mock (VITE_MENTOR_FONTE=mock, dados do protótipo B2B).
 * "Hoje" do protótipo = quinta, 15/10/2026.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { _definirConfigParaTestes, _resetarFontes } from '@/features/mentor/api/ativa';
import Canais from '@/features/mentor/routes/v2/Canais';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

function Local() {
  const l = useLocation();
  return <span data-testid="local">{l.pathname + l.search}</span>;
}
function renderizar(rota = '/mentor/canais') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}><Canais /><Local /></MemoryRouter>
    </QueryClientProvider>,
  );
  return qc;
}
const secao = (nome: string | RegExp) => screen.getByRole('region', { name: nome });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2b', latenciaMs: 0 });
});
afterEach(() => {
  vi.useRealTimers();
  _resetarFontes();
  _definirConfigParaTestes(null);
});

describe('Canais · rotina do grupo de WhatsApp', () => {
  it('mostra o grupo da IES, a semana e a situação de cada dia', async () => {
    renderizar();
    expect(screen.getByRole('heading', { level: 1, name: 'Canais' })).toBeInTheDocument();
    const grupo = await screen.findByRole('region', { name: 'Grupo de WhatsApp · PRO ENAMED UniAtenas' });
    expect(within(grupo).getByText('Rotina semanal de 12 a 16/10 · 1 enquete e 1 pérola por semana')).toBeInTheDocument();
    const itens = await within(grupo).findAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveTextContent('Terça, 13/10 · Enquete / desafio de imagem');
    expect(itens[0]).toHaveTextContent('ECG: ritmo com QRS largo após IAM — banco de pérolas, semana 0');
    expect(itens[0]).toHaveTextContent('Enviado');
    expect(itens[1]).toHaveTextContent('Quinta, 15/10 · hoje · Resposta + comentário do mentor');
    expect(itens[1]).toHaveTextContent('Pendente · hoje');
    expect(itens[2]).toHaveTextContent('Sexta, 16/10 · Pérola de conhecimento');
    expect(itens[2]).toHaveTextContent('Amanhã');
    // "Marcar como enviado" só no item do dia (nem no enviado, nem no de amanhã).
    expect(within(grupo).getAllByRole('button', { name: /Marcar como enviado/ })).toHaveLength(1);
    expect(within(itens[2]).queryByRole('button', { name: /Marcar como enviado/ })).toBeNull();
    expect(within(grupo).getByText('Envie como seu, sem "encaminhar".')).toBeInTheDocument();
    const abrir = await within(grupo).findByRole('link', { name: /Abrir grupo/ });
    expect(abrir).toHaveAttribute('href', 'https://chat.whatsapp.com/mock-pro-enamed-uniatenas');
    expect(abrir).toHaveAttribute('target', '_blank');
    expect(abrir).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('"Marcar como enviado" grava pelo hook da rotina, vira "Enviado" e confirma por toast', async () => {
    const user = userEvent.setup();
    renderizar();
    const grupo = await screen.findByRole('region', { name: /Grupo de WhatsApp/ });
    await user.click(await within(grupo).findByRole('button', { name: 'Marcar como enviado: Resposta + comentário do mentor' }));
    await waitFor(() => expect(within(grupo).getAllByText('Enviado')).toHaveLength(2));
    expect(within(grupo).queryByRole('button', { name: /Marcar como enviado/ })).toBeNull();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Resposta + comentário do mentor marcada como enviada · entrou no log da semana');
    // Foco não se perde: vai para a situação do item marcado.
    await waitFor(() => expect(document.activeElement).toHaveTextContent('Enviado'));
  });

  it('edita o link do grupo com a validação chat.whatsapp.com/', async () => {
    const user = userEvent.setup();
    renderizar();
    const grupo = await screen.findByRole('region', { name: /Grupo de WhatsApp/ });
    await user.click(await within(grupo).findByRole('button', { name: 'Editar link' }));
    const campo = within(grupo).getByRole('textbox', { name: 'Link do grupo da turma' });
    expect(campo).toHaveFocus();
    await user.clear(campo);
    await user.type(campo, 'https://wa.me/5511999');
    await user.click(within(grupo).getByRole('button', { name: 'Salvar' }));
    expect(within(grupo).getByRole('alert')).toHaveTextContent('Use um link de convite do WhatsApp (chat.whatsapp.com/…).');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    await user.clear(campo);
    await user.type(campo, 'chat.whatsapp.com/NovoGrupo123');
    await user.click(within(grupo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(within(grupo).getByRole('link', { name: /Abrir grupo/ })).toHaveAttribute('href', 'https://chat.whatsapp.com/NovoGrupo123'));
    expect(screen.getByText('Link do grupo atualizado na página dos alunos')).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Editar link' })).toHaveFocus();
  });
});

describe('Canais · lateral', () => {
  it('Canais gerais fixos, com cadeado', async () => {
    renderizar();
    const gerais = secao('Canais gerais');
    expect(await within(gerais).findByText('Grupo de avisos')).toBeInTheDocument();
    expect(within(gerais).getByText('comunicados para todos os alunos')).toBeInTheDocument();
    expect(within(gerais).getByText('Plantão de dúvidas')).toBeInTheDocument();
    expect(within(gerais).getByText('atendido pela monitoria, não pelo mentor')).toBeInTheDocument();
    expect(within(gerais).getAllByRole('img', { name: 'Link fixo, definido pela SanarFlix' })).toHaveLength(2);
    expect(within(gerais).getByText('Links gerais definidos pela SanarFlix. O grupo da turma (ao lado) é o único que você edita.')).toBeInTheDocument();
  });

  it('mural: últimas publicações e erro "Título e mensagem são obrigatórios."', async () => {
    const user = userEvent.setup();
    renderizar();
    const mural = secao('Mural no Academy');
    const lista = await within(mural).findByRole('list', { name: 'Últimas publicações' });
    const pubs = within(lista).getAllByRole('listitem');
    expect(pubs[0]).toHaveTextContent('Pérola: imunização do lactente');
    expect(pubs[0]).toHaveTextContent('Fique por dentro');
    expect(pubs[0]).toHaveTextContent('09/10');
    expect(pubs[1]).toHaveTextContent('Oficina de 22/10: link e preparo');
    expect(pubs[1]).toHaveTextContent('Aviso');

    const nova = within(mural).getByRole('button', { name: 'Nova publicação' });
    expect(nova).toHaveAttribute('aria-expanded', 'false');
    await user.click(nova);
    const titulo = within(mural).getByRole('textbox', { name: 'Título' });
    expect(titulo).toHaveFocus();
    expect(within(mural).getByRole('button', { name: 'Fique por dentro' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(mural).getByRole('textbox', { name: 'Mensagem' })).toHaveAttribute('placeholder', 'Mensagem para os 186 alunos');
    await user.click(await within(mural).findByRole('button', { name: 'Publicar para 186' }));
    expect(within(mural).getByRole('alert')).toHaveTextContent('Título e mensagem são obrigatórios.');
    expect(titulo).toHaveAttribute('aria-invalid', 'true');
    expect(within(mural).getByRole('textbox', { name: 'Mensagem' })).toHaveAttribute('aria-invalid', 'true');

    await user.click(within(mural).getByRole('button', { name: 'Cancelar' }));
    expect(within(mural).queryByRole('alert')).toBeNull();
    expect(within(mural).getByRole('button', { name: 'Nova publicação' })).toHaveFocus();
  });

  it('mural: publica para a turma, fecha o composer, entra no histórico e confirma por toast', async () => {
    const user = userEvent.setup();
    renderizar();
    const mural = secao('Mural no Academy');
    await within(mural).findByRole('list', { name: 'Últimas publicações' });
    await user.click(within(mural).getByRole('button', { name: 'Nova publicação' }));
    await user.click(within(mural).getByRole('button', { name: 'Aviso' }));
    expect(within(mural).getByRole('button', { name: 'Aviso' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(mural).getByRole('button', { name: 'Fique por dentro' })).toHaveAttribute('aria-pressed', 'false');
    await user.type(within(mural).getByRole('textbox', { name: 'Título' }), 'Oficina de 29/10');
    await user.type(within(mural).getByRole('textbox', { name: 'Mensagem' }), 'Link no grupo.');
    await user.click(within(mural).getByRole('button', { name: 'Publicar para 186' }));
    await waitFor(() => expect(within(mural).queryByRole('textbox', { name: 'Título' })).toBeNull());
    expect(screen.getByText('Publicado para 186 alunos')).toBeInTheDocument();
    await waitFor(() => expect(within(within(mural).getByRole('list', { name: 'Últimas publicações' })).getAllByRole('listitem')[0]).toHaveTextContent('Oficina de 29/10'));
  });

  it('deep link ?novo=1&tag=&titulo=&mensagem= abre o composer preenchido e limpa a URL', async () => {
    renderizar('/mentor/canais?novo=1&tag=desempenho&titulo=Onde%20a%20turma%20perde%20ponto&mensagem=Preventiva%20%3Cb%3Eem%3C%2Fb%3E%20alta');
    const mural = secao('Mural no Academy');
    expect(within(mural).getByRole('textbox', { name: 'Título' })).toHaveValue('Onde a turma perde ponto');
    expect(within(mural).getByRole('textbox', { name: 'Mensagem' })).toHaveValue('Preventiva em alta');
    expect(within(mural).getByRole('button', { name: 'Desempenho' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent(/^\/mentor\/canais$/));
  });

  it('comitê: IES, data a definir e as sinalizações do ciclo', async () => {
    renderizar();
    const comite = await screen.findByRole('region', { name: 'Comitê pedagógico · UniAtenas' });
    expect(within(comite).getByText('com a coordenação do curso', { exact: false })).toBeInTheDocument();
    expect(await within(comite).findByText('Sinalizações à IES · 1')).toBeInTheDocument();
    const item = within(within(comite).getByRole('list', { name: 'Sinalizações à IES' })).getByRole('listitem');
    expect(item).toHaveTextContent('Davi Santana');
    expect(item).toHaveTextContent('02/10');
  });
});

describe('Canais · banco de pérolas', () => {
  it('rodízio com a linha do mentor logado destacada', async () => {
    renderizar();
    const banco = secao('Banco de pérolas · rodízio entre mentores');
    const tabela = await within(banco).findByRole('table');
    const cab = within(tabela).getAllByRole('columnheader').map((c) => c.textContent);
    expect(cab).toEqual(['Semana', 'Mentor responsável', 'No mural em', 'Tema', 'Situação']);
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(11);
    expect(linhas[0]).toHaveTextContent('1Ana Carolina19/10MFC + Cuidados paliativosPróxima no mural');
    expect(linhas[1]).toHaveTextContent('2Beatriz Câmara (você)26/10GOSua vez · propor até 23/10');
    expect(linhas[1]).toHaveAttribute('aria-current', 'true');
    expect(linhas.filter((l) => l.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(linhas[10]).toHaveTextContent('11Sérgio28/12GO');
  });
});
