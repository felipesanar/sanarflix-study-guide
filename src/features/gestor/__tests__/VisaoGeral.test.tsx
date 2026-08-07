import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, userEvent } from '@/test/utils';
import VisaoGeralRoute from '@/features/gestor/routes/VisaoGeral';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import {
  useAluno,
  useAlunos,
  useDiagnostico,
  useDiagnosticoTemas,
  useGestorContexto,
  useVisaoGeral,
} from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { metaFake, visaoGeralFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({
  useVisaoGeral: vi.fn(),
  useAlunos: vi.fn(),
  useDiagnostico: vi.fn(),
  useDiagnosticoTemas: vi.fn(),
  useAluno: vi.fn(),
  useAlunoContato: vi.fn(() => ({ data: undefined, meta: null, isLoading: false, isError: false, refetch: () => {} })),
  // Consumido por `AcoesRecorte` (rodapé de ações do `DrawerTemas`): é o
  // servidor que decide `podeExportar`, nunca uma role lida no cliente.
  useGestorContexto: vi.fn(),
}));

// Controlável por teste (achados 2 e 4 da revisão de 04/08): precisamos
// simular `iesId: null`, o estado real da URL antes de `SidebarIes` semear
// `?ies` — o valor fixo anterior nunca exercitava esse caminho.
vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({
  useFiltrosGestor: vi.fn(),
}));

vi.mock('@/features/gestor/components/FiltroSemestre', () => ({
  FiltroSemestre: () => <div data-testid="filtro-semestre" />,
}));

// `AcoesRecorte`/`DrawerTemas` são componentes REAIS nestes testes (só a
// camada de dados é mockada) — para provar que "Exportar recorte" produz um
// efeito observável (achados 1 e 3), espionamos o `toast` chamado pela rota.
const mockToast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const mockUseVisaoGeral = vi.mocked(useVisaoGeral);
const mockUseAlunos = vi.mocked(useAlunos);
const mockUseFiltrosGestor = vi.mocked(useFiltrosGestor);

const filtrosFake = (overrides: Partial<ReturnType<typeof useFiltrosGestor>> = {}): ReturnType<typeof useFiltrosGestor> => ({
  semestre: '6ano',
  setSemestre: vi.fn(),
  simulados: [],
  setSimulados: vi.fn(),
  iesId: 'ies-1',
  setIesId: vi.fn(),
  ...overrides,
});

