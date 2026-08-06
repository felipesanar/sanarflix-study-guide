// src/features/gestor/__tests__/portalContainer.test.tsx
//
// Task 65 (decisão do Felipe, 05/08) — Sheet/Dialog/Select do Radix embrulham
// o conteúdo em `<Primitive.Portal>`, que por padrão despacha para
// `document.body`: FORA de qualquer nó com a classe `gestor-portal`, e
// portanto fora do alcance de `gestor-theme.css` (nem os tokens `--gp-*` nem
// `@media (prefers-reduced-motion: reduce)` alcançavam esse conteúdo — ver o
// comentário no topo do bloco de movimento daquele arquivo, ANTES desta task).
//
// A correção: os seis usos do gestor (`DrawerAluno`, `DrawerTemas`, o Sheet
// de cronograma em `Detalhamento.tsx`, `Glossario`, `SidebarIes`,
// `FiltroSemestre`) agora passam `container={useGestorPortalContainer()}` —
// o nó raiz do próprio `GestorShell` — para `SheetContent`/`DialogContent`/
// `SelectContent`.
//
// A prova aqui é de RELAÇÃO DE DOM: `closest('.gestor-portal')` a partir do
// nó do diálogo/sheet/listbox aberto DE VERDADE — nunca a presença da prop
// `container` no componente (isso não prova que o Portal do Radix obedeceu).
//
// Simetricamente, este arquivo também prova o inverso: os MESMOS componentes
// renderizados FORA do `GestorShell` — exatamente como TODO teste unitário
// existente de `DrawerAluno`/`DrawerTemas`/`Glossario`/`FiltroSemestre`/
// `SidebarIes` já faz, de propósito — continuam caindo em `document.body`,
// sem nenhuma mudança de comportamento para aluno/admin.

import * as React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ContextoGestor, ItemCronograma, Meta } from '@/features/gestor/api/types';

// GestorShell precisa do NavLink/useLocation/useSearchParams REAIS (nav
// ativa, Outlet, recorte na URL) — o mock global de src/test/setup.ts (que
// troca useNavigate/useLocation por stubs) é desfeito aqui. Mesmo padrão de
// GestorShell.test.tsx/tema.test.tsx/SidebarIes.test.tsx/FiltroSemestre.test.tsx.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockUseGestorContexto = vi.hoisted(() => vi.fn());
const mockUseAluno = vi.hoisted(() => vi.fn());
const mockUseDiagnosticoTemas = vi.hoisted(() => vi.fn());
const mockUseCronograma = vi.hoisted(() => vi.fn());
const mockUseDetalhamento = vi.hoisted(() => vi.fn());
const mockUseQuestoes = vi.hoisted(() => vi.fn());

vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: () => mockUseGestorContexto(),
  useAluno: (...args: unknown[]) => mockUseAluno(...args),
  // O telefone (05/08) não é assunto deste arquivo, mas o `DrawerAluno` o
  // busca ao abrir — sem este mock a chamada real sobe até o supabase.
  useAlunoContato: () => ({ data: undefined, meta: null, isLoading: false, isError: false, refetch: () => {} }),
  useDiagnosticoTemas: (...args: unknown[]) => mockUseDiagnosticoTemas(...args),
  useCronograma: (...args: unknown[]) => mockUseCronograma(...args),
  useDetalhamento: (...args: unknown[]) => mockUseDetalhamento(...args),
  useQuestoes: (...args: unknown[]) => mockUseQuestoes(...args),
}));

