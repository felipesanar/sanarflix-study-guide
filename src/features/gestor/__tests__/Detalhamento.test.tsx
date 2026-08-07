import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import Detalhamento from '@/features/gestor/routes/Detalhamento';
import { useCronograma, useDetalhamento, useGestorContexto, useQuestoes } from '@/features/gestor/api/queries';
import type { AlunoNoSimulado, ContextoGestor, ItemCronograma, Meta, MetricasSimulado, Questao } from '@/features/gestor/api/types';
import type { DetalhamentoComExtras } from '@/features/gestor/api/detalhamentoExtras';

/**
 * `src/test/setup.ts` troca `useLocation` por `() => ({ pathname: '/' })` e
 * `useNavigate` por um `vi.fn()` inerte, para toda a suíte. Aqui isso apagaria
 * justamente o que se quer exercitar: sem `useNavigate` de verdade o clique no
 * simulado realizado não muda a URL, e o teste do drawer que fecha passaria (ou
 * falharia) sem nunca ter havido navegação. Este `vi.mock` local devolve o
 * módulo real — o `MemoryRouter` de `renderRota` continua sendo o sandbox.
 */
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: vi.fn(),
  useDetalhamento: vi.fn(),
  useQuestoes: vi.fn(),
  useGestorContexto: vi.fn(),
}));

vi.mock('@/features/gestor/components/FiltroSemestre', () => ({
  FiltroSemestre: () => <div data-testid="filtro-semestre" />,
}));
/**
 * O mock reproduz a única coisa do cronograma que importa para esta rota: o
 * clique num simulado realizado navega para o MESMO pathname, trocando só
 * `?simulados=` (`CronogramaSimulados.tsx:126`). É por isso que o React Router
 * não desmonta a rota — e por isso o Sheet precisa fechar por conta própria.
 */
vi.mock('@/features/gestor/components/CronogramaSimulados', async () => {
  const { useLocation, useNavigate } = await import('react-router-dom');
  return {
    CronogramaSimulados: () => {
      const navigate = useNavigate();
      const location = useLocation();
      return (
        <div data-testid="cronograma-simulados">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(location.search);
              params.set('simulados', 's2');
              navigate({ pathname: '/gestor/detalhamento', search: params.toString() });
            }}
          >
            Abrir simulado realizado
          </button>
        </div>
      );
    },
  };
});
vi.mock('@/features/gestor/components/DrawerAluno', () => ({
  DrawerAluno: ({ alunoId, nome }: { alunoId: string | null; nome: string }) =>
    alunoId ? <div data-testid="drawer-aluno">{alunoId}:{nome}</div> : null,
}));
vi.mock('@/features/gestor/charts/DispersaoChart', () => ({
  DispersaoChart: () => <div data-testid="dispersao-chart" />,
}));
vi.mock('@/features/gestor/charts/EvolucaoChart', () => ({
  EvolucaoChart: () => <div data-testid="evolucao-chart" />,
}));

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados SanarFlix',
  atualizadoEm: '2026-07-20T13:00:00Z',
  criterio: 'Proficiente = proficiência maior ou igual a 60',
  partial: false,
  lowSample: false,
};

const CONTEXTO: ContextoGestor = {
  usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' },
  iesDisponiveis: [{ id: 'ies-1', nome: 'IES Alfa' }],
  iesAtual: { id: 'ies-1', nome: 'IES Alfa' },
  contrato: null,
  podeTrocarIes: false,
  podeExportar: true,
};

const metrica = (i: number): MetricasSimulado => ({
  simuladoId: `s${i}`,
  nome: `Simulado ${i}`,
  data: `2026-0${i}-10T13:00:00Z`,
  participantes: 100,
  acertoMedioPct: 60 + i,
  enamedProjetado: 3,
  proficienciaMedia: 55 + i,
});

const aluno: AlunoNoSimulado = {
  id: 'a1',
  nome: 'Ana',
  semestre: 11,
  participou: true,
  acertos: 60,
  proficiencia: 72,
  situacao: 'proficiente',
  variacao: 5,
};

const questao: Questao = {
  numero: 1,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  acertoPct: 42,
  enunciado: 'Enunciado da questão 1',
  alternativas: [
    { letra: 'A', texto: 'a', correta: true, marcadaPct: 42 },
    { letra: 'B', texto: 'b', correta: false, marcadaPct: 31 },
    { letra: 'C', texto: 'c', correta: false, marcadaPct: 15 },
    { letra: 'D', texto: 'd', correta: false, marcadaPct: 8 },
    { letra: 'E', texto: 'e', correta: false, marcadaPct: 4 },
  ],
};

