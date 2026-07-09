import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  GestorFeatureGate,
  GestorIndexRedirect,
} from '@/experiences/gestor/GestorFeatureGate';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import { deriveAccessFromRoles } from '@/experiences/access';
import type { Access } from '@/experiences/access';
import type { AccessRules, User } from '@/types';

const gestorAccess: Access = {
  experiences: ['aluno', 'gestao'],
  capabilities: ['institutional.view', 'alunos.view'],
} as Access;

describe('GestorNav com gates por feature', () => {
  it('todo item de nav declara featureKey gestao.*', () => {
    for (const item of GESTOR_NAV) {
      expect(item.featureKey, `item ${item.url} sem featureKey`).toMatch(/^gestao\./);
    }
  });

  it('filterGestorNav corta itens sem feature ligada', () => {
    const hasFeature = (key: string) => key === 'gestao.alunos';
    const items = filterGestorNav(GESTOR_NAV, gestorAccess, hasFeature);
    expect(items.map((i) => i.url)).toEqual(['/gestor/alunos']);
  });
});

// --- Mocks dos hooks consumidos por GestorFeatureGate/GestorIndexRedirect ---
// Padrão espelhado de src/test/components/ExperienceGuard.test.tsx.

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseAccessRules = vi.fn();
vi.mock('@/hooks/useAccessRules', () => ({
  useAccessRules: () => mockUseAccessRules(),
}));

const mockUseEffectiveFeatures = vi.fn();
vi.mock('@/hooks/useEffectiveFeatures', () => ({
  useEffectiveFeatures: () => mockUseEffectiveFeatures(),
}));

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

const NO_ACCESS: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

/** Aponta os mocks de auth/accessRules/features para o cenário do teste. */
const setup = (opts: {
  user: User | null;
  access: Access;
  accessRules: AccessRules;
  hasFeature?: (key: string) => boolean;
  loading?: boolean;
}) => {
  mockUseAuth.mockReturnValue({ user: opts.user, access: opts.access });
  mockUseAccessRules.mockReturnValue({ accessRules: opts.accessRules, loading: false });
  mockUseEffectiveFeatures.mockReturnValue({
    features: {},
    bypass: false,
    iesId: opts.user?.id_ies ?? null,
    loading: opts.loading ?? false,
    error: null,
    hasFeature: opts.hasFeature ?? (() => false),
  });
};

describe('GestorFeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading: true → não renderiza filhos nem redireciona', () => {
    setup({
      user: makeUser(['gestor']),
      access: gestorAccess,
      accessRules: NO_ACCESS,
      loading: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/gestor/alunos']}>
        <Routes>
          <Route
            path="/gestor/alunos"
            element={
              <GestorFeatureGate featureKey="gestao.alunos">
                <div>conteúdo protegido</div>
              </GestorFeatureGate>
            }
          />
          <Route path="/gestor" element={<div>index gestor</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('index gestor')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it('feature desligada → redireciona para /gestor', () => {
    setup({
      user: makeUser(['gestor']),
      access: gestorAccess,
      accessRules: NO_ACCESS,
      hasFeature: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/gestor/alunos']}>
        <Routes>
          <Route
            path="/gestor/alunos"
            element={
              <GestorFeatureGate featureKey="gestao.alunos">
                <div>conteúdo protegido</div>
              </GestorFeatureGate>
            }
          />
          <Route path="/gestor" element={<div>index gestor</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });

  it('feature ligada → renderiza os filhos', () => {
    setup({
      user: makeUser(['gestor']),
      access: gestorAccess,
      accessRules: NO_ACCESS,
      hasFeature: (key) => key === 'gestao.alunos',
    });

    render(
      <MemoryRouter initialEntries={['/gestor/alunos']}>
        <Routes>
          <Route
            path="/gestor/alunos"
            element={
              <GestorFeatureGate featureKey="gestao.alunos">
                <div>conteúdo protegido</div>
              </GestorFeatureGate>
            }
          />
          <Route path="/gestor" element={<div>index gestor</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
    expect(screen.queryByText('index gestor')).not.toBeInTheDocument();
  });
});

describe('GestorIndexRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nenhuma tela gestor ligada → sai do portal (caminho anti-loop via getDefaultRouteForUser)', () => {
    // Aluno com home ligada e desempenhoInstitucional explicitamente false
    // (como o próprio componente monta accessRules antes de chamar
    // getDefaultRouteForUser) → cai na raiz `/`.
    const user = makeUser([]);
    const access = deriveAccessFromRoles([]);
    setup({
      user,
      access,
      accessRules: { ...NO_ACCESS, home: true },
      hasFeature: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <Routes>
          <Route path="/gestor" element={<GestorIndexRedirect />} />
          <Route path="/" element={<div>raiz do app</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('raiz do app')).toBeInTheDocument();
  });

  it('pelo menos uma tela ligada → redireciona para a primeira tela ligada da nav', () => {
    const user = makeUser(['gestor']);
    setup({
      user,
      access: gestorAccess,
      accessRules: NO_ACCESS,
      hasFeature: (key) => key === 'gestao.alunos',
    });

    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <Routes>
          <Route path="/gestor" element={<GestorIndexRedirect />} />
          <Route path="/gestor/alunos" element={<div>visão de alunos</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('visão de alunos')).toBeInTheDocument();
  });
});
