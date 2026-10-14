import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aluno } from './fixtures';

const fetchAluno = vi.fn();
const fetchAlunoNotas = vi.fn();
const liberarAgenda = vi.fn();
const desligarAgenda = vi.fn();
vi.mock('@/services/mentor/turma', () => ({ fetchAluno: (e: string) => fetchAluno(e) }));
vi.mock('@/services/mentor/desempenho', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/desempenho')>('@/services/mentor/desempenho')),
  fetchAlunoNotas: (e: string) => fetchAlunoNotas(e),
}));
vi.mock('@/services/mentor/sessoes', () => ({
  liberarAgenda: (...a: unknown[]) => liberarAgenda(...a),
  desligarAgenda: (...a: unknown[]) => desligarAgenda(...a),
}));

import { DrawerAlunoMentor } from '@/features/mentor/components/DrawerAlunoMentor';

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DrawerAlunoMentor email="a@x.com" open onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

const T = { timeout: 3000 };

function detalhe(over: Record<string, unknown> = {}) {
  return {
    aluno: aluno({
      email: 'a@x.com', nome: 'Alice Souza', telefone: '11988887777', segmento: 'sumido', dias_sem_atividade: 12,
    }),
    liberacao: null,
    intervencoes: [],
    log: [
      { tipo: 'intervencao_criada', criado_em: '2026-10-01T12:00:00Z', payload: { tipo: 'reuniao_individual', alvo: 'aluno' } },
      { tipo: 'intervencao_status', criado_em: '2026-10-03T12:00:00Z', payload: { de: 'a_fazer', para: 'feito' } },
      { tipo: 'mural_publicado', criado_em: '2026-10-02T12:00:00Z', payload: { post_id: 'p1', tag: 'Aviso' } },
    ],
    ...over,
  };
}

