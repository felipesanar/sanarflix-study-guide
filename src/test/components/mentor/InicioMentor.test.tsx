import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { comSegmento } from './fixtures';

const fetchMentorContexto = vi.fn();
const fetchTurma = vi.fn();
const listarSessoes = vi.fn();
const listarIntervencoes = vi.fn();
vi.mock('@/services/mentor/contexto', () => ({ fetchMentorContexto: () => fetchMentorContexto() }));
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: () => fetchTurma() }));
vi.mock('@/services/mentor/sessoes', () => ({ listarSessoes: (q: string) => listarSessoes(q) }));
vi.mock('@/services/mentor/intervencoes', () => ({
  listarIntervencoes: (...a: unknown[]) => listarIntervencoes(...a),
}));

import InicioMentor from '@/features/mentor/routes/InicioMentor';

function renderInicio() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mentor']}>
        <InicioMentor />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const T = { timeout: 3000 };

describe('InicioMentor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMentorContexto.mockResolvedValue({
      mentor: { nome: 'Ana Souza', tipo: 'b2c', turma_nome: 'Turma A' },
      alunos_ativos: 5,
    });
    listarSessoes.mockResolvedValue([]);
    listarIntervencoes.mockResolvedValue({ cards: [], planejadas: 0, realizadas: 0 });
  });

  it('mostra "3 alunos sumiram" quando há 3 sumidos e lista os nomes', async () => {
    fetchTurma.mockResolvedValue([
      comSegmento('a@x.com', 'Alice', 'sumido', 12),
      comSegmento('b@x.com', 'Bruno', 'sumido', 20),
      comSegmento('c@x.com', 'Carla', 'sumido', 11),
      comSegmento('d@x.com', 'Davi', 'ativo', 1),
    ]);
    renderInicio();
    expect(await screen.findByText(/3 alunos sumiram\. Comece por eles\./, undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Davi')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver na turma/ })).toHaveAttribute('href', '/mentor/turma?filtro=sumido');
  });

  it('esconde a frase-guia quando ninguém sumiu', async () => {
    fetchTurma.mockResolvedValue([comSegmento('d@x.com', 'Davi', 'ativo', 1)]);
    renderInicio();
    await screen.findByText(/Olá, Ana/, undefined, T);
    await screen.findByText(/Ninguém sumiu/, undefined, T);
    expect(screen.queryByText(/Comece por eles/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Comece por ele\b/)).not.toBeInTheDocument();
  });

  it('mostra a próxima sessão coletiva com "Adicionar link do Meet" e os cards A fazer', async () => {
    fetchTurma.mockResolvedValue([]);
    listarSessoes.mockResolvedValue([
      {
        id: 's1', tipo: 'coletiva', titulo: 'Revisão de cardio', tema: null, inicio: '2026-10-20T20:00:00Z',
        duracao_min: 60, meet_link: null, gravacao_url: null, aluno_email: null, status: 'agendada',
        realizada_em: null, origem: 'academy',
      },
    ]);
    listarIntervencoes.mockResolvedValue({
      cards: [
        { id: 'i1', tipo: 'whatsapp', titulo: 'Falar com Alice', nota: null, status: 'a_fazer', alvo: 'aluno', origem: 'manual', origem_ref: null, criado_em: '2026-10-10', alunos: ['a@x.com'], comentarios: [], peso: 1 },
        { id: 'i2', tipo: 'outro', titulo: 'Já feito', nota: null, status: 'feito', alvo: 'turma', origem: 'manual', origem_ref: null, criado_em: '2026-10-10', alunos: [], comentarios: [], peso: 1 },
      ],
      planejadas: 2,
      realizadas: 1,
    });
    renderInicio();
    expect(await screen.findByText('Revisão de cardio', undefined, T)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Adicionar link do Meet/ })).toBeInTheDocument();
    expect(await screen.findByText('Falar com Alice', undefined, T)).toBeInTheDocument();
    expect(screen.queryByText('Já feito')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver todas as intervenções/ })).toHaveAttribute('href', '/mentor/intervencoes');
  });

  const sessaoComMeet = (meet_link: string | null) => ({
    id: 's1', tipo: 'coletiva', titulo: 'Revisão', tema: null, inicio: '2026-10-20T20:00:00Z',
    duracao_min: 60, meet_link, gravacao_url: null, aluno_email: null, status: 'agendada',
    realizada_em: null, origem: 'academy',
  });

  it('mostra "Abrir o Meet" só para link http(s)', async () => {
    fetchTurma.mockResolvedValue([]);
    listarSessoes.mockResolvedValue([sessaoComMeet('https://meet.google.com/abc-defg')]);
    renderInicio();
    const link = await screen.findByRole('link', { name: /Abrir o Meet/ }, T);
    expect(link).toHaveAttribute('href', 'https://meet.google.com/abc-defg');
    expect(screen.queryByRole('link', { name: /Adicionar link do Meet/ })).not.toBeInTheDocument();
  });

  it('trata meet_link com esquema perigoso como vazio', async () => {
    fetchTurma.mockResolvedValue([]);
    listarSessoes.mockResolvedValue([sessaoComMeet('javascript:alert(1)')]);
    renderInicio();
    expect(await screen.findByRole('link', { name: /Adicionar link do Meet/ }, T)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir o Meet/ })).not.toBeInTheDocument();
  });

  it('mostra erro com "Tentar de novo" quando o contexto falha', async () => {
    fetchMentorContexto.mockRejectedValue(new Error('boom'));
    fetchTurma.mockResolvedValue([]);
    renderInicio();
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, T)).toBeInTheDocument();
    await waitFor(() => expect(fetchMentorContexto).toHaveBeenCalled());
  });
});
