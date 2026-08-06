import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// `@/test/utils` e não o `render` cru: o `DrawerAluno` que esta tabela abre
// termina no `AcoesRecorte`, que lê o recorte da URL (`useSearchParams`) e
// portanto exige um Router montado.
import { act, render, screen, userEvent, waitFor, within } from '@/test/utils';
import { TabelaAlunos } from '@/features/gestor/components/TabelaAlunos';
import { normalizarLinhaAluno, useAluno, useAlunos } from '@/features/gestor/api/queries';
import type { AlunoSimuladoEntry, FiltrosGestor, LinhaAluno, Meta } from '@/features/gestor/api/types';

// `useAlunos`/`useAluno` continuam mockados (todo o resto do arquivo depende
// disso), mas `normalizarLinhaAluno` passa pelo módulo REAL — é a função que
// os testes abaixo exercitam diretamente, mesmo padrão de `queries.test.tsx`
// para espiar `useQuery` sem perder o `@tanstack/react-query` de verdade.
vi.mock('@/features/gestor/api/queries', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/gestor/api/queries')>();
  // `useAlunoContato` precisa ser mockado mesmo não sendo assunto deste
  // arquivo: o `DrawerAluno` que a tabela abre passou a buscar o telefone por
  // conta própria (05/08), e o `...real` deixaria a busca de verdade rodar.
  // `useGestorContexto` também: o rodapé de ações do drawer (`AcoesRecorte`)
  // pergunta ao SERVIDOR se este gestor pode exportar, e o hook real cai em
  // `useAuth`, que não existe fora do provider da app. Aqui o gate responde
  // "não pode" — o comportamento das duas respostas é assunto de
  // `DrawerAluno.test.tsx`, não desta tabela.
  return {
    ...real,
    useAlunos: vi.fn(),
    useAluno: vi.fn(),
    useAlunoContato: vi.fn(() => ({ data: undefined, meta: null, isLoading: false, isError: false, refetch: () => {} })),
    useGestorContexto: vi.fn(() => ({
      data: { iesAtual: { id: 'ies-1', nome: 'Universidade Teste' }, iesDisponiveis: [], podeExportar: false },
      meta: null,
      isLoading: false,
      isError: false,
      refetch: () => {},
    })),
  };
});

const mockUseAlunos = vi.mocked(useAlunos);
const mockUseAluno = vi.mocked(useAluno);

const META: Meta = {
  periodo: '2026',
  fonte: 'get_gestor_alunos',
  atualizadoEm: '2026-08-04T10:00:00Z',
  criterio: 'alunos do recorte, paginados',
  partial: false,
  lowSample: false,
};

/**
 * a1: linha "normal", com grupo e todos os simulados respondidos.
 * a2: um simulado sem nota (proficiência ausente = TRACO, nunca 0).
 * a3: aluno provisionado sem NENHUM resultado de TRI ainda — `grupo: null` e
 *     `semestre: null` (achados 4 e 20 da revisão de 03/08). Não é "em
 *     variação": é grupo indefinido. TRACO, nunca a tag errada.
 */
const linhas: LinhaAluno[] = [
  {
    id: 'a1',
    nome: 'Ana Prado',
    semestre: 11,
    grupo: 'consistentemente_proficiente',
    proficiencias: [
      { simuladoId: 's1', valor: 64 },
      { simuladoId: 's2', valor: 68 },
      { simuladoId: 's3', valor: 71 },
    ],
    tendencia: 'subindo',
  },
  {
    id: 'a2',
    nome: 'Bruno Lima',
    semestre: 12,
    grupo: 'em_variacao',
    proficiencias: [
      { simuladoId: 's1', valor: 58 },
      { simuladoId: 's2', valor: null },
      { simuladoId: 's3', valor: 62 },
    ],
    tendencia: 'alternando',
  },
  {
    id: 'a3',
    nome: 'Carla Souza',
    semestre: null,
    grupo: null,
    proficiencias: [
      { simuladoId: 's1', valor: null },
      { simuladoId: 's2', valor: null },
      { simuladoId: 's3', valor: null },
    ],
    tendencia: 'estavel',
  },
];

