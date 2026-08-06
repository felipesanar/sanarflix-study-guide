import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  return {
    ...real,
    useAlunos: vi.fn(),
    useAluno: vi.fn(),
    useAlunoContato: vi.fn(() => ({ data: undefined, meta: null, isLoading: false, isError: false, refetch: () => {} })),
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

  it('tem uma coluna de proficiência por simulado e NENHUMA coluna "Nota TRI"', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    const cabecalhos = screen.getAllByRole('columnheader').map((celula) => celula.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Simulado 1', 'Simulado 2', 'Simulado 3', 'Tendência']);
    expect(screen.queryByText(/Nota TRI/i)).not.toBeInTheDocument();
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

  it('o nome abre o DrawerAluno com a visão detalhada', async () => {
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
  });

  it('estado vazio quando a busca não retorna aluno', () => {
    mockUseAlunos.mockReturnValue(
      paginaResultado({ data: { data: [], page: 1, pageSize: 25, total: 0, totalPages: 0 } }),
    );
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByText(/nenhum aluno encontrado/i)).toBeInTheDocument();
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
