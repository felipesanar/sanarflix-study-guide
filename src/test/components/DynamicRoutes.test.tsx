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

// PhoneCollectionModal importa o client real do Supabase (para o rpc de
// salvar telefone). Aqui só testamos se o modal abre/fecha — sobrescrevemos
// o mock global de src/test/setup.ts com um stub mínimo, suficiente para o
// módulo ser importado sem instanciar um client de verdade.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
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

describe('DynamicRoutes — gate de coleta de telefone', () => {
  type AuthOverrides = {
    roles?: string[];
    telefone?: string | null;
    /** Simula cache antigo sem a coluna `telefone` — chave ausente, não `undefined` explícito. */
    omitTelefone?: boolean;
    needsPasswordChange?: boolean;
    isImpersonating?: boolean;
  };

  // Monta o retorno de useAuth() com defaults realistas; cada teste só
  // sobrescreve o que interessa para o cenário do gate de telefone.
  const makeAuthReturn = ({
    roles = [],
    telefone = null,
    omitTelefone = false,
    needsPasswordChange = false,
    isImpersonating = false,
  }: AuthOverrides = {}) => {
    const user: Record<string, unknown> = { id: 'u1', roles };
    if (!omitTelefone) {
      user.telefone = telefone;
    }
    return {
      user,
      access: { experiences: ['aluno'], capabilities: [] },
      needsPasswordChange,
      isImpersonating,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccessRules.mockReturnValue({
      accessRules: {},
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('aluno puro (sem roles) com telefone null exibe o modal', () => {
    mockUseAuth.mockReturnValue(makeAuthReturn({ roles: [], telefone: null }));

    renderDynamicRoutes();

    expect(screen.getByText('Atualize seu cadastro')).toBeInTheDocument();
  });

  it('aluno com telefone preenchido não exibe o modal', () => {
    mockUseAuth.mockReturnValue(
      makeAuthReturn({ roles: [], telefone: '11987654321' }),
    );

    renderDynamicRoutes();

    expect(screen.queryByText('Atualize seu cadastro')).not.toBeInTheDocument();
  });

  it('aluno com a chave telefone ausente (cache antigo) não exibe o modal — anti-flash', () => {
    mockUseAuth.mockReturnValue(
      makeAuthReturn({ roles: [], omitTelefone: true }),
    );

    renderDynamicRoutes();

    expect(screen.queryByText('Atualize seu cadastro')).not.toBeInTheDocument();
  });

  it('professor com telefone null exibe o modal', () => {
    mockUseAuth.mockReturnValue(
      makeAuthReturn({ roles: ['professor'], telefone: null }),
    );

    renderDynamicRoutes();

    expect(screen.getByText('Atualize seu cadastro')).toBeInTheDocument();
  });

  it.each([
    ['admin', ['admin']],
    ['gestor', ['gestor']],
    ['atendimento', ['atendimento']],
  ])('staff (%s) com telefone null não exibe o modal', (_label, roles) => {
    mockUseAuth.mockReturnValue(makeAuthReturn({ roles, telefone: null }));

    renderDynamicRoutes();

    expect(screen.queryByText('Atualize seu cadastro')).not.toBeInTheDocument();
  });

  it('professor que também é admin não exibe o modal — staff vence', () => {
    mockUseAuth.mockReturnValue(
      makeAuthReturn({ roles: ['professor', 'admin'], telefone: null }),
    );

    renderDynamicRoutes();

    expect(screen.queryByText('Atualize seu cadastro')).not.toBeInTheDocument();
  });

  it('aluno com telefone null mas needsPasswordChange ativo não exibe o gate de telefone — senha tem prioridade', () => {
    mockUseAuth.mockReturnValue(
      makeAuthReturn({ roles: [], telefone: null, needsPasswordChange: true }),
    );

    renderDynamicRoutes();

    expect(screen.queryByText('Atualize seu cadastro')).not.toBeInTheDocument();
    expect(screen.getByText('Alteração de Senha Obrigatória')).toBeInTheDocument();
  });

  it('aluno com telefone null mas isImpersonating ativo não exibe o modal', () => {
    mockUseAuth.mockReturnValue(
      makeAuthReturn({ roles: [], telefone: null, isImpersonating: true }),
    );

    renderDynamicRoutes();

    expect(screen.queryByText('Atualize seu cadastro')).not.toBeInTheDocument();
  });
});
