import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';

// Router real: o mock global de react-router-dom faria `useLocation` devolver "/" no shell mockado abaixo.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useGestorPortalVersao');
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useAccessRules');

// Os módulos de tela (GestorShell/Inicio/VisaoGeral, GestorLayout/analytics-v2)
// puxam data-fetching real — mockar como componentes triviais para isolar só
// a DECISÃO de roteamento, que é o que este teste cobre.
vi.mock('@/features/gestor/shell/GestorShell', () => ({
  // `Outlet` SÓ nas rotas do Engajamento: é para provar que elas montam dentro do portal novo.
  // Nas demais (ex.: /gestor, que monta o Início com data-fetching real) o mock continua trivial.
  GestorShell: () => {
    const { pathname } = useLocation();
    return (
      <div data-testid="portal-novo">{pathname.startsWith('/gestor/engajamento') ? <Outlet /> : null}</div>
    );
  },
}));
// Telas do Engajamento: só importa DE ONDE elas montam (dentro do portal novo), não o que desenham.
vi.mock('@/features/gestor/routes/engajamento/EngajamentoLayout', () => ({
  default: () => (
    <div data-testid="engajamento-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/features/gestor/routes/engajamento/VisaoGeralEngajamento', () => ({
  default: () => <div data-testid="engajamento-visao-geral" />,
}));
vi.mock('@/features/gestor/routes/engajamento/QuestoesEngajamento', () => ({
  default: () => <div data-testid="engajamento-questoes" />,
}));
vi.mock('@/features/gestor/routes/engajamento/ConteudosEngajamento', () => ({
  default: () => <div data-testid="engajamento-conteudos" />,
}));
vi.mock('@/experiences/gestor/GestorLayout', () => ({
  GestorLayout: () => <div data-testid="console-antigo" />,
}));

function renderGestor(initialPath = '/gestor') {
  const router = createMemoryRouter(gestorV2Routes(), { initialEntries: [initialPath] });
  return render(<RouterProvider router={router} />);
}

describe('gestorV2Routes - decisão console antigo x portal novo', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', roles: ['gestor'] },
      access: { roles: ['gestor'], experiences: ['aluno', 'gestao'], capabilities: [] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAccessRules).mockReturnValue({
      accessRules: { desempenhoInstitucional: true } as ReturnType<typeof useAccessRules>['accessRules'],
    } as ReturnType<typeof useAccessRules>);
  });

  it('monta o portal novo quando get_gestor_portal_versao devolve true', async () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: true, loading: false, error: null });
    renderGestor();
    expect(await screen.findByTestId('portal-novo')).toBeInTheDocument();
  });

  it('monta o console antigo quando get_gestor_portal_versao devolve false', async () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: false, loading: false, error: null });
    renderGestor();
    expect(await screen.findByTestId('console-antigo')).toBeInTheDocument();
  });

  it('não monta nada (tela de espera) enquanto a decisão está carregando', () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: false, loading: true, error: null });
    renderGestor();
    expect(screen.queryByTestId('portal-novo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('console-antigo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gestor-portal-espera')).toBeInTheDocument();
  });

  it('smoke test estrutural: as 5 telas legadas continuam registradas como rotas-filhas de /gestor', () => {
    // Teste estrutural, não de render: renderizar as 5 telas de verdade exigiria
    // mockar toda a cadeia de data-fetching do console antigo (Task 4/5), fora
    // do escopo deste teste de DECISÃO de roteamento. Isso cobre a garantia
    // mínima da spec ("as 5 URLs voltam a montar tela real, não redirect
    // morto") no nível de definição de rota.
    const rotas = gestorV2Routes();
    const portalGestor = rotas.find((r) => r.path === '/gestor');
    const paths = (portalGestor?.children ?? []).map((c) => c.path).filter(Boolean);
    expect(paths).toEqual(
      expect.arrayContaining([
        'visao-institucional',
        'diagnostico-curricular',
        'alunos',
        'insights-pedagogicos',
        'inteligencia-decisoria',
      ]),
    );
  });
});

describe('gestorV2Routes - Engajamento (spec 2026-10-22-engajamento §10.2)', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', roles: ['gestor'] },
      access: { roles: ['gestor'], experiences: ['aluno', 'gestao'], capabilities: [] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAccessRules).mockReturnValue({
      accessRules: { desempenhoInstitucional: true } as ReturnType<typeof useAccessRules>['accessRules'],
    } as ReturnType<typeof useAccessRules>);
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: true, loading: false, error: null });
  });

  it('registra engajamento como rota-filha de /gestor, com índice, questoes e conteudos, ANTES das telas legadas', () => {
    const portal = gestorV2Routes().find((r) => r.path === '/gestor');
    const filhas = portal?.children ?? [];
    const idx = filhas.findIndex((c) => c.path === 'engajamento');
    expect(idx).toBeGreaterThan(-1);

    const engajamento = filhas[idx];
    expect(engajamento.children?.map((c) => (c.index ? 'index' : c.path))).toEqual(['index', 'questoes', 'conteudos']);

    // Nenhuma tela legada usa o caminho "engajamento", e a nova vem antes de todas.
    const idxPrimeiraLegada = filhas.findIndex((c) => c.path === 'visao-institucional');
    expect(idxPrimeiraLegada).toBeGreaterThan(idx);
    expect(filhas.filter((c) => c.path === 'engajamento')).toHaveLength(1);
  });

  it.each([
    ['/gestor/engajamento', 'engajamento-visao-geral'],
    ['/gestor/engajamento/questoes', 'engajamento-questoes'],
    ['/gestor/engajamento/conteudos', 'engajamento-conteudos'],
  ])('%s monta dentro do portal novo, sob o layout do Engajamento', async (url, testId) => {
    renderGestor(url);
    const portal = await screen.findByTestId('portal-novo');
    const layout = await screen.findByTestId('engajamento-layout');
    const tela = await screen.findByTestId(testId);
    expect(portal).toContainElement(layout);
    expect(layout).toContainElement(tela);
    expect(screen.queryByTestId('console-antigo')).not.toBeInTheDocument();
  });

  it('com o console antigo (get_gestor_portal_versao = false), as rotas do Engajamento NÃO montam (PortalV2Gate)', async () => {
    vi.mocked(useGestorPortalVersao).mockReturnValue({ portalNovo: false, loading: false, error: null });
    renderGestor('/gestor/engajamento');
    await screen.findByTestId('console-antigo');
    expect(screen.queryByTestId('portal-novo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('engajamento-layout')).not.toBeInTheDocument();
  });
});
