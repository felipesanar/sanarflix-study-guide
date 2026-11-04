import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});
vi.mock('@/services/mentor/intervencoes', () => ({
  atualizarIntervencao: vi.fn(),
  comentarIntervencao: vi.fn(),
}));
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: vi.fn() }));
vi.mock('@/services/mentor/sessoes', () => ({ liberarAgenda: vi.fn() }));

import { atualizarIntervencao, comentarIntervencao } from '@/services/mentor/intervencoes';
import { fetchTurma } from '@/services/mentor/turma';
import { liberarAgenda } from '@/services/mentor/sessoes';
import { DrawerIntervencao } from '@/features/mentor/components/DrawerIntervencao';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const base = {
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
  comentarios: [{ texto: 'Ligar na quinta', criado_em: '2026-10-11T12:00:00Z' }],
  peso: 1,
};

function renderDrawer(card: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/mentor/intervencoes']}>
        <DrawerIntervencao card={card as never} onFechar={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mock(fetchTurma).mockResolvedValue([
    {
      email: 'ana@x.com',
      nome: 'Ana Souza',
      telefone: '11988887777',
      semestre: 5,
      segmento: 'ativo',
      dias_sem_atividade: 1,
    },
  ]);
  mock(atualizarIntervencao).mockResolvedValue({});
  mock(comentarIntervencao).mockResolvedValue({});
  mock(liberarAgenda).mockResolvedValue({ liberados: 1, intervencoes: 1 });
});

describe('DrawerIntervencao', () => {
  it('mostra WhatsApp com telefone e navega em Abrir aluno', async () => {
    const user = userEvent.setup();
    renderDrawer(base);
    expect(await screen.findByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me/5511988887777'),
    );
    await user.click(screen.getByRole('button', { name: 'Abrir aluno' }));
    expect(navigate).toHaveBeenCalledWith('/mentor/turma?aluno=ana%40x.com');
  });

  it('muda status e salva título editado', async () => {
    const user = userEvent.setup();
    renderDrawer(base);
    await user.selectOptions(await screen.findByLabelText('Status'), 'feito');
    await waitFor(() => expect(atualizarIntervencao).toHaveBeenCalledWith({ id: 'c1', status: 'feito' }));
    const campo = screen.getByLabelText('Título');
    await user.clear(campo);
    await user.type(campo, 'Novo título');
    await user.click(screen.getByRole('button', { name: 'Salvar título' }));
    await waitFor(() => expect(atualizarIntervencao).toHaveBeenCalledWith({ id: 'c1', titulo: 'Novo título' }));
  });

  it('Liberar agenda exige mensagem e chama liberarAgenda', async () => {
    const user = userEvent.setup();
    renderDrawer(base);
    await user.click(await screen.findByRole('button', { name: 'Liberar agenda' }));
    const enviar = screen.getByRole('button', { name: 'Enviar e liberar' });
    expect(enviar).toBeDisabled();
    await user.type(screen.getByLabelText(/Mensagem para o aluno/), 'Vamos marcar?');
    await user.click(enviar);
    await waitFor(() => expect(liberarAgenda).toHaveBeenCalledWith(['ana@x.com'], 'Vamos marcar?'));
  });

  it('comenta', async () => {
    const user = userEvent.setup();
    renderDrawer(base);
    expect(await screen.findByText('Ligar na quinta')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Novo comentário'), 'Feito o contato');
    await user.click(screen.getByRole('button', { name: 'Comentar' }));
    await waitFor(() => expect(comentarIntervencao).toHaveBeenCalledWith('c1', 'Feito o contato'));
  });

  it('card de turma mostra mural e nova sessão coletiva, sem WhatsApp nem agenda', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...base, tipo: 'reuniao_coletiva', alvo: 'turma', alunos: [] });
    expect(await screen.findByRole('button', { name: 'Mensagem no mural' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liberar agenda' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nova sessão coletiva' }));
    expect(navigate).toHaveBeenCalledWith('/mentor/sessoes?nova=coletiva');
  });
});
