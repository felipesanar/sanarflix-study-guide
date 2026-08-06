/**
 * Task 57 — suíte dos 17 casos de teste críticos da spec §12
 * (`docs/superpowers/specs/2026-07-25-portal-gestor-v2-design.md`).
 *
 * DIVERGÊNCIAS DO PLANO (`docs/superpowers/plans/2026-07-25-portal-gestor-v2.md`,
 * Task 57) registradas aqui para quem ler depois — a árvore real (Fases 3-5
 * completas) não corresponde ao pseudocódigo do plano, escrito antes da
 * implementação existir:
 *
 * 1. Mock de dados: o plano propõe `criarRpcMock()` mockando `supabase.rpc`.
 *    O padrão REAL e confirmado deste repo (`VisaoGeral.test.tsx`,
 *    `TabelaAlunos.test.tsx`, `seguranca-lgpd.test.tsx`) mocka
 *    `@/features/gestor/api/queries` — a camada de HOOKS, não a RPC. Esta
 *    suíte segue o padrão real. A única exceção documentada é o caso 4
 *    ("nenhuma requisição de métrica"): mockar o hook tornaria essa asserção
 *    vazia por construção (um hook mockado nunca "faz requisição" de
 *    qualquer forma), então ali o teste usa `vi.importActual` para pegar o
 *    `useDetalhamento` REAL e espiona `supabase.rpc` só naquele bloco —
 *    mesma técnica de `TabelaAlunos.test.tsx` (que mantém `normalizarLinhaAluno`
 *    real dentro de um mock parcial do módulo).
 *
 * 2. `SidebarIes` não recebe mais `contexto` por prop — lê
 *    `useGestorContexto()`/`useFiltrosGestor()` diretamente.
 *
 * 3. `DrawerTemas` não tem prop `aberto`/`temas` — abre quando `especialidade`
 *    (objeto `{id,nome,grandeArea}`) não é `null`, e busca temas via
 *    `useDiagnosticoTemas` (mockado aqui).
 *
 * 4. O controle "Modo do gráfico" de `GraficoProtagonista` é
 *    `role="toolbar"` com botões `aria-pressed` (roving tabindex, mesmo
 *    padrão de `FiltroSemestre`) — NÃO `role="radiogroup"`/`role="radio"`
 *    como o plano supôs antes do componente existir. É um padrão ARIA válido
 *    (grupo de alternância de leitura única, replicado deliberadamente do
 *    padrão já usado em `FiltroSemestre`); os testes abaixo usam os papéis
 *    reais.
 *
 * 5. Não existe, em lugar nenhum da árvore, um `role="group"` com nome
 *    "semestres comparados" (o C8 do plano). Não encontrei esse contrato
 *    implementado — ver item 4 do relatório final para a nota completa. O
 *    caso 9 aqui testa o mecanismo REAL que cobre a mesma regra da spec
 *    §4.5 ("controles multi-semestre somem; gráfico vira distribuição"):
 *    `FiltroSemestre` (dropdown 1º–12º que só aparece em "Por semestre") e
 *    `DispersaoChart` (jitter + mediana só em semestre único).
 *
 * 6. `DispersaoChart` usa o MESMO `aria-label` ("Dispersão de proficiência
 *    por semestre...") em multi e em semestre único — não alterna para
 *    "distribuição" como o C6 do plano supôs. Ver ACHADO no relatório final.
 *
 * 7. Não existe, em nenhuma tela, o texto "Você não tem acesso a este
 *    recorte." (C9 do plano). O caso 17 aqui testa o mecanismo real:
 *    `ResultadoGestor` (o contrato que todo hook devolve) só expõe
 *    `isError: boolean`, nunca a mensagem crua do erro — nenhum componente
 *    consegue renderizar o que não recebe.
 */
import * as React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, userEvent, waitFor, within } from '@/test/utils';

import {
  ALUNOS_SIMULADO,
  ALUNO_SEM_PARTICIPACAO_ID,
  AREAS_E_SEMESTRES,
  CONTEXTO_ADMIN,
  CONTEXTO_GESTOR,
  CRONOGRAMA_VAZIO,
  CRUZAMENTO_MATRIZ,
  DETALHAMENTO_1_SIMULADO,
  DETALHAMENTO_2_SIMULADOS,
  DISPERSAO_SEMESTRE_UNICO,
  IES_BETA_ID,
  IES_FORA_DE_ESCOPO_ID,
  IES_ID,
  META,
  METRICAS_1_SIMULADO,
  METRICAS_2_SIMULADOS,
  SIM_1,
  SIM_2,
  TEMAS_CRITICOS,
  VISAO_GERAL,
  resultadoOk,
} from './fixtures/regrasCriticas';

