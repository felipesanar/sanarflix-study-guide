import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { comSegmento, desempAluno, desempenho, nota, SEM_DESEMPENHO, SIM1, SIM2 } from './fixtures';

const fetchMentorContexto = vi.fn();
const fetchTurma = vi.fn();
const fetchAluno = vi.fn();
const fetchDesempenhoTurma = vi.fn();
const fetchAlunoNotas = vi.fn();
vi.mock('@/services/mentor/contexto', () => ({ fetchMentorContexto: () => fetchMentorContexto() }));
vi.mock('@/services/mentor/turma', () => ({
  fetchTurma: () => fetchTurma(),
  fetchAluno: (e: string) => fetchAluno(e),
}));
vi.mock('@/services/mentor/desempenho', () => ({
  fetchDesempenhoTurma: (...a: unknown[]) => fetchDesempenhoTurma(...a),
  fetchAlunoNotas: (e: string) => fetchAlunoNotas(e),
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
    fetchAluno.mockResolvedValue({ aluno: null, liberacao: null, intervencoes: [], log: [] });
    fetchAlunoNotas.mockResolvedValue({ email: '', notas: [], areas: [] });
    fetchDesempenhoTurma.mockResolvedValue(SEM_DESEMPENHO);
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

  it('abre o drawer do aluno de ?aluno=<email> e busca os detalhes', async () => {
    renderTurma('/mentor/turma?aluno=teste1@exemplo.com');
    expect(await screen.findByRole('dialog', undefined, T)).toBeInTheDocument();
    await waitFor(() => expect(fetchAluno).toHaveBeenCalledWith('teste1@exemplo.com'));
  });

  it('abre o drawer ao clicar no botão com o nome do aluno', async () => {
    renderTurma();
    fireEvent.click(await screen.findByRole('button', { name: 'Bruno Ativo' }, T));
    await waitFor(() => expect(fetchAluno).toHaveBeenCalledWith('b@x.com'));
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

  describe('com simulados', () => {
    const base = () =>
      desempenho(
        [
          desempAluno({
            email: 'a@x.com', notas: [nota(SIM1, 1, 60), nota(SIM2, 2, 70)], ultimo_acerto: 70,
            corte_mais_dificil: 75, vs_corte_pp: -5, situacao: 'proximo', regrediu: false, fez_ultimo: true,
          }),
          desempAluno({
            email: 'b@x.com', notas: [nota(SIM1, 1, 50)], ultimo_acerto: 50,
            corte_mais_dificil: 80, vs_corte_pp: -30, situacao: 'longe', estagnado: true, fez_ultimo: false,
          }),
          desempAluno({ email: 'c@x.com', situacao: 'sem_simulado', fez_ultimo: false }),
        ],
        {
          possivel_aprovacao_pct: 33.3,
          acerto_medio_ultimo: 70,
          participacao_ultimo: { simulado_id: SIM2, fizeram: 1, total: 3 },
        },
      );

    beforeEach(() => {
      fetchTurma.mockResolvedValue([
        comSegmento('a@x.com', 'Alice Sumida', 'sumido', 14),
        comSegmento('b@x.com', 'Bruno Ativo', 'ativo', 2),
        comSegmento('c@x.com', 'Carla Fria', 'esfriando', 8),
      ]);
      fetchDesempenhoTurma.mockImplementation((ids?: string[]) =>
        Promise.resolve(
          ids && ids.length > 0
            ? { ...base(), alunos: base().alunos.map((a) => ({ ...a, notas: a.notas.filter((n) => ids.includes(n.simulado_id)) })) }
            : base(),
        ),
      );
    });

    it('mostra cards, chips de simulado e "–" (fora da média) para nota ausente', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(screen.queryByText(/Os simulados ainda não chegam aqui/)).not.toBeInTheDocument();
      expect(screen.getByText('Possível aprovação').parentElement).toHaveTextContent('33,3%');
      expect(screen.getByText('Acerto médio no último simulado')).toBeInTheDocument();
      expect(screen.getByText('Participação no último simulado')).toBeInTheDocument();
      expect(screen.getByText('fizeram 1 de 3')).toBeInTheDocument();
      // Bruno não fez o Simulado 2: "–", nunca 0%.
      const linhaBruno = screen.getByRole('button', { name: 'Bruno Ativo' }).closest('tr') as HTMLElement;
      const celulas = within(linhaBruno).getAllByRole('cell');
      expect(celulas[3]).toHaveTextContent('50%');
      expect(celulas[4].textContent).toBe('–');
      expect(linhaBruno).toHaveTextContent('-30 p.p.');
      // A média do Simulado 2 conta só quem fez (70), não (70 + 0) / 2.
      expect(screen.getByTestId('media-2')).toHaveTextContent('70%');
      expect(screen.getByTestId('media-1')).toHaveTextContent('55%');
    });

    it('"precisa de Metas" só aparece quando há alunos sem meta', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(screen.queryByText(/precisa(m)? de Metas/)).not.toBeInTheDocument();
    });

    it('chips de simulado re-consultam com os ids escolhidos e "Todos" volta ao total', async () => {
      renderTurma();
      const grupo = await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(fetchDesempenhoTurma).toHaveBeenLastCalledWith();

      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 1' }));
      await waitFor(() => expect(fetchDesempenhoTurma).toHaveBeenLastCalledWith([SIM1]));
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 2' }));
      await waitFor(() => expect(fetchDesempenhoTurma).toHaveBeenLastCalledWith([SIM1, SIM2]));

      fireEvent.click(within(grupo).getByRole('button', { name: 'Todos' }));
      expect(within(grupo).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(grupo).getByRole('button', { name: 'Simulado 1' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('com um simulado escolhido só há a coluna dele', async () => {
      renderTurma();
      const grupo = await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(screen.getAllByRole('columnheader', { name: 'Simulado 2' })).toHaveLength(1);
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 1' }));
      await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Simulado 2' })).not.toBeInTheDocument());
      expect(screen.getByRole('columnheader', { name: 'Simulado 1' })).toBeInTheDocument();
    });

    it('filtra por situação', async () => {
      renderTurma();
      await screen.findByText('Alice Sumida', undefined, T);
      fireEvent.click(screen.getByRole('button', { name: /^Longe/ }));
      expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
    });

    it('?filtro=nao_fez mostra o chip "vindo da home" e só quem não fez o último', async () => {
      renderTurma('/mentor/turma?filtro=nao_fez');
      expect(await screen.findByText(/Não fizeram o último simulado \(vindo da home\)/, undefined, T)).toBeInTheDocument();
      expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
      expect(screen.getByText('Carla Fria')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Remover filtro Não fizeram/ }));
      expect(screen.queryByText(/vindo da home/)).not.toBeInTheDocument();
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
    });

    it('?filtro=estagnado filtra pelos estagnados', async () => {
      renderTurma('/mentor/turma?filtro=estagnado');
      expect(await screen.findByText('Bruno Ativo', undefined, T)).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
      expect(screen.queryByText('Carla Fria')).not.toBeInTheDocument();
    });

    it('mostra "precisa de Metas" quando há alunos sem meta', async () => {
      fetchDesempenhoTurma.mockResolvedValue(
        desempenho(
          [
            desempAluno({ email: 'a@x.com', notas: [nota(SIM1, 1, 60)], situacao: 'sem_meta', fez_ultimo: true }),
            desempAluno({ email: 'b@x.com', notas: [nota(SIM1, 1, 50)], situacao: 'longe', corte_mais_dificil: 80, vs_corte_pp: -30 }),
          ],
          { possivel_aprovacao_pct: 0, participacao_ultimo: { simulado_id: SIM1, fizeram: 2, total: 3 } },
        ),
      );
      renderTurma();
      expect(await screen.findByText(/1 aluno sem meta precisa de Metas/, undefined, T)).toBeInTheDocument();
    });
  });

  it('?filtro=nao_fez é ignorado quando não há dados de simulado (layout de hoje)', async () => {
    renderTurma('/mentor/turma?filtro=nao_fez');
    expect(await screen.findByText('Alice Sumida', undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
    expect(screen.queryByText(/vindo da home/)).not.toBeInTheDocument();
  });

  it('mostra erro dos simulados com retry sem esconder a turma', async () => {
    fetchDesempenhoTurma.mockRejectedValue(new Error('boom'));
    renderTurma();
    expect(await screen.findByText(/Não foi possível carregar os simulados\./, undefined, T)).toBeInTheDocument();
    expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
  });
});
