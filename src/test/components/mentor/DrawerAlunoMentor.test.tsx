import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aluno } from './fixtures';

const fetchAluno = vi.fn();
const liberarAgenda = vi.fn();
const desligarAgenda = vi.fn();
vi.mock('@/services/mentor/turma', () => ({ fetchAluno: (e: string) => fetchAluno(e) }));
vi.mock('@/services/mentor/sessoes', () => ({
  liberarAgenda: (...a: unknown[]) => liberarAgenda(...a),
  desligarAgenda: (...a: unknown[]) => desligarAgenda(...a),
}));

import { DrawerAlunoMentor } from '@/features/mentor/components/DrawerAlunoMentor';

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DrawerAlunoMentor email="a@x.com" open onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
      { tipo: 'intervencao_criada', criado_em: '2026-10-01T12:00:00Z', payload: { titulo: 'Conversar' } },
      { tipo: 'mural_publicado', criado_em: '2026-10-02T12:00:00Z', payload: { titulo: 'Aviso geral' } },
    ],
    ...over,
  };
}

describe('DrawerAlunoMentor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('filtra o log por Intervenções e Mural', async () => {
    fetchAluno.mockResolvedValue(detalhe());
    renderDrawer();
    await screen.findByText('Conversar', undefined, T);
    expect(screen.getByText('Aviso geral')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mural' }));
    expect(screen.queryByText('Conversar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Intervenções' }));
    expect(screen.getByText('Conversar')).toBeInTheDocument();
    expect(screen.queryByText('Aviso geral')).not.toBeInTheDocument();
  });

  it('mostra erro com "Tentar de novo"', async () => {
    fetchAluno.mockRejectedValue(new Error('boom'));
    renderDrawer();
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, T)).toBeInTheDocument();
  });
});