function ordemNoDom(ids: string[]) {
  const nos = ids.map((id) => screen.getByTestId(id));
  return nos.every((no, indice) =>
    indice === 0 ? true : Boolean(nos[indice - 1].compareDocumentPosition(no) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
}

describe('rota VisaoGeral', () => {
  beforeEach(() => {
    mockToast.mockClear();

    mockUseFiltrosGestor.mockReturnValue(filtrosFake());

    mockUseVisaoGeral.mockReturnValue({
      data: visaoGeralFake,
      meta: metaFake,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    mockUseAlunos.mockReturnValue({
      data: { data: [], page: 1, pageSize: 25, total: 0, totalPages: 0 },
      meta: metaFake,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlunos>);

    vi.mocked(useGestorContexto).mockReturnValue({
      // `iesDisponiveis` é obrigatório no contrato real (migration
      // 20260804130200) e `AcoesRecorte` — componente REAL nestes testes —
      // resolve o nome da IES do recorte contra essa lista.
      data: {
        iesAtual: { id: 'ies-1', nome: 'Universidade Teste' },
        iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade Teste' }],
        podeExportar: true,
      },
      meta: metaFake,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGestorContexto>);

    vi.mocked(useDiagnostico).mockReturnValue({
      data: [],
      meta: metaFake,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnostico>);

    vi.mocked(useDiagnosticoTemas).mockReturnValue({
      data: [],
      meta: metaFake,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnosticoTemas>);

    vi.mocked(useAluno).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAluno>);
  });

  /**
   * A referência PROMOVE o Diagnóstico Curricular para logo abaixo do gráfico
   * protagonista (`<!-- Diagnóstico (promovido) -->`, LIGHT.html:3746), antes da
   * Visão de Alunos (3772) e dos Insights (3792). Ordem é requisito, não
   * preferência: "onde dói?" vem antes de "quem dói?". Este teste codificava a
   * ordem anterior (alunos acima da área) e foi atualizado contra a referência.
   */
  it('monta os blocos na ordem vertical da referência, com o Diagnóstico ACIMA da Visão de Alunos', () => {
    render(<VisaoGeralRoute />);
    expect(
      ordemNoDom([
        'barra-filtros',
        'kpis-visao-geral',
        'grafico-protagonista',
        'bloco-diagnostico',
        'bloco-visao-alunos',
        'bloco-insights',
        'divisor-detalhe-micro',
        'bloco-tabela-alunos',
      ])
    ).toBe(true);
  });

  it('mostra o contexto do recorte junto do filtro', () => {
    render(<VisaoGeralRoute />);
    expect(screen.getByTestId('barra-filtros')).toContainElement(screen.getByTestId('filtro-semestre'));
    expect(screen.getByTestId('contexto-recorte')).toHaveTextContent('6º ano (11º e 12º em evidência)');
    expect(screen.getByTestId('contexto-recorte')).toHaveTextContent('2026.1');
  });

  /**
   * O `Glossario` existia completo e testado, mas NENHUMA tela o montava: os
   * únicos importadores eram arquivos de teste. Era código inalcançável em
   * produção — a gestora não tinha caminho nenhum para "o que é proficiente?".
   */
  it('a barra de filtros traz o gatilho do glossário, ao lado do filtro de semestre', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<VisaoGeralRoute />);

    const gatilho = screen.getByRole('button', { name: 'Entenda as métricas' });
    expect(screen.getByTestId('barra-filtros')).toContainElement(gatilho);

    await user.click(gatilho);
    expect(screen.getByRole('dialog')).toHaveTextContent('Percentual de acerto');
  });

  it('o overline "Panorama da instituição" nomeia o bloco dos 4 indicadores', () => {
    render(<VisaoGeralRoute />);
    const overline = screen.getByTestId('overline-panorama');
    expect(overline).toHaveTextContent('Panorama da instituição');
    expect(
      overline.compareDocumentPosition(screen.getByTestId('kpis-visao-geral')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  /**
   * Item B5 do passe de conformidade: a nota explicativa da régua não
   * existia em lugar nenhum do código — a referência põe a nota na MESMA
   * linha do overline "Panorama da instituição".
   */
  it('a nota da régua aparece na MESMA linha do overline "Panorama da instituição" (item B5)', () => {
    render(<VisaoGeralRoute />);
    const overline = screen.getByTestId('overline-panorama');
    const nota = screen.getByTestId('nota-regua-panorama');

    expect(nota).toHaveTextContent(
      'compara 1º simulado · anterior · atual — com 1 simulado a régua não aparece; com 2, mostra só os dois',
    );

    const linha = overline.parentElement;
    expect(linha).toContainElement(nota);
    expect(linha?.className).toMatch(/items-baseline/);
    expect(linha?.className).toMatch(/gap-\[10px\]/);
  });

  it('sem `--gp-text-4` no tema, a nota da régua usa text-muted-foreground em vez de inventar um token (item B5)', () => {
    render(<VisaoGeralRoute />);
    const nota = screen.getByTestId('nota-regua-panorama');
    expect(nota.className).toMatch(/\btext-muted-foreground\b/);
    expect(nota.style.fontSize).toBe('12px');
  });

  it('mostra os 2 insights autogerados, um por área e um por aluno', () => {
    render(<VisaoGeralRoute />);
    const insights = screen.getByTestId('bloco-insights').querySelectorAll('li');
    expect(insights).toHaveLength(2);
    expect(insights[0]).toHaveTextContent('Clínica Médica está em nível crítico');
    expect(insights[1]).toHaveTextContent('28 alunos permanecem abaixo do limiar');
  });

  it('não existe nenhuma coluna nem rótulo "Nota TRI" na tela (caso crítico nº2)', () => {
    render(<VisaoGeralRoute />);
    expect(screen.queryByText(/Nota TRI/i)).not.toBeInTheDocument();
  });

  /**
   * Invariante 8 do handoff: a Visão Geral fala com a GESTORA. A copy do CTA
   * para o micro é fechada — "Ver visão detalhada", nunca "drill-down" — e a
   * tela não empresta linguagem de aluno nem vira checklist de pendências.
   * Nada disso tinha teste: o invariante já estava violado na copy (a string
   * não existia em `src/`) e nenhuma suíte acusava.
   */
  it('o CTA para o micro usa a copy canônica "Ver visão detalhada"', () => {
    render(<VisaoGeralRoute />);

    const cta = screen.getByRole('link', { name: /Ver visão detalhada/ });
    expect(screen.getByTestId('bloco-visao-alunos')).toContainElement(cta);
    // Aponta para a tabela de alunos da própria tela, abaixo do divisor "Detalhe · micro".
    expect(cta).toHaveAttribute('href', '#alunos-detalhe');
    expect(screen.getByTestId('gestor-visao-geral').textContent).not.toMatch(/drill.?down/i);
  });

  it('não usa linguagem de aluno nem checklist de pendências em nenhum ponto da tela', () => {
    render(<VisaoGeralRoute />);
    const texto = screen.getByTestId('gestor-visao-geral').textContent ?? '';

    for (const proibido of [/\bestude\b/i, /\brevise\b/i, /\bpratique\b/i, /seu ponto fraco/i]) {
      expect(
        texto,
        `a Visão Geral fala com a gestora, não com o aluno — encontrado ${proibido}`,
      ).not.toMatch(proibido);
    }
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('área, especialidade e tema usam % de acerto e nunca proficiência (caso crítico nº14)', () => {
    render(<VisaoGeralRoute />);
    const diagnostico = screen.getByTestId('bloco-diagnostico');
    expect(diagnostico).toHaveTextContent('percentual de acerto');
    expect(diagnostico.textContent).not.toMatch(/profici/i);

    const grafico = screen.getByTestId('grafico-protagonista');
    expect(grafico).toHaveTextContent('Evolução institucional');
  });

  it('erro em um bloco não deixa a tela em branco: KPIs seguem, só a tabela mostra erro', () => {
    mockUseAlunos.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlunos>);
    render(<VisaoGeralRoute />);

    expect(screen.getByTestId('kpis-visao-geral')).toBeInTheDocument();
    expect(screen.getByTestId('grafico-protagonista')).toBeInTheDocument();
    expect(screen.getByTestId('bloco-tabela-alunos')).toHaveTextContent('Não foi possível carregar a lista de alunos');
  });

  it('loading da query da tela mostra skeletons com altura reservada, sem sumir com a barra de filtros', () => {
    mockUseVisaoGeral.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);
    render(<VisaoGeralRoute />);

    expect(screen.getByTestId('barra-filtros')).toBeInTheDocument();
    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4);
    expect(screen.getByTestId('bloco-grafico-loading')).toBeInTheDocument();
  });

  it('faixa de recorte parcial aparece quando meta.partial é true', () => {
    mockUseVisaoGeral.mockReturnValue({
      data: visaoGeralFake,
      meta: { ...metaFake, partial: true },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    render(<VisaoGeralRoute />);
    expect(screen.getAllByTestId('faixa-parcial').length).toBeGreaterThan(0);
  });

  it('abrir o drawer de temas pela cascata não desmonta o resto da tela e repassa a grande área do nó pai', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    // Nível 1 (node=null): grande área "Clínica Médica" (id === nome, como a
    // RPC real devolve). Nível 2 (node='Clínica Médica'): a especialidade
    // "Cardiologia" que o clique tem que abrir no drawer.
    vi.mocked(useDiagnostico).mockImplementation(((_filtros: unknown, node: string | null) =>
      ({
        data:
          node === null
            ? [
                {
                  id: 'Clínica Médica',
                  nome: 'Clínica Médica',
                  nivel: 'grande_area',
                  acertoPct: 27,
                  desempenho: 'critico',
                  amostra: 118,
                  lowSample: false,
                  temFilhos: true,
                },
              ]
            : [
                {
                  id: 'esp-cardio',
                  nome: 'Cardiologia',
                  nivel: 'especialidade',
                  acertoPct: 24,
                  desempenho: 'critico',
                  amostra: 90,
                  lowSample: false,
                  temFilhos: true,
                },
              ],
        meta: metaFake,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      })) as unknown as typeof useDiagnostico);

    render(<VisaoGeralRoute />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Clínica Médica/ }));
    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Temas de Cardiologia/i);
    expect(screen.getByTestId('kpis-visao-geral')).toBeInTheDocument();

    // PROVA da correção: a grande área que chega à RPC de temas é a do nó
    // pai que originou o clique ('Clínica Médica'), nunca o placeholder ''
    // (que faria a lista de temas vir sempre vazia, mesmo com dado real).
    expect(useDiagnosticoTemas).toHaveBeenCalledWith(expect.anything(), 'esp-cardio', 'Clínica Médica');
  });

  it('clicar em "Exportar recorte" no DrawerTemas produz um efeito observável — nunca um clique engolido em silêncio (achados 1 e 3)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.mocked(useDiagnostico).mockImplementation(((_filtros: unknown, node: string | null) =>
      ({
        data:
          node === null
            ? [
                {
                  id: 'Clínica Médica',
                  nome: 'Clínica Médica',
                  nivel: 'grande_area',
                  acertoPct: 27,
                  desempenho: 'critico',
                  amostra: 118,
                  lowSample: false,
                  temFilhos: true,
                },
              ]
            : [
                {
                  id: 'esp-cardio',
                  nome: 'Cardiologia',
                  nivel: 'especialidade',
                  acertoPct: 24,
                  desempenho: 'critico',
                  amostra: 90,
                  lowSample: false,
                  temFilhos: true,
                },
              ],
        meta: metaFake,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      })) as unknown as typeof useDiagnostico);

    render(<VisaoGeralRoute />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Clínica Médica/ }));
    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));

    // Antes da correção este botão chamava `() => undefined`: nenhum
    // download, toast, erro ou estado de carregamento — clique engolido em
    // silêncio, ao lado de "Copiar resumo", que funciona de verdade.
    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('não está disponível') }),
    );
  });

  it('sem ?ies na URL e com o contexto do gestor ainda carregando, mostra loading — nunca afirma "sem dados" antes de perguntar (achados 2 e 4)', () => {
    mockUseFiltrosGestor.mockReturnValue(filtrosFake({ iesId: null }));
    vi.mocked(useGestorContexto).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGestorContexto>);
    // Com `iesId` nulo a query da tela nasce DESABILITADA: no React Query v5
    // `isLoading` só é `true` com um fetch em andamento — uma query
    // `enabled:false` fica em 'pending'/'idle' e `isLoading` NUNCA vira
    // `true` por conta própria. É exatamente o que a rota real observaria.
    mockUseVisaoGeral.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    render(<VisaoGeralRoute />);

    expect(screen.getByTestId('barra-filtros')).toBeInTheDocument();
    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4);
    expect(screen.getByTestId('bloco-grafico-loading')).toBeInTheDocument();
    expect(screen.queryByText('Sem simulados realizados neste recorte.')).not.toBeInTheDocument();
  });

  it('erro ao carregar o contexto do gestor aparece como erro na tela, nunca como "sem dados" — o retry refaz o contexto (achados 2 e 4)', async () => {
    const refetchContexto = vi.fn();
    const user = userEvent.setup();
    mockUseFiltrosGestor.mockReturnValue(filtrosFake({ iesId: null }));
    vi.mocked(useGestorContexto).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchContexto,
    } as unknown as ReturnType<typeof useGestorContexto>);
    mockUseVisaoGeral.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    render(<VisaoGeralRoute />);

    expect(screen.queryByText('Sem simulados realizados neste recorte.')).not.toBeInTheDocument();
    const botoesRetry = screen.getAllByRole('button', { name: 'Tentar novamente' });
    expect(botoesRetry.length).toBeGreaterThan(0);

    await user.click(botoesRetry[0]);
    expect(refetchContexto).toHaveBeenCalledTimes(1);
  });

  it('com ?ies já presente na URL, uma falha do contexto do gestor NÃO derruba uma tela com dado bom — a query já dispara pelo valor da URL (ressalva do achado 4)', () => {
    mockUseFiltrosGestor.mockReturnValue(filtrosFake({ iesId: 'ies-1' }));
    vi.mocked(useGestorContexto).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGestorContexto>);
    // `iesId` já vem da URL: a query da tela nasce habilitada e roda seu
    // próprio ciclo, independente do contexto (que aqui está em erro).
    mockUseVisaoGeral.mockReturnValue({
      data: visaoGeralFake,
      meta: metaFake,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    render(<VisaoGeralRoute />);

    expect(screen.getByTestId('kpis-visao-geral')).toBeInTheDocument();
    expect(screen.getByTestId('grafico-protagonista')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar este indicador.')).not.toBeInTheDocument();
    expect(screen.queryByText('Sem simulados realizados neste recorte.')).not.toBeInTheDocument();
  });

  /**
   * Cenário 1 da revisão de 05/08: `useVisaoGeral` serve `placeholderData` na
   * troca de IES/semestre, então `data`/`meta` são do recorte ANTERIOR com
   * `isLoading: false`. Sem consumir `isPlaceholderData`, `estado` caía em 'ok'
   * e a tela afirmava números velhos sob um seletor já trocado — e o
   * `ContextoDoRecorte` emparelhava o semestre NOVO (URL) com o período VELHO
   * (meta), a afirmação mais errada da tela.
   */
  describe('troca de recorte com dado do recorte anterior na tela (cenário 1)', () => {
    const emTransicao = (over: Record<string, unknown> = {}) =>
      mockUseVisaoGeral.mockReturnValue({
        data: visaoGeralFake,
        meta: metaFake,
        isLoading: false,
        isError: false,
        isPlaceholderData: true,
        isFetching: true,
        refetch: vi.fn(),
        ...over,
      } as unknown as ReturnType<typeof useVisaoGeral>);

    it('anuncia a transição nos dois canais: aria-busy na região e faixa role="status"', () => {
      emTransicao();
      mockUseFiltrosGestor.mockReturnValue(filtrosFake({ semestre: '11' }));
      render(<VisaoGeralRoute />);

      expect(screen.getByTestId('gestor-visao-geral')).toHaveAttribute('aria-busy', 'true');
      const faixa = screen.getByTestId('faixa-transicao-recorte');
      expect(faixa).toHaveAttribute('role', 'status');
      expect(faixa).toHaveTextContent(/ainda são do recorte anterior/i);
    });

    it('o dado anterior continua visível — o remédio é anunciar, não piscar a tela para vazio', () => {
      emTransicao();
      render(<VisaoGeralRoute />);

      expect(screen.getByTestId('kpis-visao-geral')).toBeInTheDocument();
      expect(screen.getByTestId('grafico-protagonista')).toBeInTheDocument();
      expect(screen.queryByTestId('bloco-grafico-loading')).not.toBeInTheDocument();
      expect(screen.queryByText('Sem simulados realizados neste recorte.')).not.toBeInTheDocument();
    });

    it('o ContextoDoRecorte não encosta o semestre NOVO no período do recorte anterior', () => {
      emTransicao();
      mockUseFiltrosGestor.mockReturnValue(filtrosFake({ semestre: '11' }));
      render(<VisaoGeralRoute />);

      const contexto = screen.getByTestId('contexto-recorte');
      // O rótulo do recorte novo aparece...
      expect(contexto).toHaveTextContent('11º semestre');
      // ...mas o período do recorte VELHO (metaFake) não é afirmado ao lado dele.
      expect(contexto).not.toHaveTextContent(metaFake.periodo);
      expect(screen.getByTestId('contexto-recorte-atualizando')).toBeInTheDocument();
      // E não há rastreabilidade prometendo procedência de um número que ainda não veio.
      expect(contexto.querySelector('[data-testid="rastreabilidade-texto"]')).toBeNull();
    });

    it('fora da transição, período e rastreabilidade voltam ao contexto do recorte', () => {
      render(<VisaoGeralRoute />);

      const contexto = screen.getByTestId('contexto-recorte');
      expect(contexto).toHaveTextContent(metaFake.periodo);
      expect(contexto.querySelector('[data-testid="rastreabilidade-texto"]')).not.toBeNull();
      expect(screen.getByTestId('gestor-visao-geral')).toHaveAttribute('aria-busy', 'false');
      expect(screen.queryByTestId('faixa-transicao-recorte')).not.toBeInTheDocument();
    });
  });
});

