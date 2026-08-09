// src/features/gestor/__tests__/a11y.test.tsx
//
// Task 58: acessibilidade testada de verdade (axe-core via vitest-axe) nas
// três rotas do Portal do Gestor v2 e nos dois drawers — o caso mais
// provável de armadilha de foco (Sheet/Dialog do Radix).
//
// Padrão de mock (confirmado contra VisaoGeral.test.tsx/Detalhamento.test.tsx/
// Inicio.test.tsx, todos já em produção nesta working tree): mocka a CAMADA
// DE HOOKS `@/features/gestor/api/queries`, nunca `supabase.rpc` diretamente.
// `useFiltrosGestor` fica REAL (URL via `MemoryRouter`): assim o
// `FiltroSemestre` real (role="radiogroup") entra na varredura do axe em vez
// de um stub.
//
// Achado de infraestrutura (documentado para quem mexer aqui depois): o
// `Sheet` do shadcn (`src/components/ui/sheet.tsx`) usa
// `SheetPrimitive.Portal` do Radix SEM `container` — o conteúdo do drawer
// aberto (overlay + painel) é anexado a `document.body`, FORA da `container`
// que `render()` devolve. Rodar `axe(container)` nos testes de drawer
// varreria uma árvore praticamente vazia e daria "zero violações" sem checar
// nada. Por isso todo `axe(...)` abaixo roda sobre `document.body`, nunca
// sobre `container`.
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

import Inicio from '@/features/gestor/routes/Inicio';
import VisaoGeral from '@/features/gestor/routes/VisaoGeral';
import Detalhamento from '@/features/gestor/routes/Detalhamento';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { DrawerTemas, type EspecialidadeSelecionada } from '@/features/gestor/components/DrawerTemas';
import type { RecorteDiagnostico } from '@/features/gestor/components/CascataDiagnostico';

import {
  useAluno,
  useAlunos,
  useAvisos,
  useCronograma,
  useDetalhamento,
  useDiagnostico,
  useDiagnosticoTemas,
  useGestorContexto,
  useQuestoes,
  useVisaoGeral,
} from '@/features/gestor/api/queries';
import type {
  AlunoNoSimulado,
  AlunoSimuladoEntry,
  Aviso,
  ContextoGestor,
  ItemCronograma,
  Meta,
  MetricasSimulado,
  Questao,
  TemaCritico,
} from '@/features/gestor/api/types';
import type { DetalhamentoComExtras } from '@/features/gestor/api/detalhamentoExtras';
import { metaFake, visaoGeralFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: vi.fn(),
  useCronograma: vi.fn(),
  useAvisos: vi.fn(),
  useVisaoGeral: vi.fn(),
  useDiagnostico: vi.fn(),
  useDiagnosticoTemas: vi.fn(),
  useAlunos: vi.fn(),
  useAluno: vi.fn(),
  useAlunoContato: vi.fn(() => ({ data: undefined, meta: null, isLoading: false, isError: false, refetch: () => {} })),
  useAlunoDesempenhoPorArea: vi.fn(() => ({ data: [], isLoading: false, isError: false, refetch: () => {} })),
  useDetalhamento: vi.fn(),
  useDetalhamentoTemas: vi.fn(() => ({ data: [], isLoading: false, isError: false, refetch: () => {} })),
  useQuestoes: vi.fn(),
}));

/**
 * `DirecionadoresGestor` (filho de `Inicio`) e `useMarcarAvisoLido` (usado por
 * `AvisosSanar`) chamam `useAuth()` de verdade — que explode fora de um
 * `<AuthProvider>`. Mesmo mock mínimo de `Inicio.test.tsx`: só `user.id`
 * importa para estes dois consumidores.
 */
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', nome: 'Admin', email: 'admin@sanar.com', id_ies: 'ies-1' } }),
}));

/**
 * `color-contrast`: jsdom não calcula layout nem cor computada — verificação
 * manual roteirizada (ver relatório final). `region`: exige que todo
 * conteúdo viva dentro de landmark de página inteira (`<main>`, `<header>`
 * etc.), que só o `GestorShell` fornece; as rotas aqui são montadas isoladas,
 * sem o shell ao redor — mesma exceção documentada no plano da Task 58.
 */
const AXE_CONFIG = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
};