import { PROFICIENCIA_MINIMA, calcularVariacao, ehProficiente, nivelDesempenho } from '@/features/gestor/lib/regras';
import { TRACO } from '@/features/gestor/lib/formatters';
import {
  useAlunos,
  useAluno,
  useCronograma,
  useDetalhamento,
  useDiagnostico,
  useDiagnosticoTemas,
  useGestorContexto,
  useQuestoes,
  useVisaoGeral,
} from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import VisaoGeralRoute from '@/features/gestor/routes/VisaoGeral';
import DetalhamentoRoute from '@/features/gestor/routes/Detalhamento';
import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';
import { TabelaAlunosSimulado } from '@/features/gestor/components/TabelaAlunosSimulado';
import { KpisDetalhamento } from '@/features/gestor/components/KpisDetalhamento';
import { AcertoPorAreaESemestre, semestresEmEvidencia } from '@/features/gestor/components/AcertoPorAreaESemestre';
import { DrawerTemas } from '@/features/gestor/components/DrawerTemas';
import { DispersaoChart, medianaDeNotas, prepararPontos } from '@/features/gestor/charts/DispersaoChart';
import { LegacyGestorGate, PORTAL_V2_FEATURE, PortalV2Gate } from '@/features/gestor/portalV2Gates';
import type { RecorteCruzado } from '@/features/gestor/api/detalhamentoExtras';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks de módulo (hoisted). Padrão real confirmado: mocka a camada de hooks
// (`api/queries`, `hooks/useFiltrosGestor`), não `supabase.rpc`.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/features/gestor/api/queries', () => ({
  useVisaoGeral: vi.fn(),
  useAlunos: vi.fn(),
  useAluno: vi.fn(),
  useDiagnostico: vi.fn(),
  useDiagnosticoTemas: vi.fn(),
  useGestorContexto: vi.fn(),
  useCronograma: vi.fn(),
  useDetalhamento: vi.fn(),
  useQuestoes: vi.fn(),
}));

vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({
  useFiltrosGestor: vi.fn(),
}));

const mockToast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockUseEffectiveFeatures = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useEffectiveFeatures', () => ({ useEffectiveFeatures: () => mockUseEffectiveFeatures() }));

/**
 * `src/test/setup.ts` mocka `react-router-dom` GLOBALMENTE com `useLocation`
 * fixo (`{pathname:'/'}`, sem `search`) e `useNavigate` no-op. Isso quebraria
 * `PortalV2Gate`/`LegacyGestorGate` (caso 16, usam `useLocation().search` de
 * verdade) e o `useFiltrosGestor` real do caso 12 (usa `useSearchParams`).
 * Mesma correção já usada em `tema.test.tsx`: reimportar o módulo real.
 */
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

/**
 * `supabase.rpc` espionado — usado SÓ pelo caso 4 (prova de rede), que
 * mantém `useDetalhamento` REAL via `vi.importActual` para exercitar o
 * `enabled` de verdade. Nenhum outro teste desta suíte chama `supabase.rpc`
 * (todos os outros hooks ficam mockados na camada de cima).
 */