// Import após os vi.mock (hoisted) acima — mesmo padrão de GestorShell.test.tsx/tema.test.tsx.
import { GestorShell } from '@/features/gestor/shell/GestorShell';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { DrawerTemas, type EspecialidadeSelecionada } from '@/features/gestor/components/DrawerTemas';
import type { RecorteDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { Glossario } from '@/features/gestor/components/Glossario';
import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';
import Detalhamento from '@/features/gestor/routes/Detalhamento';

/* ------------------------------------------------------------------------ */
/* Fixtures — mínimas e plausíveis, só para montar a árvore real             */
/* ------------------------------------------------------------------------ */

const CONTEXTO: ContextoGestor = {
  usuario: { id: 'u1', nome: 'Ana Gestora', papel: 'gestor_grupo' },
  iesDisponiveis: [
    { id: 'ies-1', nome: 'IES Alfa' },
    { id: 'ies-2', nome: 'IES Beta' },
  ],
  iesAtual: { id: 'ies-1', nome: 'IES Alfa' },
  contrato: null,
  podeTrocarIes: true,
  podeExportar: true,
};

const ESPECIALIDADE: EspecialidadeSelecionada = { id: 'esp-cardio', nome: 'Cardiologia', grandeArea: 'Clínica Médica' };
const RECORTE_DIAGNOSTICO: RecorteDiagnostico = { iesId: 'ies-1', semestre: '6ano' };

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const resultadoOk = (data: unknown, meta: Meta | undefined = META, over: Record<string, unknown> = {}) => ({
  data,
  meta,
  isLoading: false,
  isError: false,
  isPlaceholderData: false,
  isFetching: false,
  refetch: vi.fn(),
  ...over,
});

beforeAll(() => {
  // Radix Select precisa disso no jsdom — mesmo padrão de
  // SidebarIes.test.tsx/FiltroSemestre.test.tsx.
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', nome: 'Ana Gestora', email: 'ana@ies.edu.br' },
    logout: vi.fn(),
  });
  mockUseGestorContexto.mockReturnValue(resultadoOk(CONTEXTO, undefined));
  mockUseAluno.mockReturnValue(resultadoOk(undefined, undefined, { isLoading: true }));
  mockUseDiagnosticoTemas.mockReturnValue(resultadoOk([]));
  mockUseCronograma.mockReturnValue(resultadoOk([] as ItemCronograma[]));
  mockUseDetalhamento.mockReturnValue(resultadoOk(undefined, undefined));
  mockUseQuestoes.mockReturnValue(resultadoOk(undefined, undefined));
});

/* ------------------------------------------------------------------------ */
/* Helper: monta o GestorShell DE VERDADE, com uma rota de teste no lugar do
   Outlet — é o próprio GestorShell quem fornece o container do Portal via
   useGestorPortalContainer/GestorPortalContainerContext.                    */
/* ------------------------------------------------------------------------ */

function montarShell(conteudoDaRota: React.ReactElement, rota = '/gestor') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/gestor" element={<GestorShell />}>
          <Route index element={conteudoDaRota} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/* ------------------------------------------------------------------------ */
/* Os seis usos — dentro do GestorShell, o container aponta pra .gestor-portal */
/* ------------------------------------------------------------------------ */