/** Varre sempre `document.body` — nunca a `container` (ver nota de topo sobre o Portal do Sheet). */
async function checarSemViolacoes() {
  const resultado = await axe(document.body, AXE_CONFIG);
  expect(resultado).toHaveNoViolations();
}

function montar(ui: React.ReactElement, initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TooltipProvider>{ui}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ------------------------------------------------------------------------ */
/* Fixtures — valores mínimos e plausíveis, só para varrer o DOM real        */
/* ------------------------------------------------------------------------ */

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const CONTEXTO: ContextoGestor = {
  usuario: { id: 'user-1', nome: 'Marina Alves', papel: 'gestor' },
  iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade Teste' }],
  iesAtual: { id: 'ies-1', nome: 'Universidade Teste' },
  contrato: { nome: 'Academy 2026', simuladosContratados: 7, vigencia: '01/01/2026 a 31/12/2026' },
  podeTrocarIes: false,
  podeExportar: true,
};

const CRONOGRAMA: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-08-18T12:00:00Z', status: 'agendado', modalidade: 'presencial', participantes: null },
];

const AVISOS: Aviso[] = [
  { id: 'a1', titulo: 'Manutenção programada', resumo: 'Janela no sábado.', data: '2026-07-20T12:00:00Z', lido: false },
];

const PAGINADO_ALUNOS_VAZIO = { data: [], page: 1, pageSize: 25, total: 0, totalPages: 0 };

const TEMAS: TemaCritico[] = [
  { id: 'tema-ic', nome: 'Insuficiência cardíaca', acertoPct: 22, amostra: 118, lowSample: false },
  { id: 'tema-arritmia', nome: 'Arritmias', acertoPct: 41, amostra: 7, lowSample: true },
];

const ESPECIALIDADE: EspecialidadeSelecionada = { id: 'esp-cardio', nome: 'Cardiologia', grandeArea: 'Clínica Médica' };
const RECORTE_DIAGNOSTICO: RecorteDiagnostico = { iesId: 'ies-1', semestre: '6ano' };