const rpcSpy = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcSpy(...args),
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() })),
    auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const filtrosFake = (
  overrides: Partial<ReturnType<typeof useFiltrosGestor>> = {},
): ReturnType<typeof useFiltrosGestor> => ({
  semestre: '6ano',
  setSemestre: vi.fn(),
  simulados: [],
  setSimulados: vi.fn(),
  iesId: IES_ID,
  setIesId: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  mockToast.mockClear();

  mockUseAuth.mockReturnValue({
    user: { id: 'u1', nome: 'Gestor Teste', email: 'g@ies.edu.br', id_ies: IES_ID, roles: ['gestor'] },
    access: { roles: ['gestor'], experiences: ['gestao'], capabilities: [] },
    isImpersonating: false,
  });

  mockUseEffectiveFeatures.mockReturnValue({ hasFeature: () => true, loading: false });

  vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake());

  vi.mocked(useGestorContexto).mockReturnValue(
    resultadoOk(CONTEXTO_ADMIN) as unknown as ReturnType<typeof useGestorContexto>,
  );
  vi.mocked(useVisaoGeral).mockReturnValue(
    resultadoOk(VISAO_GERAL) as unknown as ReturnType<typeof useVisaoGeral>,
  );
  vi.mocked(useAlunos).mockReturnValue(
    resultadoOk({ data: [], page: 1, pageSize: 25, total: 0, totalPages: 0 }) as unknown as ReturnType<
      typeof useAlunos
    >,
  );
  vi.mocked(useAluno).mockReturnValue(
    resultadoOk(undefined) as unknown as ReturnType<typeof useAluno>,
  );
  vi.mocked(useDiagnostico).mockReturnValue(
    resultadoOk([]) as unknown as ReturnType<typeof useDiagnostico>,
  );
  vi.mocked(useDiagnosticoTemas).mockReturnValue(
    resultadoOk([]) as unknown as ReturnType<typeof useDiagnosticoTemas>,
  );
  vi.mocked(useCronograma).mockReturnValue(
    resultadoOk(CRONOGRAMA_VAZIO) as unknown as ReturnType<typeof useCronograma>,
  );
  vi.mocked(useDetalhamento).mockReturnValue(
    resultadoOk(DETALHAMENTO_1_SIMULADO) as unknown as ReturnType<typeof useDetalhamento>,
  );
  vi.mocked(useQuestoes).mockReturnValue(
    resultadoOk({ data: DETALHAMENTO_1_SIMULADO.questoes!.data, page: 1, pageSize: 20, total: 1, totalPages: 1 }) as unknown as ReturnType<
      typeof useQuestoes
    >,
  );

  rpcSpy.mockReset();
  rpcSpy.mockImplementation(async (fn: string) => {
    if (fn === 'get_gestor_detalhamento') {
      return { data: { data: DETALHAMENTO_1_SIMULADO, meta: META }, error: null };
    }
    return { data: null, error: { message: `rpc não mockada no teste: ${fn}` } };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§12 — casos de teste críticos do Portal do Gestor v2', () => {
  // ── Caso 1 ─────────────────────────────────────────────────────────────
  it('caso 1 — proficiente é >= 60: 60 é proficiente, 59,9 não é (§4.3)', () => {
    expect(PROFICIENCIA_MINIMA).toBe(60);
    expect(ehProficiente(60)).toBe(true);
    expect(ehProficiente(59.9)).toBe(false);
    expect(ehProficiente(60.1)).toBe(true);
    expect(ehProficiente(null)).toBe(false);
  });

  // ── Caso 2 ─────────────────────────────────────────────────────────────
  it('caso 2 — nenhuma tela expõe "Nota TRI"; a tabela por simulado tem UMA coluna 0–100 (§4.1)', () => {
    // A Visão Geral precisa sair da árvore antes da tabela por simulado
    // entrar: `screen` consulta o `document.body` inteiro, e a TabelaAlunos
    // da Visão Geral também tem coluna de proficiência. Sem este unmount, a
    // asserção de "UMA coluna" conta as duas telas somadas e falha por
    // artefato do teste, não por defeito do produto.
    const visaoGeral = render(<VisaoGeralRoute />);
    expect(screen.queryByText(/nota\s*tri/i)).not.toBeInTheDocument();
    visaoGeral.unmount();

    const { unmount } = render(<TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} multiSimulado={false} />);
    expect(screen.queryByRole('columnheader', { name: /nota\s*tri/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: /profici/i })).toHaveLength(1);
    unmount();
  });

  // ── Caso 3 ─────────────────────────────────────────────────────────────
  it('caso 3 — Conceito ENAMED nunca é média: com 2 simulados, dois valores; com 1, um valor único (§4.1)', () => {
    const { unmount } = render(<KpisDetalhamento metricas={METRICAS_2_SIMULADOS} meta={META} />);
    const cardEnamed = screen.getByTestId('kpi-enamed');
    // Nunca um valor único agregado quando há 2+ simulados.
    expect(within(cardEnamed).queryByTestId('kpi-valor')).not.toBeInTheDocument();
    expect(within(cardEnamed).getByTestId(`enamed-${SIM_1}`)).toHaveTextContent('2/5');
    expect(within(cardEnamed).getByTestId(`enamed-${SIM_2}`)).toHaveTextContent('3/5');
    expect(within(cardEnamed).getAllByText(/^[1-5]\/5$/)).toHaveLength(2);
    unmount();

    render(<KpisDetalhamento metricas={METRICAS_1_SIMULADO} meta={META} />);
    const cardEnamedUm = screen.getByTestId('kpi-enamed');
    expect(within(cardEnamedUm).getAllByText(/^[1-5]\/5$/)).toHaveLength(1);
    expect(within(cardEnamedUm).getByTestId('kpi-valor')).toHaveTextContent('2/5');
  });

  // ── Caso 4 ─────────────────────────────────────────────────────────────
  it('caso 4 (visual) — 0 simulados selecionados: estado vazio, nenhum outro bloco renderiza (§4.7.1)', async () => {
    vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ simulados: [] }));
    render(<DetalhamentoRoute />);

    expect(await screen.findByRole('heading', { name: 'Escolha ao menos um simulado' })).toBeInTheDocument();
    expect(screen.queryByTestId('bloco-kpis')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bloco-alunos')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /detalhamento das quest/i })).not.toBeInTheDocument();
  });

  it('caso 4 (rede) — useDetalhamento nasce desabilitado sem simulados: supabase.rpc nunca é chamado; com 1 simulado, é (§4.7.1)', async () => {
    // Ver nota 1 do cabeçalho: hook REAL via importActual, só para este teste
    // — provar "nenhuma requisição" com o hook mockado seria vazio por
    // construção.
    const { useDetalhamento: useDetalhamentoReal } = await vi.importActual<
      typeof import('@/features/gestor/api/queries')
    >('@/features/gestor/api/queries');

    function Sonda({ simulados }: { simulados: string[] }) {
      const r = useDetalhamentoReal({ iesId: IES_ID, semestre: '6ano', simulados });
      return (
        <span data-testid="estado-sonda">
          {r.isLoading ? 'carregando' : r.isError ? 'erro' : r.data ? 'ok' : 'ocioso'}
        </span>
      );
    }

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { rerender } = rtlRender(
      <QueryClientProvider client={client}>
        <Sonda simulados={[]} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('estado-sonda')).toHaveTextContent('ocioso'));
    expect(rpcSpy).not.toHaveBeenCalledWith('get_gestor_detalhamento', expect.anything());

    rerender(
      <QueryClientProvider client={client}>
        <Sonda simulados={[SIM_1]} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('estado-sonda')).toHaveTextContent('ok'));
    expect(rpcSpy).toHaveBeenCalledWith('get_gestor_detalhamento', expect.objectContaining({ p_simulados: [SIM_1] }));
  });

  // ── Caso 5 ─────────────────────────────────────────────────────────────
  it('caso 5 — mais de 5 simulados selecionados: aviso não-bloqueante, tela segue utilizável (§4.7.2)', async () => {
    const seis = [SIM_1, SIM_2, 's3', 's4', 's5', 's6'];
    vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ simulados: seis }));
    vi.mocked(useDetalhamento).mockReturnValue(
      resultadoOk(DETALHAMENTO_2_SIMULADOS) as unknown as ReturnType<typeof useDetalhamento>,
    );

    render(<DetalhamentoRoute />);

    const aviso = await screen.findByTestId('aviso-legibilidade');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent('6 simulados selecionados');
    expect(aviso).toHaveTextContent(/dif[ií]ceis de ler/i);

    // Não-bloqueante: as métricas continuam renderizadas e utilizáveis.
    expect(screen.getByTestId('bloco-kpis')).toBeInTheDocument();
    expect(screen.getAllByText('Simulado 1').length).toBeGreaterThan(0);
  });

  // ── Caso 6 ─────────────────────────────────────────────────────────────
  it('caso 6 — com 2+ simulados, "Detalhamento das Questões" não é renderizado; com 1, é o último bloco (§4.7.3-4)', async () => {
    vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ simulados: [SIM_1, SIM_2] }));
    vi.mocked(useDetalhamento).mockReturnValue(
      resultadoOk(DETALHAMENTO_2_SIMULADOS) as unknown as ReturnType<typeof useDetalhamento>,
    );
    const { unmount } = render(<DetalhamentoRoute />);
    // `findAllByText`, não `findByText`: "Simulado 2" aparece duas vezes de
    // propósito — no card e no `<th scope="row">` da alternativa tabular que
    // os gráficos oferecem (§11). Exigir ocorrência única puniria justamente
    // o comportamento acessível correto.
    await screen.findAllByText('Simulado 2');
    expect(screen.queryByRole('heading', { name: /detalhamento das quest/i })).not.toBeInTheDocument();
    unmount();

    vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ simulados: [SIM_1] }));
    vi.mocked(useDetalhamento).mockReturnValue(
      resultadoOk(DETALHAMENTO_1_SIMULADO) as unknown as ReturnType<typeof useDetalhamento>,
    );
    render(<DetalhamentoRoute />);
    expect(await screen.findByRole('heading', { name: /detalhamento das quest/i })).toBeInTheDocument();
  });

  // ── Caso 7 ─────────────────────────────────────────────────────────────
  it('caso 7 — aluno sem participação: TRAÇO + "Não participou", fora de toda média (§4.10)', () => {
    render(<TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} multiSimulado={false} />);
    const linha = screen.getByTestId(`linha-aluno-${ALUNO_SEM_PARTICIPACAO_ID}`);
    expect(linha).toHaveTextContent('Não participou');
    expect(within(linha).getByTestId('celula-acertos')).toHaveTextContent(TRACO);
    expect(within(linha).getByTestId('celula-proficiencia')).toHaveTextContent(TRACO);
    expect(within(linha).getByTestId('celula-acertos')).not.toHaveTextContent(/\d/);
    expect(within(linha).getByTestId('celula-proficiencia')).not.toHaveTextContent(/\d/);
  });

  // ── Caso 8 ─────────────────────────────────────────────────────────────
  it('caso 8 — variação só existe quando participou de TODOS os simulados comparados (§4.10)', () => {
    expect(calcularVariacao(58, 62)).toBe(4);
    expect(calcularVariacao(null, 62)).toBeNull();
    expect(calcularVariacao(58, null)).toBeNull();
    expect(calcularVariacao(null, null)).toBeNull();

    const { unmount } = render(<TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} multiSimulado />);
    expect(screen.getByRole('columnheader', { name: /varia/i })).toBeInTheDocument();
    const semParticipacao = screen.getByTestId(`linha-aluno-${ALUNO_SEM_PARTICIPACAO_ID}`);
    expect(within(semParticipacao).getByTestId('celula-variacao')).toHaveTextContent(TRACO);
    expect(within(semParticipacao).getByTestId('celula-variacao')).not.toHaveTextContent(/[+-]?\d/);
    unmount();

    render(<TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} multiSimulado={false} />);
    expect(screen.queryByRole('columnheader', { name: /varia/i })).not.toBeInTheDocument();
  });

  // ── Caso 9 ─────────────────────────────────────────────────────────────
  describe('caso 9 — semestre único: controles multi-semestre somem; comparação vira distribuição (§4.5)', () => {
    it('prepararPontos: multi-semestre não recebe jitter (x === semestre exato)', () => {
      const preparados = prepararPontos(VISAO_GERAL.dispersao);
      preparados.forEach((p, i) => expect(p.x).toBe(VISAO_GERAL.dispersao[i].semestre));
    });

    it('prepararPontos: semestre único aplica jitter determinístico ao redor do semestre (evita sobreposição total)', () => {
      const preparados = prepararPontos(DISPERSAO_SEMESTRE_UNICO);
      const esperado = [10.82, 10.88, 10.94, 11, 11.06];
      preparados.forEach((p, i) => expect(p.x).toBeCloseTo(esperado[i], 5));
      expect(new Set(preparados.map((p) => p.x)).size).toBe(preparados.length);
    });

    it('medianaDeNotas: calcula a mediana (só é EXIBIDA pelo componente em semestre único)', () => {
      expect(medianaDeNotas(DISPERSAO_SEMESTRE_UNICO)).toBe(64);
      expect(medianaDeNotas([])).toBeNull();
    });

    it('DispersaoChart: legenda de mediana só aparece com semestre único', () => {
      const { unmount } = render(<DispersaoChart pontos={VISAO_GERAL.dispersao} />);
      expect(screen.queryByText(/mediana do semestre/i)).not.toBeInTheDocument();
      unmount();

      render(<DispersaoChart pontos={DISPERSAO_SEMESTRE_UNICO} />);
      expect(screen.getByText(/mediana do semestre: 64/i)).toBeInTheDocument();
    });

    it('FiltroSemestre: "Por semestre" revela o dropdown 1º–12º; "6º ano"/"Geral" não mostram (§4.5, "controles somem")', () => {
      vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ semestre: '6ano' }));
      const rot1 = render(<FiltroSemestre />);
      expect(screen.queryByRole('combobox', { name: 'Semestre específico' })).not.toBeInTheDocument();
      rot1.unmount();

      vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ semestre: 'geral' }));
      const rot2 = render(<FiltroSemestre />);
      expect(screen.queryByRole('combobox', { name: 'Semestre específico' })).not.toBeInTheDocument();
      rot2.unmount();

      vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ semestre: '5' }));
      render(<FiltroSemestre />);
      expect(screen.getByRole('combobox', { name: 'Semestre específico' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Por semestre' })).toHaveAttribute('aria-checked', 'true');
    });
  });

  // ── Caso 10 ────────────────────────────────────────────────────────────
  describe('caso 10 — "6º ano": 11º e 12º em evidência, demais como referência (§4.5)', () => {
    it('semestresEmEvidencia: 6ano evidencia só 11 e 12; geral evidencia todos; semestre específico evidencia só ele', () => {
      expect(semestresEmEvidencia('6ano', [5, 11, 12])).toEqual([11, 12]);
      expect(semestresEmEvidencia('geral', [5, 11, 12])).toEqual([5, 11, 12]);
      expect(semestresEmEvidencia('5', [5, 11, 12])).toEqual([5]);
    });

    it('AcertoPorAreaESemestre com semestre="6ano": 11º/12º marcados em evidência, 5º não', () => {
      render(<AcertoPorAreaESemestre dados={AREAS_E_SEMESTRES} semestre="6ano" />);
      expect(screen.getByTestId('semestre-11')).toHaveAttribute('data-evidencia', 'true');
      expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-evidencia', 'true');
      expect(screen.getByTestId('semestre-5')).toHaveAttribute('data-evidencia', 'false');
    });
  });

  // ── Caso 11 ────────────────────────────────────────────────────────────
  it('caso 11 — clique cruzado área ↔ semestre recalcula o outro eixo; segundo clique limpa (§4.7)', async () => {
    // Harness com estado próprio (mesmo padrão de Detalhamento.tsx: `recorte`
    // é controlado pelo PAI). Sem realimentar `recorte` de volta ao
    // componente após cada clique, `alternar()` nunca vê o recorte já ativo
    // e o "segundo clique limpa" nunca dispara de verdade — armadilha do
    // pseudocódigo original do plano, que não tinha esse estado.
    function Harness({ spy }: { spy: (r: RecorteCruzado | null) => void }) {
      const [recorte, setRecorte] = React.useState<RecorteCruzado | null>(null);
      return (
        <AcertoPorAreaESemestre
          dados={AREAS_E_SEMESTRES}
          semestre="6ano"
          matriz={CRUZAMENTO_MATRIZ}
          recorte={recorte}
          onRecorteChange={(novo) => {
            setRecorte(novo);
            spy(novo);
          }}
        />
      );
    }

    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness spy={spy} />);

    await user.click(screen.getByRole('button', { name: /Pediatria/ }));
    expect(spy).toHaveBeenLastCalledWith({ tipo: 'area', id: 'a3' });
    // Semestres recalculados contra a3 (matriz): 11º passa a mostrar 24%.
    expect(within(screen.getByTestId('semestre-11')).getByText('24%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pediatria/ }));
    expect(spy).toHaveBeenLastCalledWith(null);

    await user.click(screen.getByRole('button', { name: /11º/ }));
    expect(spy).toHaveBeenLastCalledWith({ tipo: 'semestre', id: '11' });
    // Áreas recalculadas contra o semestre 11 (matriz).
    expect(within(screen.getByTestId('area-a1')).getByTestId('area-valor')).toHaveTextContent('65%');
    expect(within(screen.getByTestId('area-a3')).getByTestId('area-valor')).toHaveTextContent('24%');
  });

  // ── Caso 12 ────────────────────────────────────────────────────────────
  it('caso 12 — filtro de semestre vive na URL: lê do link/refresh e persiste ao escrever (§8.2)', async () => {
    // Hook REAL (bypassa o mock do módulo) — é o próprio objeto sob teste.
    const { useFiltrosGestor: useFiltrosGestorReal } = await vi.importActual<
      typeof import('@/features/gestor/hooks/useFiltrosGestor')
    >('@/features/gestor/hooks/useFiltrosGestor');

    function Sonda() {
      const { semestre, setSemestre, simulados, iesId } = useFiltrosGestorReal();
      const location = useLocation();
      return (
        <div>
          <span data-testid="semestre">{semestre}</span>
          <span data-testid="simulados">{simulados.join('|')}</span>
          <span data-testid="ies">{iesId ?? ''}</span>
          <span data-testid="url-search">{location.search}</span>
          <button onClick={() => setSemestre('7')}>trocar semestre</button>
        </div>
      );
    }

    // 1) Ler de uma URL específica é exatamente o que um refresh faz: não há
    // nenhuma outra fonte de estado além da própria URL.
    rtlRender(
      <MemoryRouter initialEntries={[`/gestor/detalhamento?semestre=9&simulados=${SIM_1},${SIM_2}&ies=${IES_ID}`]}>
        <Sonda />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('semestre')).toHaveTextContent('9');
    expect(screen.getByTestId('simulados')).toHaveTextContent(`${SIM_1}|${SIM_2}`);
    expect(screen.getByTestId('ies')).toHaveTextContent(IES_ID);
    expect(screen.getByTestId('url-search')).toHaveTextContent('semestre=9');

    // 2) Escrever atualiza a URL de verdade (não é estado React à parte) —
    // é isso que faz o recorte atravessar telas e sobreviver ao F5.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'trocar semestre' }));
    expect(screen.getByTestId('semestre')).toHaveTextContent('7');
    expect(screen.getByTestId('url-search')).toHaveTextContent('semestre=7');
  });

  // ── Caso 13 ────────────────────────────────────────────────────────────
  describe('caso 13 — gestor não recebe dropdown de IES; admin recebe (§3, §8.3)', () => {
    it('gestor: sem combobox, nome estático da IES', () => {
      vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ iesId: IES_ID }));
      vi.mocked(useGestorContexto).mockReturnValue(
        resultadoOk(CONTEXTO_GESTOR) as unknown as ReturnType<typeof useGestorContexto>,
      );
      render(<SidebarIes />);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByText('IES Alfa')).toBeInTheDocument();
    });

    it('admin: combobox presente', () => {
      vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ iesId: IES_ID }));
      vi.mocked(useGestorContexto).mockReturnValue(
        resultadoOk(CONTEXTO_ADMIN) as unknown as ReturnType<typeof useGestorContexto>,
      );
      render(<SidebarIes />);
      expect(screen.getByRole('combobox', { name: 'Instituição em foco' })).toBeInTheDocument();
    });
  });

  // ── Caso 14 ────────────────────────────────────────────────────────────
  it('caso 14 — tema/especialidade usam SÓ % de acerto: nunca TRI, ENAMED ou proficiência (§4.1)', () => {
    expect(nivelDesempenho(29.9)).toBe('critico');
    expect(nivelDesempenho(30)).toBe('mediano');
    expect(nivelDesempenho(79.9)).toBe('mediano');
    expect(nivelDesempenho(80)).toBe('excelente');
    expect(nivelDesempenho(null)).toBeNull();

    vi.mocked(useDiagnosticoTemas).mockReturnValue(
      resultadoOk(TEMAS_CRITICOS) as unknown as ReturnType<typeof useDiagnosticoTemas>,
    );
    render(
      <DrawerTemas
        especialidade={{ id: 'esp-neo', nome: 'Neonatologia', grandeArea: 'Pediatria' }}
        recorte={{ iesId: IES_ID, semestre: '6ano' }}
        onFechar={() => {}}
        onExportarRecorte={() => {}}
      />,
    );
    const painel = screen.getByRole('dialog');
    // Escopo deliberadamente restrito à LISTA de temas (não ao painel
    // inteiro): a SheetDescription do próprio componente diz "nunca usam a
    // escala de proficiência" — um regex ingênuo sobre o painel inteiro
    // acusaria essa frase correta como se fosse a métrica sendo usada.
    const itens = within(painel).getAllByTestId(/^tema-/);
    expect(itens).toHaveLength(TEMAS_CRITICOS.length);
    itens.forEach((item) => {
      expect(item).not.toHaveTextContent(/profici[êe]ncia/i);
      expect(item).not.toHaveTextContent(/enamed/i);
      expect(item).not.toHaveTextContent(/\btri\b/i);
      expect(item.textContent).not.toMatch(/^[1-5]\/5$/);
    });
    expect(within(painel).getByTestId('tema-t1')).toHaveTextContent('22%');
  });

  // ── Caso 15 ────────────────────────────────────────────────────────────
  it('caso 15 — trocar o modo do gráfico protagonista NÃO dispara requisição (§4.8, §8.2)', async () => {
    const user = userEvent.setup();
    render(<VisaoGeralRoute />);
    await screen.findByText('Evolução institucional');
    const chamadasAntes = vi.mocked(useVisaoGeral).mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Por grande área' }));
    expect(await screen.findByText('Evolução por grande área')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Por aluno' }));
    expect(await screen.findByText('Alunos por semestre')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Geral' }));
    expect(await screen.findByText('Evolução institucional')).toBeInTheDocument();

    // Nenhuma das 3 trocas re-chamou o hook de dado da tela.
    expect(vi.mocked(useVisaoGeral).mock.calls.length).toBe(chamadasAntes);
  });

  // ── Caso 16 ────────────────────────────────────────────────────────────
  describe('caso 16 — IES sem gestao.portal_v2 continua nas 5 telas antigas (mecanismo real: PortalV2Gate/LegacyGestorGate)', () => {
    it('feature desligada: LegacyGestorGate deixa passar a tela antiga', () => {
      mockUseEffectiveFeatures.mockReturnValue({ hasFeature: () => false, loading: false });
      rtlRender(
        <MemoryRouter initialEntries={['/gestor/visao-institucional']}>
          <Routes>
            <Route path="/gestor" element={<p>index fallback</p>} />
            <Route
              path="/gestor/visao-institucional"
              element={<LegacyGestorGate><p>tela antiga</p></LegacyGestorGate>}
            />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText('tela antiga')).toBeInTheDocument();
    });

    it('feature ligada: LegacyGestorGate NÃO deixa a tela antiga passar — volta para /gestor', () => {
      mockUseEffectiveFeatures.mockReturnValue({
        hasFeature: (k: string) => k === PORTAL_V2_FEATURE,
        loading: false,
      });
      rtlRender(
        <MemoryRouter initialEntries={['/gestor/visao-institucional']}>
          <Routes>
            <Route path="/gestor" element={<p>index fallback</p>} />
            <Route
              path="/gestor/visao-institucional"
              element={<LegacyGestorGate><p>tela antiga</p></LegacyGestorGate>}
            />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.queryByText('tela antiga')).not.toBeInTheDocument();
      expect(screen.getByText('index fallback')).toBeInTheDocument();
    });

    it('feature desligada: PortalV2Gate NÃO deixa o portal novo passar — volta para /gestor', () => {
      mockUseEffectiveFeatures.mockReturnValue({ hasFeature: () => false, loading: false });
      rtlRender(
        <MemoryRouter initialEntries={['/gestor/visao-geral']}>
          <Routes>
            <Route path="/gestor" element={<p>index fallback</p>} />
            <Route path="/gestor/visao-geral" element={<PortalV2Gate><p>portal novo</p></PortalV2Gate>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.queryByText('portal novo')).not.toBeInTheDocument();
      expect(screen.getByText('index fallback')).toBeInTheDocument();
    });

    it('feature ligada: PortalV2Gate deixa o portal novo passar', () => {
      mockUseEffectiveFeatures.mockReturnValue({
        hasFeature: (k: string) => k === PORTAL_V2_FEATURE,
        loading: false,
      });
      rtlRender(
        <MemoryRouter initialEntries={['/gestor/visao-geral']}>
          <Routes>
            <Route path="/gestor" element={<p>index fallback</p>} />
            <Route path="/gestor/visao-geral" element={<PortalV2Gate><p>portal novo</p></PortalV2Gate>} />
          </Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText('portal novo')).toBeInTheDocument();
    });
  });

  // ── Caso 17 ────────────────────────────────────────────────────────────
  describe('caso 17 — RPC chamada por gestor de outra IES → erro de permissão, sem revelar existência (§7.7)', () => {
    it('bloco em erro mostra mensagem genérica; nem o UUID tentado, nem o nome de outra IES, nem erro de banco aparecem na tela', async () => {
      vi.mocked(useFiltrosGestor).mockReturnValue(filtrosFake({ iesId: IES_FORA_DE_ESCOPO_ID }));
      // Contexto carrega OK e conhece "IES Beta" — prova que, mesmo com essa
      // informação disponível em memória, o bloco em erro não a usa.
      vi.mocked(useGestorContexto).mockReturnValue(
        resultadoOk(CONTEXTO_ADMIN) as unknown as ReturnType<typeof useGestorContexto>,
      );
      vi.mocked(useVisaoGeral).mockReturnValue({
        data: undefined,
        meta: undefined,
        isLoading: false,
        isError: true,
        isPlaceholderData: false,
        isFetching: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useVisaoGeral>);

      render(<VisaoGeralRoute />);

      const rota = await screen.findByTestId('gestor-visao-geral');
      expect(within(rota).getAllByRole('alert').length).toBeGreaterThan(0);

      const html = rota.innerHTML;
      expect(html).not.toContain(IES_FORA_DE_ESCOPO_ID);
      expect(html).not.toContain(IES_BETA_ID);
      expect(html).not.toMatch(/IES Beta/);
      expect(html).not.toMatch(/does not exist|relation ".*"|permission denied|não encontrada/i);
    });

    it('defesa em profundidade: ResultadoGestor só expõe isError booleano; nenhum arquivo do gestor lê .error.message de um hook', () => {
      const QUERIES_TS = resolve(__dirname, '..', 'api', 'queries.ts');
      const srcQueries = readFileSync(QUERIES_TS, 'utf-8');
      const inicio = srcQueries.indexOf('export interface ResultadoGestor');
      expect(inicio, 'ResultadoGestor não encontrado em api/queries.ts — revisar este teste junto da mudança').toBeGreaterThan(-1);
      const fim = srcQueries.indexOf('\n}', inicio);
      const blocoInterface = srcQueries.slice(inicio, fim);
      expect(
        blocoInterface,
        'ResultadoGestor ganhou um campo de erro/mensagem — caso 17 precisa ser revisto',
      ).not.toMatch(/\berror\s*[?:]/);

      const RAIZ = resolve(__dirname, '..');
      function fontes(dir: string, acc: string[] = []) {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, e.name);
          if (e.isDirectory()) {
            if (e.name !== '__tests__') fontes(p, acc);
          } else if (/\.tsx?$/.test(e.name)) {
            acc.push(p);
          }
        }
        return acc;
      }
      const ofensores = fontes(RAIZ)
        .map((p) => ({ p, src: readFileSync(p, 'utf-8') }))
        .filter(({ src }) => /\.error\??\.\s*message\b/.test(src))
        .map(({ p }) => p);
      expect(ofensores, `arquivo(s) leem .error.message de um resultado de hook: ${ofensores.join(', ')}`).toEqual([]);
    });
  });
});
