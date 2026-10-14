import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AlunoDesempenho, Detalhamento as DetalhamentoDados, DesempenhoTurma } from '@/services/mentor/desempenho';

const fetchDesempenhoTurma = vi.fn();
const fetchDetalhamento = vi.fn();
vi.mock('@/services/mentor/desempenho', async () => ({
  ...(await vi.importActual<typeof import('@/services/mentor/desempenho')>('@/services/mentor/desempenho')),
  fetchDesempenhoTurma: (s?: string[]) => fetchDesempenhoTurma(s),
  fetchDetalhamento: (s: string[]) => fetchDetalhamento(s),
  fetchAlunoNotas: vi.fn(),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const fetchTurma = vi.fn();
vi.mock('@/services/mentor/turma', () => ({ fetchTurma: () => fetchTurma() }));
vi.mock('@/services/mentor/contexto', () => ({
  fetchMentorContexto: () =>
    Promise.resolve({ mentor: { user_id: 'mentor-1', nome: 'Ana', tipo: 'b2c' }, alunos_ativos: 3 }),
}));
vi.mock('@/services/mentor/mural', () => ({
  salvarPost: vi.fn(),
  listarPosts: () => Promise.resolve([]),
  listarTags: () => Promise.resolve([]),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn() }) } },
}));

