import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';

vi.mock('@/features/gestor/hooks/useGestorPortalVersao');
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useAccessRules');

// Os módulos de tela (GestorShell/Inicio/VisaoGeral, GestorLayout/analytics-v2)
// puxam data-fetching real — mockar como componentes triviais para isolar só
// a DECISÃO de roteamento, que é o que este teste cobre.
vi.mock('@/features/gestor/shell/GestorShell', () => ({
  GestorShell: () => <div data-testid="portal-novo" />,
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