const ENTRADA_ALUNO: AlunoSimuladoEntry = {
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

const metrica = (i: number): MetricasSimulado => ({
  simuladoId: `s${i}`,
  nome: `Simulado ${i}`,
  data: `2026-0${i}-10T13:00:00Z`,
  participantes: 100,
  acertoMedioPct: 60 + i,
  enamedProjetado: 3,
  proficienciaMedia: 55 + i,
});

const ALUNO_DETALHE: AlunoNoSimulado = {
  id: 'a1',
  nome: 'Ana',
  semestre: 11,
  participou: true,
  acertos: 60,
  proficiencia: 72,
  situacao: 'proficiente',
  variacao: 5,
};

const QUESTAO: Questao = {
  numero: 1,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  acertoPct: 42,
  enunciado: 'Enunciado da questão 1',
  alternativas: [
    { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: 42 },
    { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: 31 },
    { letra: 'C', texto: 'Alternativa C', correta: false, marcadaPct: 15 },
    { letra: 'D', texto: 'Alternativa D', correta: false, marcadaPct: 8 },
    { letra: 'E', texto: 'Alternativa E', correta: false, marcadaPct: 4 },
  ],
};

const DETALHAMENTO_1_SIMULADO: DetalhamentoComExtras = {
  metricas: [metrica(1)],
  acertoPorAreaESemestre: {
    areas: [{ id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false }],
    semestres: [{ semestre: 11, acertoPct: 63, emEvidencia: true }],
    matriz: [{ areaId: 'clinica', semestre: 11, acertoPct: 66, amostra: 120 }],
  },
  dispersao: [{ alunoId: 'a1', semestre: 11, nota: 72 }],
  alunos: [ALUNO_DETALHE],
};

/** Forma comum de `ResultadoGestor<T>` — cast `as unknown as ReturnType<...>` no uso, mesmo padrão do resto do repo. */
function resultadoOk(data: unknown, meta: Meta | undefined = META) {
  return {
    data,
    meta,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.mocked(useGestorContexto).mockReturnValue(resultadoOk(CONTEXTO) as unknown as ReturnType<typeof useGestorContexto>);
  vi.mocked(useCronograma).mockReturnValue(resultadoOk(CRONOGRAMA) as unknown as ReturnType<typeof useCronograma>);
  vi.mocked(useAvisos).mockReturnValue(resultadoOk(AVISOS) as unknown as ReturnType<typeof useAvisos>);
  vi.mocked(useVisaoGeral).mockReturnValue(
    resultadoOk(visaoGeralFake, metaFake) as unknown as ReturnType<typeof useVisaoGeral>,
  );
  vi.mocked(useDiagnostico).mockReturnValue(resultadoOk([], metaFake) as unknown as ReturnType<typeof useDiagnostico>);
  vi.mocked(useDiagnosticoTemas).mockReturnValue(
    resultadoOk(TEMAS, META) as unknown as ReturnType<typeof useDiagnosticoTemas>,
  );
  vi.mocked(useAlunos).mockReturnValue(
    resultadoOk(PAGINADO_ALUNOS_VAZIO, metaFake) as unknown as ReturnType<typeof useAlunos>,
  );
  vi.mocked(useAluno).mockReturnValue(resultadoOk(undefined, undefined) as unknown as ReturnType<typeof useAluno>);
  vi.mocked(useDetalhamento).mockReturnValue(
    resultadoOk(DETALHAMENTO_1_SIMULADO, META) as unknown as ReturnType<typeof useDetalhamento>,
  );
  vi.mocked(useQuestoes).mockReturnValue(
    resultadoOk({ data: [QUESTAO], page: 1, pageSize: 20, total: 1, totalPages: 1 }, META) as unknown as ReturnType<
      typeof useQuestoes
    >,
  );
});

/* ------------------------------------------------------------------------ */
/* Zero violações de axe, por rota e por drawer (§11 do handoff)            */
/* ------------------------------------------------------------------------ */

/**
 * Uma varredura completa do axe sobre uma rota inteira do portal custa dezenas
 * de segundos em jsdom — a Visão Geral monta 4 KPIs, gráfico, cascata,
 * distribuição e uma tabela de alunos. Com o timeout padrão de 15s a rota mais
 * pesada estourava, e o pior era o efeito colateral: o axe abortado no meio
 * ficava marcado como "already running" e derrubava os TRÊS casos seguintes,
 * que na verdade nunca chegaram a rodar. Um teste que reprova por relógio, e
 * ainda contamina os vizinhos, não diz nada sobre acessibilidade.
 */
const TIMEOUT_AXE = 120_000;

describe('acessibilidade — sem violações de axe por rota e por drawer (§11)', () => {
  it('Início', async () => {
    montar(<Inicio />, '/gestor');
    expect(screen.getByTestId('saudacao')).toBeInTheDocument();
    expect(screen.getByTestId('cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();

    /**
     * ACHADO real (axe, `heading-order`), **corrigido em 05/08**: a rota
     * montava `<h1>` (saudação) seguido direto de `<h3>`, porque o `CardTitle`
     * do shadcn (`src/components/ui/card.tsx:36`) sempre renderiza `<h3>`.
     * Corrigido com `aria-level={2}` no `CronogramaSimulados`, em vez de mexer
     * no `card.tsx`, que é compartilhado com aluno e admin. O `<h3>` do
     * `AvisosSanar` deixou de violar por consequência: a regra acusa NÍVEL
     * PULADO, e com o `h2` presente a sequência h1 → h2 → h3 é legal.
     */
    const resultado = await axe(document.body, AXE_CONFIG);
    expect(resultado, 'heading-order na rota Início — ver comentário acima').toHaveNoViolations();
  }, TIMEOUT_AXE);

  it('Visão Geral', async () => {
    montar(<VisaoGeral />, '/gestor/visao-geral?ies=ies-1&semestre=6ano');
    expect(screen.getByRole('toolbar', { name: /modo do gráfico/i })).toBeInTheDocument();
    await checarSemViolacoes();
  }, TIMEOUT_AXE);

  it('Detalhamento com 1 simulado', async () => {
    montar(<Detalhamento />, '/gestor/detalhamento?ies=ies-1&semestre=6ano&simulados=s1');
    expect(screen.getByRole('heading', { name: /detalhamento por simulados/i })).toBeInTheDocument();

    /**
     * ACHADO real (axe, `heading-order`), **corrigido em 05/08**: a rota tem
     * `<h1>Detalhamento por simulados</h1>` seguido de `<h3>` sem `<h2>` no
     * meio. O `EvolucaoRecorte` passou a usar `<h2>`, que é o nível que o
     * `BlocoGestor` já usa para título de bloco — o componente estava fora do
     * padrão da casa. O `<h3>` de "Nota por semestre" deixou de violar por
     * consequência: a regra acusa NÍVEL PULADO, não a existência do `h3`.
     */
    const resultado = await axe(document.body, AXE_CONFIG);
    expect(resultado, 'heading-order na rota Detalhamento — ver comentário acima').toHaveNoViolations();
  }, TIMEOUT_AXE);

  it('DrawerAluno aberto', async () => {
    vi.mocked(useAluno).mockReturnValue(
      resultadoOk([ENTRADA_ALUNO], undefined) as unknown as ReturnType<typeof useAluno>,
    );
    montar(<DrawerAluno alunoId="a1" nome="Ana Prado" simulados={['s1']} onFechar={() => {}} />, '/gestor');
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Ana Prado/);
    await checarSemViolacoes();
  }, TIMEOUT_AXE);

  it('DrawerTemas aberto', async () => {
    montar(
      <DrawerTemas
        especialidade={ESPECIALIDADE}
        recorte={RECORTE_DIAGNOSTICO}
        onFechar={() => {}}
        onExportarRecorte={() => {}}
      />,
      '/gestor',
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Temas de Cardiologia/i);
    await checarSemViolacoes();
  }, TIMEOUT_AXE);
});

/* ------------------------------------------------------------------------ */
/* Foco no drawer — o caso mais provável de armadilha (§11)                 */
/* ------------------------------------------------------------------------ */

function HostDrawerTemas() {
  const [aberto, setAberto] = React.useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>abrir temas</button>
      <DrawerTemas
        especialidade={aberto ? ESPECIALIDADE : null}
        recorte={RECORTE_DIAGNOSTICO}
        onFechar={() => setAberto(false)}
        onExportarRecorte={() => {}}
      />
    </>
  );
}

function HostDrawerAluno() {
  const [aberto, setAberto] = React.useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>abrir aluno</button>
      <DrawerAluno alunoId={aberto ? 'a1' : null} nome="Ana Prado" simulados={['s1']} onFechar={() => setAberto(false)} />
    </>
  );
}