describe('DrawerAlunoMentor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAlunoNotas.mockResolvedValue({ email: 'a@x.com', notas: [], areas: [] });
    liberarAgenda.mockResolvedValue({ liberados: 1, intervencoes: 1 });
    desligarAgenda.mockResolvedValue({ desligados: 1 });
  });

  it('bloqueia "Enviar e liberar" sem mensagem e chama liberarAgenda com mensagem', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    renderDrawer();
    await screen.findByText('Alice Souza', undefined, T);

    fireEvent.click(screen.getByRole('switch', { name: /Liberar agendamento individual/ }));
    expect(screen.getByText('Falta 1 passo')).toBeInTheDocument();
    const enviar = screen.getByRole('button', { name: 'Enviar e liberar' });
    expect(enviar).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Mensagem para o aluno/), { target: { value: 'Vamos conversar?' } });
    expect(enviar).toBeEnabled();
    expect(screen.queryByText('Falta 1 passo')).not.toBeInTheDocument();
    fireEvent.click(enviar);

    await waitFor(() => expect(liberarAgenda).toHaveBeenCalledWith(['a@x.com'], 'Vamos conversar?'));
  });

  it('mostra "Liberado desde" e "Desligar" quando já está ligado', async () => {
    fetchAluno.mockResolvedValue(
      detalhe({ liberacao: { ligado: true, desde: '2026-10-05T15:00:00Z', mensagem: 'oi' } }),
    );
    renderDrawer();
    expect(await screen.findByText(/Liberado desde 05\/10/, undefined, T)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(desligarAgenda).toHaveBeenCalledWith(['a@x.com']));
  });

  it('mostra WhatsApp com telefone e o oculta sem telefone', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    const { unmount } = renderDrawer();
    const wa = await screen.findByRole('link', { name: /WhatsApp/ }, T);
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5511988887777/);
    unmount();

    fetchAluno.mockResolvedValue(detalhe({ aluno: aluno({ email: 'a@x.com', nome: 'Alice Souza', telefone: null }) }));
    renderDrawer();
    await screen.findByText('Alice Souza', undefined, T);
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('aponta mural e intervenção para as rotas do portal', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    renderDrawer();
    expect(await screen.findByRole('link', { name: /Mensagem no mural/ }, T)).toHaveAttribute(
      'href',
      '/mentor/mural?para=a%40x.com',
    );
    expect(screen.getByRole('link', { name: /Criar intervenção/ })).toHaveAttribute(
      'href',
      '/mentor/intervencoes?novo=1&aluno=a%40x.com',
    );
  });

  it('mostra o log com linhas em pt-BR e filtra por Intervenções e Mural', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    renderDrawer();
    await screen.findByText('Intervenção criada · Reunião individual', undefined, T);
    expect(screen.getByText('Mural · Aviso')).toBeInTheDocument();
    expect(screen.getByText('Status: A fazer → Feito')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mural' }));
    expect(screen.queryByText('Intervenção criada · Reunião individual')).not.toBeInTheDocument();
    expect(screen.getByText('Mural · Aviso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Intervenções' }));
    expect(screen.getByText('Intervenção criada · Reunião individual')).toBeInTheDocument();
    expect(screen.getByText('Status: A fazer → Feito')).toBeInTheDocument();
    expect(screen.queryByText('Mural · Aviso')).not.toBeInTheDocument();
  });

  it('liberar agenda invalida as queries do mentor (agenda-liberacoes, mural), menos o contexto', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    const { client } = renderDrawer();
    client.setQueryData(['mentor', 'agenda-liberacoes', 'm1'], []);
    client.setQueryData(['mentor', 'mural', 'posts', '', ''], []);
    client.setQueryData(['mentor', 'contexto'], { mentor: null, alunos_ativos: 0 });
    await screen.findByText('Alice Souza', undefined, T);

    fireEvent.click(screen.getByRole('switch', { name: /Liberar agendamento individual/ }));
    fireEvent.change(screen.getByLabelText(/Mensagem para o aluno/), { target: { value: 'Vamos conversar?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar e liberar' }));

    await waitFor(() => expect(liberarAgenda).toHaveBeenCalled());
    await waitFor(() => expect(client.getQueryState(['mentor', 'agenda-liberacoes', 'm1'])?.isInvalidated).toBe(true), T);
    expect(client.getQueryState(['mentor', 'mural', 'posts', '', ''])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['mentor', 'contexto'])?.isInvalidated).toBe(false);
  });

  it('aluno fora da turma (RPC levanta "não é da sua turma") mostra "Aluno não encontrado", sem retry', async () => {
    fetchAluno.mockRejectedValue(new Error('aluno a@x.com não é da sua turma'));
    renderDrawer();
    expect(await screen.findByText('Aluno não encontrado', undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Este aluno não está na sua turma.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('mostra erro com "Tentar de novo"', async () => {
    fetchAluno.mockRejectedValue(new Error('boom'));
    renderDrawer();
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, T)).toBeInTheDocument();
  });

  it('mostra as notas dos simulados e o desempenho por área', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    fetchAlunoNotas.mockResolvedValue({
      email: 'a@x.com',
      notas: [
        { simulado_id: 's2', sequence_number: 2, titulo: 'Simulado Nacional 2', acerto_pct: 64.5, finalizada_em: '2026-10-08T15:00:00Z' },
        { simulado_id: 's1', sequence_number: 1, titulo: 'Simulado Nacional 1', acerto_pct: 58, finalizada_em: '2026-09-20T15:00:00Z' },
      ],
      areas: [
        {
          grande_area: 'Clínica Médica',
          acerto_pct: 61,
          respostas: 40,
          temas: [{ tema: 'Hipertensão', acerto_pct: 45, respostas: 8 }],
        },
      ],
    });
    renderDrawer();
    expect(await screen.findByRole('heading', { name: 'Notas dos simulados' }, T)).toBeInTheDocument();
    expect(screen.getByText('Simulado Nacional 1')).toBeInTheDocument();
    expect(screen.getByText('58%')).toBeInTheDocument();
    expect(screen.getByText('64,5%')).toBeInTheDocument();
    expect(screen.getByText('08/10')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Desempenho por área' })).toBeInTheDocument();
    expect(screen.getByText('Clínica Médica')).toBeInTheDocument();
    expect(screen.getByText('Hipertensão')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('8 respostas')).toBeInTheDocument();
    expect(fetchAlunoNotas).toHaveBeenCalledWith('a@x.com');
  });

  it('esconde as seções de simulado quando o aluno não tem notas nem áreas', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    renderDrawer();
    await screen.findByText('Alice Souza', undefined, T);
    await waitFor(() => expect(fetchAlunoNotas).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Carregando simulados…')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Notas dos simulados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Desempenho por área' })).not.toBeInTheDocument();
  });

  it('mostra erro quando as notas falham, sem derrubar o resto do drawer', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    fetchAlunoNotas.mockRejectedValue(new Error('boom'));
    renderDrawer();
    expect(await screen.findByText(/Não foi possível carregar os simulados/, undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Alice Souza')).toBeInTheDocument();
  });
});
