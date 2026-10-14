import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AlunoDesempenho, Detalhamento as DetalhamentoDados, DesempenhoTurma } from '@/services/mentor/desempenho';

const fetchDesempenhoTurma = vi.fn();
const fetchDetalhamento = vi.fn();
vi.mock('@/services/mentor/desempenho', () => ({
  fetchDesempenhoTurma: (s?: string[]) => fetchDesempenhoTurma(s),
  fetchDetalhamento: (s: string[]) => fetchDetalhamento(s),
  fetchAlunoNotas: vi.fn(),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import Detalhamento from '@/features/mentor/routes/Detalhamento';

function alunoDes(email: string, nome: string, notas: [string, number, number][]): AlunoDesempenho {
  return {
    email,
    nome,
    notas: notas.map(([simulado_id, sequence_number, acerto_pct]) => ({
      simulado_id,
      sequence_number,
      acerto_pct,
      finalizada_em: `2026-0${sequence_number}-10T12:00:00Z`,
    })),
    ultimo_acerto: null,
    corte_mais_dificil: null,
    vs_corte_pp: null,
    situacao: 'sem_meta',
    regrediu: false,
    estagnado: false,
    fez_ultimo: true,
  };
}

const TURMA: DesempenhoTurma = {
  alunos: [
    alunoDes('a@x.com', 'Ana Souza', [['s1', 1, 60], ['s2', 2, 70]]),
    alunoDes('b@x.com', 'Bruno Lima', [['s1', 1, 50], ['s2', 2, 64]]),
    alunoDes('c@x.com', 'Carla Dias', [['s1', 1, 55]]),
  ],
  possivel_aprovacao_pct: 40,
  acerto_medio_ultimo: 67,
  participacao_ultimo: { simulado_id: 's2', fizeram: 2, total: 3 },
};

const DETALHE: DetalhamentoDados = {
  areas: [
    {
      grande_area: 'Clínica Médica',
      acerto_pct: 58,
      respostas: 40,
      temas: [
        { tema: 'Hipertensão', acerto_pct: 72, respostas: 20 },
        { tema: 'Diabetes', acerto_pct: 44, respostas: 20 },
      ],
    },
    { grande_area: 'Pediatria', acerto_pct: 81, respostas: 30, temas: [{ tema: 'Vacinas', acerto_pct: 81, respostas: 30 }] },
  ],
  questoes: [
    {
      questao_id: 'q1',
      numero: 1,
      sequence_number: 2,
      grande_area: 'Clínica Médica',
      tema: 'Hipertensão',
      correta_label: 'A',
      acerto_pct: 90,
      respostas: 10,
      distribuicao: { A: 9, B: 1 },
      emails: { B: ['b@x.com'] },
    },
    {
      questao_id: 'q2',
      numero: 2,
      sequence_number: 2,
      grande_area: 'Clínica Médica',
      tema: 'Diabetes',
      correta_label: 'A',
      acerto_pct: 30,
      respostas: 10,
      distribuicao: { A: 3, B: 1, C: 5, D: 1 },
      emails: { B: ['b@x.com'], C: ['a@x.com', 'c@x.com'], D: ['x@x.com'] },
    },
    {
      questao_id: 'q3',
      numero: 3,
      sequence_number: 2,
      grande_area: 'Pediatria',
      tema: 'Vacinas',
      correta_label: 'B',
      acerto_pct: 60,
      respostas: 10,
      distribuicao: { A: 2, B: 6, C: 2 },
      emails: { A: ['a@x.com'], C: ['c@x.com'] },
    },
  ],
};

function renderPagina() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mentor/detalhamento']}>
        <Detalhamento />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const T = { timeout: 3000 };

/** Números das questões na ordem em que aparecem na lista. */
function ordemQuestoes(): string[] {
  return screen
    .getAllByRole('button', { name: /^Abrir questão \d+/ })
    .map((b) => /^Abrir questão (\d+)/.exec(b.getAttribute('aria-label') ?? '')?.[1] ?? '');
}

describe('Detalhamento por simulados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    fetchDesempenhoTurma.mockResolvedValue(TURMA);
    fetchDetalhamento.mockResolvedValue(DETALHE);
  });

  it('seleciona por padrão o simulado mais recente e busca o detalhamento dele', async () => {
    renderPagina();
    expect((await screen.findAllByText('Hipertensão', undefined, T)).length).toBeGreaterThan(0);
    expect(fetchDetalhamento).toHaveBeenCalledTimes(1);
    expect(fetchDetalhamento).toHaveBeenCalledWith(['s2']);
    expect(screen.getByRole('button', { name: 'Remover Simulado 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Simulado 1' })).toBeNull();
  });

  it('com a seleção vazia mostra o convite para escolher e não busca o detalhamento', async () => {
    renderPagina();
    await screen.findByRole('button', { name: 'Remover Simulado 2' }, T);
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(await screen.findByText(/Escolha ao menos um simulado/i)).toBeInTheDocument();
    expect(screen.queryByText('Hipertensão')).toBeNull();
    expect(fetchDetalhamento).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Adicionar outro' })).toBeInTheDocument();
  });

  it('adicionar outro simulado refaz a busca com os dois e mostra o comparativo', async () => {
    renderPagina();
    await screen.findByRole('button', { name: 'Remover Simulado 2' }, T);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outro' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Simulado 1/ }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2']));
    expect((await screen.findAllByText(/vs\. Simulado 1/, undefined, T)).length).toBeGreaterThan(0);
  });

  it('"Mais erradas" ordena do menor % de acerto para o maior', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Abrir questão/ }, T);
    expect(ordemQuestoes()).toEqual(['1', '2', '3']);
    fireEvent.click(screen.getByRole('button', { name: 'Mais erradas' }));
    expect(ordemQuestoes()).toEqual(['2', '3', '1']);
    fireEvent.click(screen.getByRole('button', { name: 'Mais acertadas' }));
    expect(ordemQuestoes()).toEqual(['1', '3', '2']);
  });

  it('filtra as questões por grande área', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Abrir questão/ }, T);
    fireEvent.change(screen.getByLabelText('Filtrar por grande área'), { target: { value: 'Pediatria' } });
    expect(ordemQuestoes()).toEqual(['3']);
  });

  it('abrir a questão mostra o distrator dominante e o "Mensagem pra quem marcou C" leva ao mural com os e-mails', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Abrir questão/ }, T);
    fireEvent.click(screen.getByRole('button', { name: /^Abrir questão 2/ }));
    const painel = await screen.findByRole('dialog');
    expect(within(painel).getByTestId('alternativa-C')).toHaveTextContent(/Distrator dominante/i);
    expect(within(painel).getByTestId('alternativa-A')).toHaveTextContent(/Gabarito/i);
    expect(within(painel).getByTestId('alternativa-B')).not.toHaveTextContent(/Distrator dominante/i);
    expect(within(painel).getByText('Ana Souza')).toBeInTheDocument();

    fireEvent.click(within(painel).getByRole('button', { name: 'Mensagem pra quem marcou C' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const url = new URL(navigate.mock.calls[0][0] as string, 'http://x');
    expect(url.pathname).toBe('/mentor/mural');
    expect(url.searchParams.get('para')).toBe('a@x.com,c@x.com');
    expect(JSON.parse(window.sessionStorage.getItem('mentor.mural.para') ?? '[]')).toEqual(['a@x.com', 'c@x.com']);
  });

  it('"Criar intervenção" leva às intervenções com o primeiro aluno', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Abrir questão/ }, T);
    fireEvent.click(screen.getByRole('button', { name: /^Abrir questão 2/ }));
    const painel = await screen.findByRole('dialog');
    fireEvent.click(within(painel).getByRole('button', { name: 'Criar intervenção — quem marcou C' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const url = new URL(navigate.mock.calls[0][0] as string, 'http://x');
    expect(url.pathname).toBe('/mentor/intervencoes');
    expect(url.searchParams.get('novo')).toBe('1');
    expect(url.searchParams.get('aluno')).toBe('a@x.com');
  });

  it('"Detalhar" na grande área abre o painel com os temas e o nº de respostas, sem nota de corte', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Abrir questão/ }, T);
    const linha = screen.getByTestId('area-Clínica Médica');
    fireEvent.click(within(linha).getByRole('button', { name: /Detalhar/ }));
    const painel = await screen.findByRole('dialog');
    expect(within(painel).getByText('Diabetes')).toBeInTheDocument();
    expect(within(painel).getByText('44%')).toBeInTheDocument();
    expect(within(painel).getAllByText(/20 respostas/).length).toBe(2);
    expect(within(painel).queryByText(/corte/i)).toBeNull();
  });

  it('mostra erro com "Tentar de novo" quando o detalhamento falha', async () => {
    fetchDetalhamento.mockRejectedValueOnce(new Error('boom'));
    renderPagina();
    expect(await screen.findByRole('alert', undefined, T)).toBeInTheDocument();
    fetchDetalhamento.mockResolvedValue(DETALHE);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect((await screen.findAllByRole('button', { name: /^Abrir questão/ }, T)).length).toBe(3);
  });

  it('sem nenhum simulado com dados mostra o estado vazio', async () => {
    fetchDesempenhoTurma.mockResolvedValue({ ...TURMA, alunos: [] });
    renderPagina();
    expect(await screen.findByText(/Ainda não há simulados/i, undefined, T)).toBeInTheDocument();
    expect(fetchDetalhamento).not.toHaveBeenCalled();
  });
});