describe('BlocoGestor', () => {
  it('contém o erro de render de um filho sem derrubar o resto da página, com o MESMO contrato de fallback de BlocoErrorBoundary (role=alert)', () => {
    // Regressão do achado 1 (revisão 03/08): o fallback de erro de RENDER no
    // ramo `ok` era um `<p>` estático sem `role`, sem retry e sem `onError` —
    // um contrato estritamente pior que `BlocoErrorBoundary` (Fase 2) para o
    // MESMO tipo de falha. Este teste afirma o contrato bom (`getByRole('alert')`),
    // como `primitivas.test.tsx` já faz para `BlocoErrorBoundary`.
    const Bomba = () => {
      throw new Error('quebrou');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <>
        <BlocoGestor estado="ok" bloco="teste">
          <Bomba />
        </BlocoGestor>
        <p>vizinho intacto</p>
      </>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('vizinho intacto')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('"Tentar novamente" do fallback de erro de render remonta o bloco', () => {
    // Mesmo contrato de retry que `primitivas.test.tsx` prova para
    // `BlocoErrorBoundary` — aqui a falha é transitória e uma flag externa
    // simula a causa sendo resolvida entre o erro e o retry.
    let deveQuebrar = true;
    const Instavel = () => {
      if (deveQuebrar) throw new Error('quebrou');
      return <div>bloco ok</div>;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <BlocoGestor estado="ok" bloco="teste">
        <Instavel />
      </BlocoGestor>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    deveQuebrar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(screen.getByText('bloco ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    spy.mockRestore();
  });
});
