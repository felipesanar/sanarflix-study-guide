import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DesempenhoTurma } from '@/services/mentor/desempenho';
import {
  comSegmento,
  desempAluno,
  desempAlunoNulos,
  desempenho,
  nota,
  SEM_DESEMPENHO,
  SIM1,
  SIM2,
  SIM3,
} from './fixtures';

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

  it('não mostra "Os simulados ainda não chegam aqui" enquanto a consulta de simulados carrega', async () => {
    fetchDesempenhoTurma.mockReturnValue(new Promise(() => undefined));
    renderTurma();
    expect(await screen.findByTestId('simulados-carregando', undefined, T)).toBeInTheDocument();
    expect(await screen.findByTestId('turma-carregando', undefined, T)).toBeInTheDocument();
    expect(screen.queryByText(/Os simulados ainda não chegam aqui/)).not.toBeInTheDocument();
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
    /**
     * 5 alunos, 3 simulados. Corte 70 para todos menos o Diego (sem meta).
     * Por padrão o Simulado 3 está ABERTO: só 1 e 2 estão encerrados.
     *   Alice  60 / 80 / 90  -> em variação
     *   Bruno  80 / 75 / –   -> constantemente acima
     *   Carla  50 / 60 / –   -> constantemente abaixo
     *   Diego  90 / 85 / –   -> sem meta -> sem histórico
     *   Eva    – / – / –     -> sem histórico
     */
    const NOTAS: Record<string, [number, number][]> = {
      'a@x.com': [[1, 60], [2, 80], [3, 90]],
      'b@x.com': [[1, 80], [2, 75]],
      'c@x.com': [[1, 50], [2, 60]],
      'd@x.com': [[1, 90], [2, 85]],
      'e@x.com': [],
    };
    const IDS: Record<number, string> = { 1: SIM1, 2: SIM2, 3: SIM3 };
    const CORTES: Record<string, number | null> = {
      'a@x.com': 70, 'b@x.com': 70, 'c@x.com': 70, 'd@x.com': null, 'e@x.com': 70,
    };

    /** Imita a RPC: recorta as notas e devolve o último simulado ENCERRADO dentro do recorte. */
    function rpc(encerrados: string[], over?: { alerta?: Record<string, { regrediu?: boolean; estagnado?: boolean }> }) {
      return (ids?: string[]): DesempenhoTurma => {
        const escopo = ids && ids.length > 0 ? ids : null;
        const ultimoEnc = [3, 2, 1].map((n) => IDS[n]).find((id) => encerrados.includes(id) && (!escopo || escopo.includes(id))) ?? null;
        const alunos = Object.entries(NOTAS).map(([email, notas]) => {
          const doEscopo = notas.filter(([n]) => !escopo || escopo.includes(IDS[n]));
          return desempAluno({
            email,
            notas: doEscopo.map(([n, v]) => nota(IDS[n], n, v)),
            corte_mais_dificil: CORTES[email],
            situacao: CORTES[email] === null ? 'sem_meta' : doEscopo.length === 0 ? 'sem_simulado' : 'proximo',
            vs_corte_pp: doEscopo.length > 0 && CORTES[email] !== null ? -2 : null,
            // alertas só existem no cálculo sem recorte; com recorte a RPC devolve null (poucas notas)
            regrediu: escopo ? null : (over?.alerta?.[email]?.regrediu ?? false),
            estagnado: escopo ? null : (over?.alerta?.[email]?.estagnado ?? false),
            fez_ultimo: ultimoEnc ? doEscopo.some(([n]) => IDS[n] === ultimoEnc) : null,
          });
        });
        return desempenho(alunos, {
          participacao_ultimo: {
            simulado_id: ultimoEnc,
            fizeram: alunos.filter((a) => a.fez_ultimo).length,
            total: alunos.length,
          },
        });
      };
    }

    const cardAtual = (id: string) => screen.getByTestId(`${id}-atual`);

    beforeEach(() => {
      fetchTurma.mockResolvedValue([
        comSegmento('a@x.com', 'Alice Sumida', 'sumido', 14),
        comSegmento('b@x.com', 'Bruno Ativo', 'ativo', 2),
        comSegmento('c@x.com', 'Carla Fria', 'esfriando', 8),
        comSegmento('d@x.com', 'Diego Ativo', 'ativo', 1),
        comSegmento('e@x.com', 'Eva Nova', 'sem_dado', null),
      ]);
      fetchDesempenhoTurma.mockImplementation((ids?: string[]) =>
        Promise.resolve(rpc([SIM1, SIM2])(ids)),
      );
    });

    it('mostra os 4 cards: Atual vem do último encerrado, com Anterior e rótulos "Simulado N"', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(screen.queryByText(/Os simulados ainda não chegam aqui/)).not.toBeInTheDocument();
      expect(screen.getByText('Possível aprovação')).toBeInTheDocument();
      expect(screen.getByText('Acerto médio no último simulado')).toBeInTheDocument();
      expect(screen.getByText('Questões na semana')).toBeInTheDocument();
      expect(screen.getByText('Participação no último simulado')).toBeInTheDocument();
      // O Simulado 3 está aberto: o "Atual" é o 2 (último encerrado), nunca valores do 3 sob o rótulo do 2.
      // Possível aprovação no Simulado 2: Alice 80, Bruno 75 acima; Carla 60 abaixo (Diego sem corte fica fora) -> 2/3.
      expect(cardAtual('card-aprovacao')).toHaveTextContent('66,7%');
      expect(screen.getByTestId('card-aprovacao')).toHaveTextContent('Atual: Simulado 2');
      expect(screen.getByTestId('card-aprovacao-anterior')).toHaveTextContent('Anterior: Simulado 1');
      expect(screen.getByTestId('card-aprovacao-anterior')).toHaveTextContent('33,3%'); // só Bruno (80) de Alice 60, Bruno 80, Carla 50
      // Primeiro coincide com Anterior (recorte de 3, mas Atual = 2): some.
      expect(screen.queryByTestId('card-aprovacao-primeiro')).not.toBeInTheDocument();
      // Acerto médio: Simulado 2 = (80 + 75 + 60 + 85) / 4 = 75; Simulado 1 = (60 + 80 + 50 + 90) / 4 = 70.
      expect(cardAtual('card-acerto')).toHaveTextContent('75%');
      expect(screen.getByTestId('card-acerto-anterior')).toHaveTextContent('Simulado 1');
      expect(screen.getByTestId('card-acerto-anterior')).toHaveTextContent('70%');
      // Participação: 4 de 5 nos dois.
      expect(cardAtual('card-participacao')).toHaveTextContent('80%');
      expect(screen.getByTestId('card-participacao')).toHaveTextContent('fizeram 4 de 5');
      expect(screen.getByTestId('card-participacao-anterior')).toHaveTextContent('Simulado 1');
      // Questões na semana: ainda sem dado B2C.
      expect(screen.getByTestId('card-questoes')).toHaveTextContent('–');
      expect(screen.getByTestId('card-questoes')).toHaveTextContent('chega com os dados de engajamento');
    });

    it('sem nenhum simulado encerrado, Atual = último com nota, "em andamento", com Anterior e Primeiro', async () => {
      fetchDesempenhoTurma.mockImplementation((ids?: string[]) => Promise.resolve(rpc([])(ids)));
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(screen.getByTestId('card-acerto')).toHaveTextContent('Atual: Simulado 3 · em andamento');
      expect(cardAtual('card-acerto')).toHaveTextContent('90%');
      expect(screen.getByTestId('card-acerto-anterior')).toHaveTextContent('Anterior: Simulado 2');
      expect(screen.getByTestId('card-acerto-anterior')).toHaveTextContent('75%');
      expect(screen.getByTestId('card-acerto-primeiro')).toHaveTextContent('Primeiro: Simulado 1');
      expect(screen.getByTestId('card-acerto-primeiro')).toHaveTextContent('70%');
      // Participação no 3: só a Alice fez (1 de 5 = 20%); Possível aprovação: Alice 90 >= 70 -> 100%.
      expect(cardAtual('card-participacao')).toHaveTextContent('20%');
      expect(cardAtual('card-aprovacao')).toHaveTextContent('100%');
      expect(screen.getByTestId('card-aprovacao-anterior')).toHaveTextContent('66,7%');
      expect(screen.getByTestId('card-aprovacao-primeiro')).toHaveTextContent('33,3%');
    });

    it('o recorte vale para a tela toda: cards, segmentos e colunas', async () => {
      renderTurma();
      const grupo = await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 3' }));
      // Recorte só com o aberto: nenhum encerrado -> Atual = Simulado 3 em andamento, sem Anterior/Primeiro.
      await waitFor(() =>
        expect(screen.getByTestId('card-acerto')).toHaveTextContent('Atual: Simulado 3 · em andamento'),
      );
      expect(cardAtual('card-acerto')).toHaveTextContent('90%');
      expect(screen.queryByTestId('card-acerto-anterior')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-acerto-primeiro')).not.toBeInTheDocument();
      // Colunas: só o Simulado 3.
      expect(screen.getByRole('columnheader', { name: 'Simulado 3' })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Simulado 1' })).not.toBeInTheDocument();
      // Segmentos: com uma nota só ninguém tem histórico.
      const segs = screen.getByRole('group', { name: 'Segmentos por histórico' });
      expect(within(segs).getByRole('button', { name: /^Sem histórico 5/ })).toBeInTheDocument();
      expect(within(segs).getByRole('button', { name: /^Em variação 0/ })).toBeInTheDocument();
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

    it('mostra "–" (fora da média) para nota ausente e média só de quem fez', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      const linhaBruno = screen.getByRole('button', { name: 'Bruno Ativo' }).closest('tr') as HTMLElement;
      const celulas = within(linhaBruno).getAllByRole('cell');
      expect(celulas[3]).toHaveTextContent('80%');
      expect(celulas[5].textContent).toBe('–'); // Simulado 3
      expect(linhaBruno).toHaveTextContent('-2 p.p.');
      // Média do Simulado 3 = só a Alice (90), não (90 + 0...) / 5.
      expect(screen.getByTestId('media-3')).toHaveTextContent('90%');
      expect(screen.getByTestId('media-2')).toHaveTextContent('75%');
    });

    it('mostra a contagem em cada segmento e filtra a tabela', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      const segs = screen.getByRole('group', { name: 'Segmentos por histórico' });
      expect(within(segs).getByRole('button', { name: 'Todos 5' })).toBeInTheDocument();
      expect(within(segs).getByRole('button', { name: 'Constantemente acima do corte 1' })).toBeInTheDocument();
      expect(within(segs).getByRole('button', { name: 'Em variação 1' })).toBeInTheDocument();
      expect(within(segs).getByRole('button', { name: 'Constantemente abaixo 1' })).toBeInTheDocument();
      expect(within(segs).getByRole('button', { name: 'Sem histórico 2' })).toBeInTheDocument();

      fireEvent.click(within(segs).getByRole('button', { name: /^Constantemente acima do corte/ }));
      expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
      expect(screen.queryByText('Carla Fria')).not.toBeInTheDocument();

      fireEvent.click(within(segs).getByRole('button', { name: /^Sem histórico/ }));
      expect(screen.getByText('Diego Ativo')).toBeInTheDocument();
      expect(screen.getByText('Eva Nova')).toBeInTheDocument();
      expect(screen.queryByText('Bruno Ativo')).not.toBeInTheDocument();

      fireEvent.click(within(segs).getByRole('button', { name: /^Todos/ }));
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
    });

    it('os segmentos seguem as notas do recorte', async () => {
      renderTurma();
      const grupo = await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      // Só Simulados 2 e 3: Alice (80, 90) passa a "constantemente acima".
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 2' }));
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 3' }));
      await waitFor(() => expect(fetchDesempenhoTurma).toHaveBeenLastCalledWith([SIM2, SIM3]));
      const segs = screen.getByRole('group', { name: 'Segmentos por histórico' });
      // Bruno (só o Simulado 2 no recorte) e Carla ficam sem histórico; ninguém em variação.
      await waitFor(() => expect(within(segs).getByRole('button', { name: 'Em variação 0' })).toBeInTheDocument());
      expect(within(segs).getByRole('button', { name: 'Constantemente acima do corte 1' })).toBeInTheDocument();
      fireEvent.click(within(segs).getByRole('button', { name: /^Constantemente acima do corte/ }));
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
      expect(screen.queryByText('Bruno Ativo')).not.toBeInTheDocument();
    });

    it('"Ver os N que não fizeram" filtra para quem não tem nota no Atual', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      // Atual = Simulado 2: só a Eva não fez.
      fireEvent.click(screen.getByRole('button', { name: 'Ver os 1 que não fizeram' }));
      expect(screen.getByText('Eva Nova')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
      expect(screen.getByText(/Filtro: não fizeram o Simulado 2/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Remover filtro de quem não fez/ }));
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
    });

    it('"precisa de Metas" aparece quando há alunos sem meta', async () => {
      renderTurma();
      await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      expect(screen.getByText(/1 aluno sem meta precisa de Metas/)).toBeInTheDocument();
    });

    it('?filtro=nao_fez mostra o chip "vindo da home" e só quem não fez o último', async () => {
      renderTurma('/mentor/turma?filtro=nao_fez');
      expect(await screen.findByText(/Não fizeram o último simulado \(vindo da home\)/, undefined, T)).toBeInTheDocument();
      expect(screen.getByText('Eva Nova')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
      expect(screen.queryByText('Bruno Ativo')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Remover filtro Não fizeram/ }));
      expect(screen.queryByText(/vindo da home/)).not.toBeInTheDocument();
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
    });

    it('o alerta vindo da home não esvazia quando os chips de simulado mudam', async () => {
      fetchDesempenhoTurma.mockImplementation((ids?: string[]) =>
        Promise.resolve(rpc([SIM1, SIM2], { alerta: { 'c@x.com': { regrediu: true } } })(ids)),
      );
      renderTurma('/mentor/turma?filtro=regrediu');
      expect(await screen.findByText(/Regrediram \(vindo da home\)/, undefined, T)).toBeInTheDocument();
      expect(screen.getByText('Carla Fria')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();

      // Com recorte, a RPC devolve regrediu = null para todos; o alerta continua valendo (dados sem recorte).
      const grupo = screen.getByRole('group', { name: 'Filtro de simulados' });
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 1' }));
      await waitFor(() => expect(fetchDesempenhoTurma).toHaveBeenLastCalledWith([SIM1]));
      await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Simulado 1' })).toBeInTheDocument());
      expect(screen.getByText('Carla Fria')).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
      expect(screen.queryByText(/Nenhum aluno encontrado/)).not.toBeInTheDocument();

      fireEvent.click(within(grupo).getByRole('button', { name: 'Todos' }));
      expect(screen.getByText('Carla Fria')).toBeInTheDocument();
    });

    it('?filtro=estagnado filtra pelos estagnados', async () => {
      fetchDesempenhoTurma.mockImplementation((ids?: string[]) =>
        Promise.resolve(rpc([SIM1, SIM2], { alerta: { 'd@x.com': { estagnado: true } } })(ids)),
      );
      renderTurma('/mentor/turma?filtro=estagnado');
      expect(await screen.findByText('Diego Ativo', undefined, T)).toBeInTheDocument();
      expect(screen.queryByText('Alice Sumida')).not.toBeInTheDocument();
      expect(screen.queryByText('Carla Fria')).not.toBeInTheDocument();
    });

    it('regrediu/estagnado nulos não quebram a tela nem contam como alerta', async () => {
      fetchTurma.mockResolvedValue([comSegmento('a@x.com', 'Alice Sumida', 'sumido', 14)]);
      fetchDesempenhoTurma.mockResolvedValue(
        desempenho([desempAlunoNulos({ email: 'a@x.com', notas: [nota(SIM1, 1, 60)], corte_mais_dificil: 70 })], {
          participacao_ultimo: { simulado_id: SIM1, fizeram: 1, total: 1 },
        }),
      );
      renderTurma('/mentor/turma?filtro=regrediu');
      expect(await screen.findByText(/Regrediram \(vindo da home\)/, undefined, T)).toBeInTheDocument();
      expect(await screen.findByText(/Nenhum aluno encontrado com esses filtros/, undefined, T)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Remover filtro Regrediram/ }));
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
    });

    it('mantém a tabela enquanto o recorte carrega (sem piscar)', async () => {
      renderTurma();
      const grupo = await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      let resolver: (d: DesempenhoTurma) => void = () => undefined;
      fetchDesempenhoTurma.mockImplementation(
        () => new Promise<DesempenhoTurma>((r) => { resolver = r; }),
      );
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 1' }));
      expect(await screen.findByText('Carregando os simulados escolhidos…', undefined, T)).toBeInTheDocument();
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
      expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
      resolver(rpc([SIM1, SIM2])([SIM1]));
      await waitFor(() => expect(screen.queryByText('Carregando os simulados escolhidos…')).not.toBeInTheDocument());
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
    });

    it('erro no recorte mostra aviso com retry acima da tabela, que continua visível', async () => {
      renderTurma();
      const grupo = await screen.findByRole('group', { name: 'Filtro de simulados' }, T);
      fetchDesempenhoTurma.mockImplementation((ids?: string[]) =>
        ids ? Promise.reject(new Error('boom')) : Promise.resolve(rpc([SIM1, SIM2])()),
      );
      fireEvent.click(within(grupo).getByRole('button', { name: 'Simulado 1' }));
      expect(await screen.findByText(/Não foi possível carregar os simulados escolhidos/, undefined, T)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
      expect(screen.getByText('Alice Sumida')).toBeInTheDocument();
      expect(screen.getByText('Bruno Ativo')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Simulado 1' })).toBeInTheDocument();
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