const colunasSimulados = [
  { id: 's1', nome: 'Simulado 1' },
  { id: 's2', nome: 'Simulado 2' },
  { id: 's3', nome: 'Simulado 3' },
];

const recorte: FiltrosGestor = { iesId: 'ies-1', semestre: '6ano', simulados: [] };

function paginaResultado(over: Record<string, unknown> = {}) {
  return {
    data: { data: linhas, page: 1, pageSize: 25, total: 3, totalPages: 1 },
    meta: META,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useAlunos>;
}

const alunoNoSimulado: AlunoSimuladoEntry = {
  id: 'a1',
  nome: 'Ana Prado',
  semestre: 11,
  participou: true,
  acertos: 71,
  proficiencia: 71,
  situacao: 'proficiente',
  posicao: { lugar: 12, total: 118, percentil: 90 },
  acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 42, critica: true }],
  variacao: 3,
  simuladoId: 's1',
  simuladoNome: 'Simulado 1',
  simuladoData: '2026-03-10T12:00:00Z',
};

function alunoResultado(over: Record<string, unknown> = {}) {
  return {
    data: [alunoNoSimulado],
    meta: META,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useAluno>;
}

describe('TabelaAlunos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAlunos.mockReturnValue(paginaResultado());
    mockUseAluno.mockReturnValue(alunoResultado());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /**
   * Quatro colunas fixas, como a referência (`2.2fr 1fr 1.4fr 1.3fr`) — não uma
   * coluna POR simulado. Com os 7 simulados do contrato Academy 2026 a versão
   * anterior chegava a 10 colunas e ganhava rolagem horizontal numa tela de
   * 1440px. As N proficiências vivem numa CÉLULA só.
   */
  it('tem QUATRO colunas — uma só de proficiência por simulado — e NENHUMA "Nota TRI"', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    const cabecalhos = screen.getAllByRole('columnheader').map((celula) => celula.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Proficiência por simulado', 'Classificação']);
    expect(screen.queryByText(/Nota TRI/i)).not.toBeInTheDocument();
  });

  it('as proficiências de N simulados saem em série numa única célula', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    // Série visível: `64 · 68 · 71`. O nome de cada simulado vai junto em
    // `sr-only` — o `·` sozinho não diz a que simulado cada número pertence.
    const celula = screen.getByTestId('proficiencias-a1');
    expect(celula.textContent).toContain('64');
    expect(celula.textContent).toContain('·');
    expect(within(celula).getByText(/Simulado 2:/)).toBeInTheDocument();
    expect(screen.getByTestId('proficiencias-a2')).toHaveTextContent('—');
  });

  /**
   * §10.8 e docs/04 §4 ("Recursos: busca, ordenação, paginação"). A whitelist
   * de `sort` é da RPC (`nome|semestre|proficiencia|tendencia`): mandar outro
   * valor derruba a consulta inteira.
   */
  describe('ordenação', () => {
    it('abre por nome ascendente e leva coluna/direção ao hook', () => {
      render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
      expect(screen.getByRole('columnheader', { name: /Aluno/ })).toHaveAttribute('aria-sort', 'ascending');
      expect(mockUseAlunos).toHaveBeenLastCalledWith(
        recorte,
        expect.objectContaining({ sort: 'nome', order: 'asc' }),
      );
    });

    it('coluna numérica começa DESCENDENTE — a leitura que interessa é quem está pior', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      await user.click(screen.getByRole('button', { name: /Proficiência por simulado/ }));
      expect(mockUseAlunos).toHaveBeenLastCalledWith(
        recorte,
        expect.objectContaining({ sort: 'proficiencia', order: 'desc', page: 1 }),
      );
      expect(screen.getByRole('columnheader', { name: /Proficiência por simulado/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
      // A coluna que perdeu a vez volta a "none" — nunca duas ordenadas.
      expect(screen.getByRole('columnheader', { name: /Aluno/ })).toHaveAttribute('aria-sort', 'none');

      await user.click(screen.getByRole('button', { name: /Proficiência por simulado/ }));
      expect(mockUseAlunos).toHaveBeenLastCalledWith(
        recorte,
        expect.objectContaining({ sort: 'proficiencia', order: 'asc' }),
      );
    });

    it('reordenar volta para a página 1', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockUseAlunos.mockReturnValue(
        paginaResultado({ data: { data: linhas, page: 1, pageSize: 25, total: 60, totalPages: 3 } }),
      );
      render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      await user.click(screen.getByRole('button', { name: 'Próxima página' }));
      expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ page: 2 }));

      await user.click(screen.getByRole('button', { name: /Classificação/ }));
      expect(mockUseAlunos).toHaveBeenLastCalledWith(
        recorte,
        expect.objectContaining({ sort: 'tendencia', page: 1 }),
      );
    });
  });

  it('mostra a tag do grupo ao lado do nome', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    const celula = screen.getByTestId('celula-nome-a1');
    expect(celula).toHaveTextContent('Ana Prado');
    expect(celula).toHaveTextContent('Consistentemente proficiente');
  });

  it('grupo null: mostra TRACO, NUNCA a tag "Em variação" (achado 4 da revisão de 03/08)', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    const celula = screen.getByTestId('celula-nome-a3');
    expect(celula).toHaveTextContent('—');
    expect(celula).not.toHaveTextContent('Em variação');
  });

  it('semestre null: mostra TRACO, nunca 0 (achado 20, card 118)', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByTestId('semestre-a3')).toHaveTextContent('—');
    expect(screen.getByTestId('semestre-a3')).not.toHaveTextContent('0');
  });

  it('mostra — para proficiência ausente e nunca zero', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByTestId('prof-a2-s2')).toHaveTextContent('—');
    expect(screen.getByTestId('prof-a2-s2')).not.toHaveTextContent('0');
  });

  /**
   * Contrato novo (migration 20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql):
   * `proficiencias` é `{ simuladoId, valor }[]`, e a tabela casa por ID
   * contra `colunasSimulados`, nunca por posição. Os dois testes abaixo
   * substituem o antigo "TRACO em toda a linha quando os tamanhos divergem"
   * (achados 1-4 da revisão de 03/08): aquela mitigação saiu porque deixou de
   * ser necessária, e porque nunca cobria o caso mais perigoso — mesmo
   * TAMANHO, simulados DIFERENTES —, provado no segundo teste.
   */
  it('coluna sem entrada correspondente: TRACO só NAQUELA célula — as outras do mesmo aluno continuam corretas', () => {
    const linhaComRecorteMenor: LinhaAluno[] = [
      {
        id: 'a5',
        nome: 'Diego Alves',
        semestre: 8,
        grupo: 'consistentemente_proficiente',
        // Só 1 simulado no recorte de get_gestor_alunos para este aluno —
        // menos posições do que colunas, ao contrário do teste seguinte.
        proficiencias: [{ simuladoId: 's1', valor: 90 }],
        tendencia: 'estavel',
      },
    ];
    mockUseAlunos.mockReturnValue(
      paginaResultado({ data: { data: linhaComRecorteMenor, page: 1, pageSize: 25, total: 1, totalPages: 1 } }),
    );
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    expect(screen.getByTestId('prof-a5-s1')).toHaveTextContent('90');
    expect(screen.getByTestId('prof-a5-s2')).toHaveTextContent('—');
    expect(screen.getByTestId('prof-a5-s3')).toHaveTextContent('—');
  });

  it('MESMO tamanho, simulados DIFERENTES: casa por id e nunca desloca valor para a coluna vizinha (o caso que a mitigação antiga NUNCA cobria)', () => {
    const linhaComSimuladoForaDoRecorte: LinhaAluno[] = [
      {
        id: 'a4',
        nome: 'Diego Alves',
        semestre: 8,
        grupo: 'consistentemente_proficiente',
        // 3 posições, mesmo tamanho de colunasSimulados — mas a posição do
        // meio é de um simulado (s9) que NÃO é coluna nesta tabela. Um
        // casamento por ÍNDICE mostraria 65 sob o cabeçalho de "Simulado 2"
        // (s2); por id, a coluna s2 não acha entrada nenhuma e mostra TRAÇO.
        proficiencias: [
          { simuladoId: 's1', valor: 72 },
          { simuladoId: 's9', valor: 65 },
          { simuladoId: 's3', valor: 81 },
        ],
        tendencia: 'estavel',
      },
    ];
    mockUseAlunos.mockReturnValue(
      paginaResultado({
        data: { data: linhaComSimuladoForaDoRecorte, page: 1, pageSize: 25, total: 1, totalPages: 1 },
      }),
    );
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    expect(screen.getByTestId('prof-a4-s1')).toHaveTextContent('72');
    expect(screen.getByTestId('prof-a4-s2')).toHaveTextContent('—');
    expect(screen.getByTestId('prof-a4-s2')).not.toHaveTextContent('65');
    expect(screen.getByTestId('prof-a4-s3')).toHaveTextContent('81');
  });

  it('mostra a tendência por aluno', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByTestId('tendencia-a1')).toHaveTextContent('Subindo');
    expect(screen.getByTestId('tendencia-a2')).toHaveTextContent('Alternando');
    expect(screen.getByTestId('tendencia-a3')).toHaveTextContent('Estável');
  });

  it('pagina no servidor: avançar pede a página 2 ao hook', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockUseAlunos.mockReturnValue(
      paginaResultado({ data: { data: linhas, page: 1, pageSize: 25, total: 60, totalPages: 3 } }),
    );
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ page: 2 }));
  });

  it('busca com debounce chega ao hook como q', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar aluno' }), 'ana');
    expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ q: '' }));

    act(() => {
      vi.advanceTimersByTime(350);
    });
    await waitFor(() =>
      expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ q: 'ana', page: 1 })),
    );
  });

  it('o nome abre o DrawerAluno com a visão detalhada E marca a linha (§10.8)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.click(screen.getByRole('button', { name: 'Ana Prado' }));

    expect(mockUseAluno).toHaveBeenLastCalledWith('a1', ['s1', 's2', 's3']);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAccessibleName(/Ana Prado/);
    expect(dialogo).toHaveTextContent('Proficiência');
    expect(dialogo).toHaveTextContent('71');
    expect(dialogo).toHaveTextContent('12º de 118');
    expect(dialogo).toHaveTextContent('42%');
    expect(dialogo.textContent).not.toMatch(/Nota TRI/i);

    // O rastro de onde o gestor estava: tint na linha + barra de marca na
    // primeira célula. Sem isso, fechar o drawer perde o lugar na lista.
    const linha = screen.getByTestId('linha-aluno-a1');
    expect(linha).toHaveAttribute('data-selecionado', 'true');
    expect(linha.getAttribute('style')).toContain('background: var(--gp-brand-surface)');
    expect(screen.getByTestId('celula-nome-a1')).toHaveAttribute('data-marca-selecao', 'true');
    expect(screen.getByTestId('linha-aluno-a2')).toHaveAttribute('data-selecionado', 'false');
  });

  it('clicar em qualquer célula da linha abre o mesmo aluno', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.click(screen.getByTestId('semestre-a2'));

    expect(mockUseAluno).toHaveBeenLastCalledWith('a2', ['s1', 's2', 's3']);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Bruno Lima/);
    expect(screen.getByTestId('linha-aluno-a2')).toHaveAttribute('data-selecionado', 'true');
  });

  it('estado vazio quando a busca não retorna aluno', () => {
    mockUseAlunos.mockReturnValue(
      paginaResultado({ data: { data: [], page: 1, pageSize: 25, total: 0, totalPages: 0 } }),
    );
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByText(/nenhum aluno encontrado/i)).toBeInTheDocument();
    // Recorte de fato vazio: nada de paginação inventada sobre zero linhas.
    expect(screen.queryByRole('navigation', { name: 'Paginação de alunos' })).not.toBeInTheDocument();
  });

  /**
   * `page` é estado LOCAL e sobrevivia à troca de recorte: da página 3 de uma
   * IES grande para uma IES de 40 alunos, a RPC recebia `p_page: 3` de uma
   * lista de 2 páginas, ecoava a página pedida sem clampar e devolvia
   * `data: []`. A tela então afirmava "Nenhum aluno encontrado neste recorte"
   * para uma IES cheia de alunos — e sem rodapé não havia como voltar.
   */
  describe('troca de recorte com página fora do intervalo', () => {
    beforeEach(() => {
      mockUseAlunos.mockReturnValue(
        paginaResultado({ data: { data: linhas, page: 1, pageSize: 25, total: 60, totalPages: 3 } }),
      );
    });

    it('trocar de IES volta para a página 1', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      await user.click(screen.getByRole('button', { name: 'Próxima página' }));
      expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ page: 2 }));

      const outraIes: FiltrosGestor = { ...recorte, iesId: 'ies-2' };
      rerender(<TabelaAlunos recorte={outraIes} colunasSimulados={colunasSimulados} />);
      expect(mockUseAlunos).toHaveBeenLastCalledWith(outraIes, expect.objectContaining({ page: 1 }));
    });

    it('trocar de semestre volta para a página 1', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { rerender } = render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      await user.click(screen.getByRole('button', { name: 'Próxima página' }));
      expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ page: 2 }));

      const outroSemestre: FiltrosGestor = { ...recorte, semestre: 'geral' };
      rerender(<TabelaAlunos recorte={outroSemestre} colunasSimulados={colunasSimulados} />);
      expect(mockUseAlunos).toHaveBeenLastCalledWith(outroSemestre, expect.objectContaining({ page: 1 }));
    });

    it('lista vazia com total > 0 ainda oferece o rodapé como saída', () => {
      mockUseAlunos.mockReturnValue(
        paginaResultado({ data: { data: [], page: 3, pageSize: 25, total: 40, totalPages: 2 } }),
      );
      render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      expect(screen.getByText(/nenhum aluno encontrado/i)).toBeInTheDocument();
      const pager = screen.getByRole('navigation', { name: 'Paginação de alunos' });
      expect(within(pager).getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
      // Zero é o que está NESTA página; o total continua sendo dito por inteiro.
      expect(screen.getByText(/Mostrando 0 de 40/)).toBeInTheDocument();
    });
  });

  it('loading: skeleton acessível, sem linhas', () => {
    mockUseAlunos.mockReturnValue(paginaResultado({ data: undefined, isLoading: true }));
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('celula-nome-a1')).not.toBeInTheDocument();
  });

  it('estado de erro só do bloco, com "Tentar novamente"', async () => {
    const refetch = vi.fn();
    mockUseAlunos.mockReturnValue(
      paginaResultado({ data: undefined, isError: true, refetch }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  /**
   * Sem IES no recorte, `useAlunos` nasce `enabled: false`; no React Query v5
   * `isLoading` é `isPending && isFetching`, então uma query desabilitada nunca
   * passa por `isLoading` e o gate antigo (só `consulta.isLoading`) caía no
   * ramo de lista vazia. Alcançável pela rota real: sem `?ies` na URL, a Visão
   * Geral renderiza esta tabela enquanto `get_gestor_contexto` está em voo.
   */
  it('sem IES resolvida, mostra skeleton — nunca afirma "nenhum aluno" antes da primeira requisição', () => {
    mockUseAlunos.mockReturnValue(
      paginaResultado({
        data: undefined,
        isLoading: false,
        isError: false,
      }),
    );
    render(
      <TabelaAlunos recorte={{ ...recorte, iesId: null }} colunasSimulados={colunasSimulados} />,
    );

    expect(screen.queryByText(/nenhum aluno encontrado/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('celula-nome-a1')).not.toBeInTheDocument();
  });

  /**
   * `useAlunos` mantém `placeholderData` (o recorte é filtro sobre a mesma
   * lista): na troca de IES/semestre a lista NOMINAL antiga fica na tela com
   * `isLoading: false`. Isso não pode passar sem sinalização — são nomes de
   * pessoas sob um seletor que já aponta outro recorte (cenário 1, revisão
   * de 05/08).
   */
  describe('transição de recorte com lista nominal antiga na tela (cenário 1)', () => {
    it('anuncia a transição nos dois canais: aria-busy na seção e faixa role="status"', () => {
      mockUseAlunos.mockReturnValue(paginaResultado({ isPlaceholderData: true }));
      render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      expect(screen.getByTestId('bloco-tabela-alunos')).toHaveAttribute('aria-busy', 'true');
      const faixa = screen.getByTestId('faixa-transicao-alunos');
      expect(faixa).toHaveAttribute('role', 'status');
      expect(faixa).toHaveTextContent(/ainda são do recorte anterior/i);
      // O dado velho continua visível — o remédio é anunciar, não piscar vazio.
      expect(screen.getByTestId('celula-nome-a1')).toBeInTheDocument();
    });

    it('fora da transição não há faixa nem aria-busy', () => {
      render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

      expect(screen.getByTestId('bloco-tabela-alunos')).toHaveAttribute('aria-busy', 'false');
      expect(screen.queryByTestId('faixa-transicao-alunos')).not.toBeInTheDocument();
    });
  });
});

/**
 * `normalizarLinhaAluno` (api/queries.ts) é o único ponto de normalização do
 * mapeamento de `get_gestor_alunos`: valida o tipo de cada campo de
 * `proficiencias` — a RPC devolve `{ simuladoId, valor }[]` (migration
 * `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql`, aplicada
 * em produção em 05/08) — antes de expor `ProficienciaSimulado` ao resto do
 * app. O ramo que aceitava o array legado `(number | null)[]` saiu de
 * `normalizarLinhaAluno`/`normalizarProficiencia` junto com esta migration;
 * os testes que só existiam para provar essa compatibilidade saíram daqui.
 */
describe('normalizarLinhaAluno — mapeia e valida proficiencias da RPC (migration 20260805160000)', () => {
  it('preserva simuladoId e valor tal qual, e os demais campos da linha', () => {
    const linha = normalizarLinhaAluno({
      id: 'a1',
      nome: 'Ana',
      semestre: 6,
      grupo: 'em_variacao',
      tendencia: 'estavel',
      proficiencias: [
        { simuladoId: 's1', valor: 64 },
        { simuladoId: 's2', valor: null },
      ],
    });
    expect(linha).toEqual({
      id: 'a1',
      nome: 'Ana',
      semestre: 6,
      grupo: 'em_variacao',
      tendencia: 'estavel',
      proficiencias: [
        { simuladoId: 's1', valor: 64 },
        { simuladoId: 's2', valor: null },
      ],
    });
  });

  it('array vazio (nenhum simulado no recorte do aluno): devolve array vazio', () => {
    expect(
      normalizarLinhaAluno({
        id: 'a3', nome: 'Carla', semestre: null, grupo: null, tendencia: 'estavel', proficiencias: [],
      }).proficiencias,
    ).toEqual([]);
  });
});
