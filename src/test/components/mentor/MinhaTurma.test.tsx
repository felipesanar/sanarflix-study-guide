import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { comSegmento } from './fixtures';

const fetchMentorContexto = vi.fn();
const fetchTurma = vi.fn();
vi.mock('@/services/mentor/contexto', () => ({ fetchMentorContexto: () => fetchMentorContexto() }));
vi.mock('@/services/mentor/turma', () => ({
  fetchTurma: () => fetchTurma(),
  fetchAluno: vi.fn().mockResolvedValue({ aluno: null, liberacao: null, intervencoes: [], log: [] }),
}));
vi.mock('@/services/mentor/sessoes', () => ({ liberarAgenda: vi.fn(), desligarAgenda: vi.fn() }));

import MinhaTurma from '@/features/mentor/routes/MinhaTurma';

function renderTurma(url = '/mentor/turma') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <MinhaTurma />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const T = { timeout: 3000 };

describe('MinhaTurma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMentorContexto.mockResolvedValue({
      mentor: { nome: 'Ana', tipo: 'b2c', turma_nome: 'Turma A' },
      alunos_ativos: 3,
    });
    fetchTurma.mockResolvedValue([
      comSegmento('a@x.com', 'Alice Sumida', 'sumido', 14),
      comSegmento('b@x.com', 'Bruno Ativo', 'ativo', 2),
      comSegmento('c@x.com', 'Carla Fria', 'esfriando', 8),
    ]);
  });

  it('filtra por segmento e o chip "vindo da home" some ao remover', async () => {
    renderTurma('/mentor/turma?filtro=sumido');
    expect(await screen.findByText('Alice Sumida', undefined, T)).toBeInTheDocument();
    expect(screen.queryByText('Bruno Ativo')).not.toBeInTheDocument();
    expect(screen.queryByText('Carla Fria')).not.toBeInTheDocument();
    expect(screen.getByText(/vindo da home/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remover filtro/ }));

    expect(screen.queryByText(/vindo da home/i)).not.toBeInTheDocument();
    expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
    expect(screen.getByText('Carla Fria')).toBeInTheDocument();
  });

  it('mostra o aviso de simulados, "Aguardando Metas" e "há N dias"', async () => {
    renderTurma();
    await screen.findByText('Alice Sumida', undefined, T);
    expect(screen.getByText(/Os simulados ainda não chegam aqui/)).toBeInTheDocument();
    expect(screen.getAllByText('Aguardando Metas').length).toBe(3);
    expect(screen.getByText('há 14 dias')).toBeInTheDocument();
    expect(screen.getByText('Sem acesso há 10+ dias')).toBeInTheDocument();
  });

  it('busca por nome ou e-mail', async () => {
    renderTurma();
    await screen.findByText('Alice Sumida', undefined, T);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bruno' } });
    expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
    expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
  });

  it('usa o título "Visão Geral" para mentor b2b', async () => {
    fetchMentorContexto.mockResolvedValue({
      mentor: { nome: 'Ana', tipo: 'b2b', turma_nome: 'IES' },
      alunos_ativos: 3,
    });
    renderTurma();
    expect(await screen.findByRole('heading', { name: 'Visão Geral' }, T)).toBeInTheDocument();
  });

  it('mostra erro com "Tentar de novo"', async () => {
    fetchTurma.mockRejectedValue(new Error('boom'));
    renderTurma();
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, T)).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar a turma/)).toBeInTheDocument();
  });
});