import Detalhamento from '@/features/mentor/routes/Detalhamento';
import Mural from '@/features/mentor/routes/Mural';
import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';

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
    .getAllByRole('button', { name: /^Q\d+/ })
    .map((b) => /^Q(\d+)/.exec(b.textContent ?? '')?.[1] ?? '');
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
    expect(screen.getByRole('button', { name: 'Simulado 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Simulado 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('nunca fica com seleção vazia: o último simulado marcado não desmarca e não refaz a busca', async () => {
    renderPagina();
    const s2 = await screen.findByRole('button', { name: 'Simulado 2' }, T);
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenCalledTimes(1));
    fireEvent.click(s2);
    expect(s2).toHaveAttribute('aria-pressed', 'true');
    expect(fetchDetalhamento).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Escolha ao menos um simulado/i)).toBeNull();
    expect(fetchDetalhamento).not.toHaveBeenCalledWith([]);
  });

  it('marcar outro simulado refaz a busca com os dois e mostra o comparativo', async () => {
    renderPagina();
    await screen.findByRole('button', { name: 'Simulado 2' }, T);
    fireEvent.click(screen.getByRole('button', { name: 'Simulado 1' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2']));
    expect((await screen.findAllByText(/vs\. Simulado 1/, undefined, T)).length).toBeGreaterThan(0);
    // Com 2 marcados dá para desmarcar um; "Todos" marca todos.
    fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1']));
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2']));
  });

  it('"Mais erradas" ordena do menor % de acerto para o maior', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    expect(ordemQuestoes()).toEqual(['1', '2', '3']);
    fireEvent.click(screen.getByRole('button', { name: 'Mais erradas' }));
    expect(ordemQuestoes()).toEqual(['2', '3', '1']);
    fireEvent.click(screen.getByRole('button', { name: 'Mais acertadas' }));
    expect(ordemQuestoes()).toEqual(['1', '3', '2']);
  });

  it('filtra as questões por grande área', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    fireEvent.change(screen.getByLabelText('Filtrar por grande área'), { target: { value: 'Pediatria' } });
    expect(ordemQuestoes()).toEqual(['3']);
  });

  it('abrir a questão mostra o distrator dominante e o "Mensagem pra quem marcou C" leva ao mural com os e-mails', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    fireEvent.click(screen.getByRole('button', { name: /^Q2(?![0-9])/ }));
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
    // Um único mecanismo: a URL. Nada vai para o sessionStorage.
    expect(window.sessionStorage.getItem('mentor.mural.para')).toBeNull();
  });

  it('"Criar intervenção" leva às intervenções com todos os alunos em ?alunos=', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    fireEvent.click(screen.getByRole('button', { name: /^Q2(?![0-9])/ }));
    const painel = await screen.findByRole('dialog');
    fireEvent.click(within(painel).getByRole('button', { name: 'Criar intervenção — quem marcou C' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const url = new URL(navigate.mock.calls[0][0] as string, 'http://x');
    expect(url.pathname).toBe('/mentor/intervencoes');
    expect(url.searchParams.get('novo')).toBe('1');
    expect(url.searchParams.get('alunos')).toBe('a@x.com,c@x.com');
    expect(url.searchParams.has('aluno')).toBe(false);
  });

  it('"Detalhar" na grande área abre o painel com os temas e o nº de respostas, sem nota de corte', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
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
    expect((await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T)).length).toBe(3);
  });

  it('sem nenhum simulado com dados mostra o estado vazio', async () => {
    fetchDesempenhoTurma.mockResolvedValue({ ...TURMA, alunos: [] });
    renderPagina();
    expect(await screen.findByText(/Ainda não há simulados/i, undefined, T)).toBeInTheDocument();
    expect(fetchDetalhamento).not.toHaveBeenCalled();
  });

  it('trocar a seleção de simulados reseta o filtro de área e a paginação da lista', async () => {
    renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    fireEvent.change(screen.getByLabelText('Filtrar por grande área'), { target: { value: 'Pediatria' } });
    expect(ordemQuestoes()).toEqual(['3']);
    fireEvent.click(screen.getByRole('button', { name: 'Simulado 1' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2']));
    await waitFor(() =>
      expect((screen.getByLabelText('Filtrar por grande área') as HTMLSelectElement).value).toBe('todas'),
    );
    expect(ordemQuestoes()).toEqual(['1', '2', '3']);
  });

  it('o botão da questão fala o conteúdo (tema e % de acerto), sem aria-label que o esconda', async () => {
    renderPagina();
    const botoes = await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    for (const b of botoes) expect(b).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('button', { name: /^Q2.*Diabetes.*30%/ })).toBeInTheDocument();
  });

  it('nunca chama as RPCs de recorte com lista vazia, mesmo tentando desmarcar tudo', async () => {
    renderPagina();
    await screen.findByRole('button', { name: 'Simulado 2' }, T);
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2']));
    fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
    await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1']));
    fireEvent.click(screen.getByRole('button', { name: 'Simulado 1' }));
    expect(screen.getByRole('button', { name: 'Simulado 1' })).toHaveAttribute('aria-pressed', 'true');
    for (const [sel] of fetchDetalhamento.mock.calls) expect(sel.length).toBeGreaterThan(0);
    for (const [sel] of fetchDesempenhoTurma.mock.calls) {
      if (sel !== undefined) expect(sel.length).toBeGreaterThan(0);
    }
  });

  describe('indicadores por simulado', () => {
    const al = (email: string, nome: string, corte: number | null, notas: [string, number, number][]) => ({
      ...alunoDes(email, nome, notas),
      corte_mais_dificil: corte,
    });
    const TURMA3: DesempenhoTurma = {
      alunos: [
        al('a@x.com', 'Ana Souza', 65, [['s1', 1, 60], ['s2', 2, 70], ['s3', 3, 80]]),
        al('b@x.com', 'Bruno Lima', 66, [['s1', 1, 50], ['s2', 2, 64]]),
        al('c@x.com', 'Carla Dias', null, [['s1', 1, 55], ['s3', 3, 40]]),
      ],
      possivel_aprovacao_pct: null,
      acerto_medio_ultimo: null,
      participacao_ultimo: { simulado_id: 's2', fizeram: 2, total: 3 },
    };
    /** Emula a RPC: s1 e s2 encerrados, s3 aberto. */
    const rpc = (ids?: string[]): DesempenhoTurma => {
      if (!ids) return TURMA3;
      const encerrados = ids.filter((i) => i === 's1' || i === 's2');
      return {
        alunos: TURMA3.alunos.map((a) => ({ ...a, notas: a.notas.filter((n) => ids.includes(n.simulado_id)) })),
        participacao_ultimo: {
          simulado_id: encerrados.length ? encerrados[encerrados.length - 1] : null,
          fizeram: 0,
          total: 3,
        },
        // Valores da RPC propositalmente absurdos: a tela não pode usá-los.
        acerto_medio_ultimo: 0,
        possivel_aprovacao_pct: 0,
      };
    };
    const indicadores = () => within(screen.getByRole('region', { name: 'Indicadores' }));

    beforeEach(() => {
      fetchDesempenhoTurma.mockImplementation(async (s?: string[]) => rpc(s));
    });

    it('com o simulado mais novo (aberto) selecionado, mostra os valores dele, rotulado "em andamento"', async () => {
      renderPagina();
      await screen.findByRole('region', { name: 'Indicadores' }, T);
      expect(fetchDetalhamento).toHaveBeenCalledWith(['s3']);
      const ind = indicadores();
      expect(ind.getByText('No Simulado 3 · em andamento')).toBeInTheDocument();
      expect(ind.getByText('60%')).toBeInTheDocument(); // (80 + 40) / 2
      expect(ind.getByText('2 de 3 alunos · Simulado 3 · em andamento')).toBeInTheDocument();
      expect(ind.getByText('66,7%')).toBeInTheDocument();
      expect(ind.getByText('1 de 1 aluno no corte da meta · Simulado 3 · em andamento')).toBeInTheDocument();
      expect(ind.queryByText(/vs\./)).toBeNull();
    });

    it('com um simulado encerrado, não marca "em andamento" e os valores são dele', async () => {
      renderPagina();
      await screen.findByRole('region', { name: 'Indicadores' }, T);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 3' }));
      await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2']));
      await waitFor(() => expect(indicadores().getByText('No Simulado 2')).toBeInTheDocument());
      expect(indicadores().getByText('67%')).toBeInTheDocument(); // (70 + 64) / 2
      expect(indicadores().getByText('1 de 2 alunos no corte da meta · Simulado 2')).toBeInTheDocument();
      expect(indicadores().getByText('50%')).toBeInTheDocument();
      expect(screen.queryByText(/em andamento/)).toBeNull();
    });

    it('com 1, 2 e 3 selecionados, Atual é o último encerrado (2) e o comparativo é vs. Simulado 1', async () => {
      renderPagina();
      await screen.findByRole('region', { name: 'Indicadores' }, T);
      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s1', 's2', 's3']));
      await waitFor(() => expect(indicadores().getByText('No Simulado 2')).toBeInTheDocument());
      expect(indicadores().getByText('67%')).toBeInTheDocument();
      // Simulado 1: acerto (60 + 50 + 55) / 3 = 55 (+12 p.p.); participação 100% -> 66,7% (-33,3 p.p.).
      expect(indicadores().getByText('+12 p.p. vs. Simulado 1')).toBeInTheDocument();
      expect(indicadores().getByText('−33,3 p.p. vs. Simulado 1')).toBeInTheDocument();
      expect(indicadores().queryByText(/vs\. Simulado 3/)).toBeNull();
    });

    it('com 2 e 3 selecionados, Atual é o 2 e não há comparativo (nada antes dele na seleção)', async () => {
      renderPagina();
      await screen.findByRole('region', { name: 'Indicadores' }, T);
      fireEvent.click(screen.getByRole('button', { name: 'Simulado 2' }));
      await waitFor(() => expect(fetchDetalhamento).toHaveBeenLastCalledWith(['s2', 's3']));
      await waitFor(() => expect(indicadores().getByText('No Simulado 2')).toBeInTheDocument());
      expect(indicadores().queryByText(/vs\./)).toBeNull();
    });
  });

  it('Detalhamento → "Mensagem pra quem marcou C" → Mural recebe todos os destinatários pelo href gerado', async () => {
    const { unmount } = renderPagina();
    await screen.findAllByRole('button', { name: /^Q[0-9]+/ }, T);
    fireEvent.click(screen.getByRole('button', { name: /^Q2(?![0-9])/ }));
    const painel = await screen.findByRole('dialog');
    fireEvent.click(within(painel).getByRole('button', { name: 'Mensagem pra quem marcou C' }));
    const href = navigate.mock.calls[0][0] as string;
    // A URL gerada, lida do mesmo jeito que o Mural a lê.
    const bruto = new URL(href, 'http://x').searchParams.get('para');
    expect(parseEmailsParam(bruto)).toEqual(['a@x.com', 'c@x.com']);

    unmount();
    const membro = (email: string, nome: string) => ({
      email,
      nome,
      telefone: null,
      semestre: 1,
      acesso_ate: null,
      b2b: false,
      academy_user_id: null,
      sanarflix_user_id: null,
      ultima_atividade: null,
      dias_sem_atividade: 0,
      segmento: 'ativo',
    });
    fetchTurma.mockResolvedValue([
      membro('a@x.com', 'Ana Souza'),
      membro('b@x.com', 'Bruno Lima'),
      membro('c@x.com', 'Carla Dias'),
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[href]}>
          <Mural />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Remover Ana Souza' }, T)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover Carla Dias' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Bruno Lima' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Publicar para 2 alunos' })).toBeInTheDocument();
  });
});