const CRONOGRAMA: ItemCronograma[] = Array.from({ length: 7 }, (_, i) => ({
  id: `s${i + 1}`,
  nome: `Simulado ${i + 1}`,
  data: '2026-03-10T13:00:00Z',
  status: 'realizado',
  modalidade: 'online',
  participantes: 40,
}));

function dados(quantos: number): DetalhamentoComExtras {
  return {
    metricas: Array.from({ length: quantos }, (_, i) => metrica(i + 1)),
    acertoPorAreaESemestre: {
      areas: [{ id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false }],
      semestres: [{ semestre: 11, acertoPct: 63, emEvidencia: true }],
      matriz: [{ areaId: 'clinica', semestre: 11, acertoPct: 66, amostra: 120 }],
    },
    dispersao: [{ alunoId: 'a1', semestre: 11, nota: 72 }],
    alunos: [aluno],
  };
}

const renderRota = (query: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/gestor/detalhamento${query}`]}>
        <TooltipProvider>
          <Detalhamento />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const comSimulados = (quantos: number, over: Partial<ReturnType<typeof useDetalhamento>> = {}) => {
  vi.mocked(useDetalhamento).mockReturnValue({
    data: quantos === 0 ? undefined : dados(quantos),
    meta: quantos === 0 ? undefined : META,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useDetalhamento>);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useGestorContexto).mockReturnValue({
    data: CONTEXTO,
    meta: META,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGestorContexto>);
  vi.mocked(useCronograma).mockReturnValue({
    data: CRONOGRAMA,
    meta: META,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCronograma>);
  vi.mocked(useQuestoes).mockReturnValue({
    data: { data: [questao], page: 1, pageSize: 20, total: 1, totalPages: 1 },
    meta: META,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useQuestoes>);
});

describe('Rota Detalhamento — sub-estado vazio (§12 caso 4)', () => {
  it('sem simulado mostra o estado vazio e nenhum indicador', () => {
    comSimulados(0);
    renderRota('?ies=ies-1&semestre=6ano');

    expect(screen.getByTestId('detalhamento-vazio')).toBeInTheDocument();
    expect(screen.getByTestId('seletor-simulados')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-acerto-medio')).toBeNull();
    expect(screen.queryByTestId('comparativo-temas')).toBeNull();
    expect(screen.queryByText('Detalhamento das questões')).toBeNull();
    expect(vi.mocked(useDetalhamento)).toHaveBeenCalledWith({
      iesId: 'ies-1',
      semestre: '6ano',
      simulados: [],
    });
  });
});

describe('Rota Detalhamento — 1 simulado (§4.7.3)', () => {
  beforeEach(() => comSimulados(1));

  it('faz a leitura completa e põe as questões como último componente da página', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.queryByTestId('detalhamento-vazio')).toBeNull();
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-enamed')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-proficiencia-media')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Acerto por grande área e por semestre' })).toBeInTheDocument();
    expect(screen.getByTestId('dispersao-chart')).toBeInTheDocument();
    expect(screen.getByTestId('linha-aluno-a1')).toBeInTheDocument();
    expect(screen.getByTestId('linha-questao-1')).toBeInTheDocument();

    const blocos = screen.getAllByTestId(/^bloco-/).map((b) => b.dataset.testid);
    expect(blocos[blocos.length - 1]).toBe('bloco-questoes');
  });

  it('não mostra a coluna Variação com um único simulado', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');
    expect(screen.queryByText('Variação')).toBeNull();
  });

  /**
   * Com um simulado não há evolução: o bloco ocupava 300px para mostrar um
   * ponto solto e a frase "a evolução aparece a partir do segundo simulado" —
   * meia tela de scroll para dizer que não há o que dizer. O número daquele
   * ponto continua no KPI de proficiência média, logo acima.
   *
   * A decisão sai da SELEÇÃO, não da contagem de pontos medidos: assim o
   * bloco nunca aparece como skeleton para sumir quando o dado chega.
   */
  it('não monta "Evolução do recorte" com um único simulado', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.queryByTestId('bloco-evolucao')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Evolução do recorte' })).toBeNull();
    // O valor não se perde: continua no KPI.
    expect(screen.getByTestId('kpi-proficiencia-media')).toBeInTheDocument();
  });

  /**
   * Com um semestre específico o bloco não é evolução — é a distribuição
   * daquele semestre (§4.5), que faz sentido com um simulado só.
   */
  it('com semestre específico, a distribuição do semestre continua aparecendo', () => {
    renderRota('?ies=ies-1&semestre=11&simulados=s1');
    expect(screen.getByTestId('bloco-evolucao')).toBeInTheDocument();
  });

  it('abre o drawer do aluno ao clicar no nome, com o nome do aluno (real DrawerAluno exige a prop)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    await user.click(screen.getByRole('button', { name: 'Ana' }));
    expect(screen.getByTestId('drawer-aluno')).toHaveTextContent('a1:Ana');
  });

  it('abre o cronograma pelo atalho, sem sair da tela', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.queryByTestId('cronograma-simulados')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver cronograma' }));
    expect(await screen.findByTestId('cronograma-simulados')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
  });

  /**
   * O drawer é CONTROLADO e fecha quando o recorte da URL muda. Sem isso ele
   * ficava na frente do Detalhamento que a gestora acabou de filtrar pelo
   * clique num simulado realizado: `CronogramaSimulados` navega para o MESMO
   * pathname, então o React Router não desmonta a rota nem o Sheet.
   */
  it('o drawer do cronograma fecha quando a navegação troca o recorte da URL', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    await user.click(screen.getByRole('button', { name: 'Ver cronograma' }));
    expect(await screen.findByTestId('cronograma-simulados')).toBeInTheDocument();

    // A navegação do cronograma reescreve `?simulados=` sem trocar de rota.
    await user.click(screen.getByRole('button', { name: 'Abrir simulado realizado' }));
    expect(screen.queryByTestId('cronograma-simulados')).toBeNull();
  });

  it('o atalho do cronograma não usa nenhum ícone fora do Fontello do Dendê', () => {
    const { container } = renderRota('?ies=ies-1&semestre=6ano&simulados=s1');
    const atalho = screen.getByRole('button', { name: 'Ver cronograma' });

    expect(atalho.querySelector('i.icon-dende-icons-chevron_right-outlined')).not.toBeNull();
    expect(atalho.querySelector('svg')).toBeNull();
    expect(container.querySelector('svg.lucide')).toBeNull();
  });
});

/**
 * O bloco de questões era o ÚNICO da rota fora do `BlocoGestor`: em
 * carregamento e em erro a gestora via a mesma tabela vazia com "Página 1 de
 * 1", sem skeleton, mensagem nem retry — o que tornava qualquer falha da RPC
 * silenciosa em produção.
 */
describe('Rota Detalhamento — bloco de questões tem a mesma régua de estados dos outros', () => {
  beforeEach(() => comSimulados(1));

  it('carregando: skeleton com altura reservada, nunca a tabela vazia', () => {
    vi.mocked(useQuestoes).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      isPlaceholderData: false,
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuestoes>);
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.getByTestId('bloco-questoes-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('linha-questao-1')).toBeNull();
  });

  it('erro: alerta com "Tentar novamente", que refaz a consulta de questões', async () => {
    const refetch = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.mocked(useQuestoes).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: false,
      isError: true,
      isPlaceholderData: false,
      isFetching: false,
      refetch,
    } as unknown as ReturnType<typeof useQuestoes>);
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    const bloco = within(screen.getByTestId('bloco-questoes'));
    await user.click(bloco.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('vazio: mensagem em vez de tabela sem linha com "Página 1 de 1"', () => {
    vi.mocked(useQuestoes).mockReturnValue({
      data: { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 },
      meta: META,
      isLoading: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuestoes>);
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.getByTestId('bloco-questoes')).toHaveTextContent('Sem questões para este recorte.');
    expect(screen.queryByText(/Página 1 de 1/)).toBeNull();
  });
});

describe('Rota Detalhamento — 2 simulados (§4.7.4, §12 casos 3, 6, 8)', () => {
  beforeEach(() => comSimulados(2));

  it('oculta o detalhamento das questões', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');

    expect(screen.queryByText('Detalhamento das questões')).toBeNull();
    expect(screen.queryByTestId('linha-questao-1')).toBeNull();
    expect(screen.queryByTestId('bloco-questoes')).toBeNull();
  });

  it('a partir de 2 simulados, "Evolução do recorte" volta — aí há o que comparar', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');
    expect(screen.getByTestId('bloco-evolucao')).toBeInTheDocument();
  });

  it('mostra a coluna Variação e o comparativo colapsado', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');

    expect(screen.getByRole('columnheader', { name: /Variação/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver comparativo completo/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByTestId('card-simulado-s1')).toBeInTheDocument();
    expect(screen.getByTestId('card-simulado-s2')).toBeInTheDocument();
  });

  it('o conceito ENAMED vira comparativo, sem média única', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');

    const enamed = screen.getByTestId('kpi-enamed');
    expect(within(enamed).queryByTestId('kpi-valor')).toBeNull();
    expect(within(enamed).getAllByTestId(/^enamed-/)).toHaveLength(2);
  });
});

describe('Rota Detalhamento — 6 simulados (§4.7.2, §12 caso 5)', () => {
  it('avisa sobre legibilidade sem bloquear a leitura', () => {
    comSimulados(6);
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2,s3,s4,s5,s6');

    // A copy passou a imprimir a contagem entre parênteses: "…ficam difíceis
    // de ler (6 selecionados)." O que importa é o aviso dizer QUANTOS são.
    expect(screen.getByTestId('aviso-legibilidade')).toHaveTextContent(/\(6 selecionados\)/);
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
    expect(screen.getByTestId('linha-aluno-a1')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Acerto por grande área e por semestre' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Rota Detalhamento — carregando e erro', () => {
  it('sem IES resolvida mostra loading, nunca o vazio', () => {
    vi.mocked(useGestorContexto).mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      isPlaceholderData: false,
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGestorContexto>);
    comSimulados(1, { isLoading: true, data: undefined, meta: undefined });
    renderRota('?semestre=6ano&simulados=s1');

    expect(screen.getByTestId('bloco-kpis-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('detalhamento-vazio')).toBeNull();
  });

  it('erro na query mostra EstadoErro com retry, tela continua utilizável', () => {
    const refetch = vi.fn();
    comSimulados(1, { isError: true, data: undefined, meta: undefined, refetch });
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByTestId('seletor-simulados')).toBeInTheDocument();
  });
});

/**
 * Paginação e filtro de área das questões são estado do RECORTE, não da tela.
 *
 * Sem esta limpeza a gestora ficava PRESA: na página 3 do Simulado A (60
 * questões), trocar para o Simulado B (18) mantinha `p_page = 3`. A RPC não
 * clampa a página contra o total, devolve lista vazia com `total: 18`, e como o
 * bloco só entra em vazio quando `total = 0`, a tabela renderizava cabeçalho e
 * rodapé — "Mostrando 0 de 18 questões" — com o corpo vazio. Pior: a
 * `Paginacao` clampa a EXIBIÇÃO para "1 de 1", então os dois chevrons saíam
 * desabilitados e não sobrava nenhum controle que oferecesse saída.
 */
describe('Rota Detalhamento — troca de recorte reinicia a leitura das questões', () => {
  /** Última paginação pedida ao hook — é o que vira `p_page`/`p_area` na RPC. */
  const ultimoPedido = () => {
    const chamadas = vi.mocked(useQuestoes).mock.calls;
    return chamadas[chamadas.length - 1]?.[1];
  };

  it('trocar de simulado volta para a página 1 e limpa o filtro de área', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    // 3 páginas de questões, para o rodapé oferecer navegação de verdade.
    vi.mocked(useQuestoes).mockReturnValue({
      data: { data: [questao], page: 1, pageSize: 20, total: 60, totalPages: 3 },
      meta: META,
      isLoading: false,
      isError: false,
      isPlaceholderData: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useQuestoes>);
    comSimulados(1);

    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    // A tela tem DUAS paginações (alunos e questões); escopar ao bloco certo.
    const blocoQuestoes = await screen.findByTestId('bloco-questoes');
    await user.click(within(blocoQuestoes).getByRole('button', { name: 'Página 2' }));
    expect(ultimoPedido()?.page).toBe(2);

    /* Navegação REAL, pelo cronograma: reescreve `?simulados=` no mesmo
       pathname. `rerender` com outro `initialEntries` não serviria — o
       MemoryRouter só lê `initialEntries` na montagem, então a URL nunca
       mudaria e o teste passaria sem nunca ter havido troca de recorte. */
    await user.click(screen.getByRole('button', { name: 'Ver cronograma' }));
    await user.click(screen.getByRole('button', { name: 'Abrir simulado realizado' }));

    expect(ultimoPedido()?.page).toBe(1);
    expect(ultimoPedido()?.area).toBeNull();
  });
});