describe('acessibilidade — foco não escapa do drawer e ESC devolve o foco ao disparador (§11)', () => {
  beforeEach(() => {
    vi.mocked(useAluno).mockReturnValue(
      resultadoOk([ENTRADA_ALUNO], undefined) as unknown as ReturnType<typeof useAluno>,
    );
  });

  /**
   * ACHADO real de foco, encontrado por este teste e **corrigido em 05/08**.
   *
   * O que era: `DrawerTemas`/`DrawerAluno` renderizam `<Sheet open>` com
   * `open` LITERAL (sempre `true`) — quem "fecha" é o PAI, deixando de passar
   * `especialidade`/`alunoId` e fazendo o componente retornar `null`. O Radix
   * nunca observa a transição `open: true -> false`, então o `FocusScope`
   * dele não devolvia o foco: `document.activeElement` caía em `<body>` e
   * ficava lá (reproduzido de forma síncrona e 500ms depois — não era timing
   * de jsdom).
   *
   * O que consertou: `useDevolverFocoAoFechar`, que captura o disparador na
   * renderização e o restaura na limpeza do efeito. O conserto de raiz — os
   * drawers passarem `open={aberto}` de verdade — continua em aberto, então
   * **estes dois testes são a rede que segura a regressão** se alguém
   * reestruturar os drawers e remover o hook.
   */
  it('DrawerTemas: ESC fecha e o foco volta para o disparador', async () => {
    const user = userEvent.setup();
    montar(<HostDrawerTemas />, '/gestor');
    const disparador = screen.getByRole('button', { name: 'abrir temas' });

    await user.click(disparador);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(disparador, 'ESC deve devolver o foco ao disparador — ver useDevolverFocoAoFechar').toHaveFocus();
  });

  it('DrawerTemas: Tab não alcança conteúdo de fora do drawer', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    montar(
      <>
        <button>fora</button>
        <DrawerTemas
          especialidade={ESPECIALIDADE}
          recorte={RECORTE_DIAGNOSTICO}
          onFechar={() => {}}
          onExportarRecorte={() => {}}
        />
      </>,
      '/gestor',
    );
    const painel = screen.getByRole('dialog');
    // Não usa `getByRole('button', ...)`: o Radix marca TODO o resto da
    // página `aria-hidden="true"` enquanto o modal está aberto (correto —
    // é assim que um leitor de tela deve se comportar), e `getByRole`
    // respeita isso de propósito. `getByText` pega o nó mesmo hidden, para
    // testar a armadilha de TECLADO (Tab), que é uma garantia separada.
    const fora = screen.getByText('fora');

    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(fora).not.toHaveFocus();
      expect(painel.contains(document.activeElement)).toBe(true);
    }
  });

  it('DrawerAluno: ESC fecha e o foco volta para o disparador', async () => {
    const user = userEvent.setup();
    montar(<HostDrawerAluno />, '/gestor');
    const disparador = screen.getByRole('button', { name: 'abrir aluno' });

    await user.click(disparador);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(disparador, 'ESC deve devolver o foco ao disparador — ver useDevolverFocoAoFechar').toHaveFocus();
  });

  it('DrawerAluno: Tab não alcança conteúdo de fora do drawer', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    montar(
      <>
        <button>fora</button>
        <DrawerAluno alunoId="a1" nome="Ana Prado" simulados={['s1']} onFechar={() => {}} />
      </>,
      '/gestor',
    );
    const painel = screen.getByRole('dialog');
    // Ver comentário no teste equivalente do DrawerTemas acima: `getByText`,
    // não `getByRole`, porque o resto da página fica `aria-hidden` de propósito.
    const fora = screen.getByText('fora');

    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(fora).not.toHaveFocus();
      expect(painel.contains(document.activeElement)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------------ */
/* Gráficos: role="img" com nome acessível + alternativa tabular (§11)      */
/* ------------------------------------------------------------------------ */

describe('acessibilidade — gráficos têm nome acessível e alternativa tabular (§11)', () => {
  /**
   * A Visão Geral tem DOIS `role="img"` simultâneos no modo padrão ("geral"):
   * o gráfico protagonista (Evolução) E o gráfico de dispersão dentro do
   * bloco "Visão de Alunos" (`VisaoDeAlunos` recebe `dispersao` e desenha o
   * seu próprio `DispersaoChart`, independente do seletor de modo do
   * protagonista) — por isso `getAllByRole`, nunca `getByRole` singular.
   */
  it('todo gráfico expõe role="img" com nome, dentro de <figure>, com tabela alternativa colapsável', () => {
    montar(<VisaoGeral />, '/gestor/visao-geral?ies=ies-1&semestre=6ano');

    // UM gráfico visível por vez desde 07/08: a dispersão duplicada saiu da
    // "Visão de Alunos" (era o mesmo gráfico do modo "Aluno" do protagonista,
    // na mesma tela). O que este teste protege não é a quantidade — é que
    // TODO gráfico presente tenha nome, <figure> e alternativa tabular.
    const graficos = screen.getAllByRole('img');
    expect(graficos.length).toBeGreaterThanOrEqual(1);

    for (const grafico of graficos) {
      expect(grafico).toHaveAccessibleName(/\S/);
      const figura = grafico.closest('figure');
      expect(figura, 'todo gráfico vive dentro de <figure>').not.toBeNull();
      expect(within(figura as HTMLElement).getByText('Ver dados em tabela')).toBeInTheDocument();
      expect(within(figura as HTMLElement).getByRole('table')).toBeInTheDocument();
    }
  });

  /**
   * NÃO dá para testar aqui "o <svg> do recharts nunca é exposto ao leitor de
   * tela": o `ResponsiveContainer` do recharts só desenha o `<svg>` depois de
   * medir a própria largura via `ResizeObserver` — e o mock global de
   * `ResizeObserver` (`src/test/setup.ts`) é inerte (`observe: vi.fn()`,
   * nunca chama o callback). Confirmado por inspeção: em jsdom,
   * `.recharts-responsive-container` renderiza SEM FILHOS (nenhum `<svg>` é
   * desenhado). A garantia "role=img no contêiner torna os descendentes
   * presentational" (ARIA 1.2) só é verificável de verdade num navegador real
   * ou com um polyfill de `ResizeObserver` que dispare com dimensões — ver
   * item 4 do relatório final (lista do que o axe em jsdom não cobre).
   */
});
