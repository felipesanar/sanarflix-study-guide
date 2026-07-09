import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DynamicRoutes } from '@/components/DynamicRoutes';

// useAuth e useAccessRules são mockados — o que importa aqui é o gate de
// erro/loading do próprio DynamicRoutes, não a resolução real das rotas.
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseAccessRules = vi.fn();
vi.mock('@/hooks/useAccessRules', () => ({
  useAccessRules: () => mockUseAccessRules(),
}));

// buildAppRoutes real dependeria de lazy imports de páginas — irrelevante
// para este teste (o estado de erro nem chega a renderizar `element`).
vi.mock('@/experiences/buildAppRoutes', () => ({
  buildAppRoutes: () => [{ path: '*', element: <div>rota</div> }],
}));

const renderDynamicRoutes = () =>
  render(
    <MemoryRouter>
      <DynamicRoutes />
    </MemoryRouter>,
  );

describe('DynamicRoutes — estado de erro no boot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', roles: [] },
      access: { experiences: ['aluno'], capabilities: [] },
      needsPasswordChange: false,
    });
  });

  it('exibe a tela de erro quando useAccessRules retorna error (e não loading)', () => {
    const refetch = vi.fn();
    mockUseAccessRules.mockReturnValue({
      accessRules: {},
      loading: false,
      refetching: false,
      error: 'Erro ao carregar permissões',
      refetch,
    });

    renderDynamicRoutes();

    expect(
      screen.getByText('Não foi possível carregar suas permissões'),
    ).toBeInTheDocument();
    expect(screen.getByText('Erro ao carregar permissões')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' });
    expect(retryButton).not.toBeDisabled();
    fireEvent.click(retryButton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('desabilita o botão e troca o label enquanto o retry está em voo (refetching)', () => {
    const refetch = vi.fn();
    mockUseAccessRules.mockReturnValue({
      accessRules: {},
      loading: false,
      refetching: true,
      error: 'Erro ao carregar permissões',
      refetch,
    });

    renderDynamicRoutes();

    const retryButton = screen.getByRole('button', { name: 'Tentando novamente…' });
    expect(retryButton).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('prioriza o skeleton de loading quando error e loading estão ambos ativos (retry em voo)', () => {
    mockUseAccessRules.mockReturnValue({
      accessRules: {},
      loading: true,
      error: 'Erro ao carregar permissões',
      refetch: vi.fn(),
    });

    renderDynamicRoutes();

    expect(
      screen.queryByText('Não foi possível carregar suas permissões'),
    ).not.toBeInTheDocument();
  });

  it('sem erro e sem loading, renderiza as rotas normalmente', () => {
    mockUseAccessRules.mockReturnValue({
      accessRules: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    renderDynamicRoutes();

    expect(
      screen.queryByText('Não foi possível carregar suas permissões'),
    ).not.toBeInTheDocument();
  });
});