describe('container do Portal do Gestor v2 (Task 65) — dentro do GestorShell, o conteúdo aberto está DENTRO de .gestor-portal', () => {
  it('SidebarIes (Select): a listbox de instituição, aberta, está dentro de .gestor-portal', async () => {
    const { container } = montarShell(<div>conteúdo da rota</div>);

    fireEvent.click(screen.getByRole('combobox', { name: /instituição/i }));
    const listbox = await screen.findByRole('listbox');

    expect(listbox.closest('.gestor-portal'), 'listbox do SidebarIes deveria estar dentro de .gestor-portal').not.toBeNull();
    // A mesma subárvore, não qualquer .gestor-portal solto por aí: é o nó que
    // o próprio GestorShell renderiza (único no documento).
    expect(listbox.closest('.gestor-portal')).toBe(container.querySelector('.gestor-portal'));
  });

  it('FiltroSemestre (Select): a listbox do semestre numérico, aberta, está dentro de .gestor-portal', async () => {
    montarShell(<FiltroSemestre />, '/gestor?semestre=1');

    const combo = screen.getByRole('combobox', { name: /semestre específico/i });
    fireEvent.click(combo);
    const listbox = await screen.findByRole('listbox');

    expect(listbox.closest('.gestor-portal'), 'listbox do FiltroSemestre deveria estar dentro de .gestor-portal').not.toBeNull();
  });

  it('Glossario (Dialog): o painel aberto está dentro de .gestor-portal', async () => {
    const user = userEvent.setup();
    const { container } = montarShell(<Glossario />);

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));
    const dialogo = screen.getByRole('dialog');

    expect(dialogo.closest('.gestor-portal'), 'Dialog do Glossario deveria estar dentro de .gestor-portal').not.toBeNull();
    expect(container.contains(dialogo), 'o Dialog deveria estar dentro da árvore renderizada, não solto em document.body').toBe(true);
  });

  it('DrawerAluno (Sheet): o painel aberto está dentro de .gestor-portal', () => {
    const { container } = montarShell(
      <DrawerAluno alunoId="a1" nome="Ana Prado" simulados={['s1']} onFechar={() => {}} />,
    );

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.closest('.gestor-portal'), 'Sheet do DrawerAluno deveria estar dentro de .gestor-portal').not.toBeNull();
    expect(container.contains(dialogo)).toBe(true);
  });

  it('DrawerTemas (Sheet): o painel aberto está dentro de .gestor-portal', () => {
    montarShell(
      <DrawerTemas
        especialidade={ESPECIALIDADE}
        recorte={RECORTE_DIAGNOSTICO}
        onFechar={() => {}}
        onExportarRecorte={() => {}}
      />,
    );

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.closest('.gestor-portal'), 'Sheet do DrawerTemas deveria estar dentro de .gestor-portal').not.toBeNull();
  });

  it('Sheet de cronograma (Detalhamento.tsx): aberto pelo botão "Ver cronograma", está dentro de .gestor-portal', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { container } = montarShell(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <Detalhamento />
        </TooltipProvider>
      </QueryClientProvider>,
      '/gestor?ies=ies-1&semestre=6ano',
    );

    await user.click(screen.getByRole('button', { name: 'Ver cronograma' }));
    const dialogo = await screen.findByRole('dialog');

    expect(
      dialogo.closest('.gestor-portal'),
      'Sheet de cronograma do Detalhamento deveria estar dentro de .gestor-portal',
    ).not.toBeNull();
    expect(container.contains(dialogo)).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* Controle — os MESMOS componentes, fora do GestorShell (como todo teste     */
/* unitário existente já faz), continuam caindo em document.body: o padrão   */
/* de aluno/admin (que nunca tem este Provider na árvore) não muda.          */
/* ------------------------------------------------------------------------ */

describe('controle — sem GestorShell na árvore, o padrão de aluno/admin não muda (document.body)', () => {
  it('Glossario sozinho (sem GestorShell): o Dialog aberto NÃO está dentro de nenhum .gestor-portal', async () => {
    const user = userEvent.setup();
    const { container } = render(<Glossario />);

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));
    const dialogo = screen.getByRole('dialog');

    expect(dialogo.closest('.gestor-portal')).toBeNull();
    // Escapou da árvore renderizada — foi para document.body, o padrão do Radix.
    expect(container.contains(dialogo)).toBe(false);
  });

  it('DrawerAluno sozinho (sem GestorShell): o Sheet aberto NÃO está dentro de nenhum .gestor-portal', () => {
    const { container } = render(
      <DrawerAluno alunoId="a1" nome="Ana Prado" simulados={['s1']} onFechar={() => {}} />,
    );

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.closest('.gestor-portal')).toBeNull();
    expect(container.contains(dialogo)).toBe(false);
  });

  it('DrawerTemas sozinho (sem GestorShell): o Sheet aberto NÃO está dentro de nenhum .gestor-portal', () => {
    // DrawerTemas renderiza AcoesRecorte, que chama useFiltrosGestor()
    // (useSearchParams) — precisa de um Router ao redor, mesmo sem o shell.
    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <DrawerTemas
          especialidade={ESPECIALIDADE}
          recorte={RECORTE_DIAGNOSTICO}
          onFechar={() => {}}
          onExportarRecorte={() => {}}
        />
      </MemoryRouter>,
    );

    const dialogo = screen.getByRole('dialog');
    expect(dialogo.closest('.gestor-portal')).toBeNull();
  });

  it('SidebarIes sozinho (sem GestorShell): a listbox aberta NÃO está dentro de nenhum .gestor-portal', async () => {
    // SidebarIes fora do shell ainda usa o mesmo mock de useGestorContexto
    // (module-level), mas sem o GestorPortalContainerContext.Provider ao
    // redor — useGestorPortalContainer() cai no default (null) do Context.
    const { SidebarIes } = await import('@/features/gestor/shell/SidebarIes');
    const { container } = render(
      <MemoryRouter initialEntries={['/gestor']}>
        <SidebarIes />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /instituição/i }));
    const listbox = await screen.findByRole('listbox');

    expect(listbox.closest('.gestor-portal')).toBeNull();
    expect(container.contains(listbox)).toBe(false);
  });
});
