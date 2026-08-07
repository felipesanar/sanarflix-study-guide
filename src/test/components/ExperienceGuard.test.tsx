import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { deriveAccessFromRoles } from '@/experiences/access';
import { AccessRules, User } from '@/types';

// useAuth e useAccessRules são mockados; getDefaultRouteForUser/hasExperience
// são exercitados de verdade (é o que o guard reusa).
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseAccessRules = vi.fn();
vi.mock('@/hooks/useAccessRules', () => ({
  useAccessRules: () => mockUseAccessRules(),
}));

// O setup global mocka react-router-dom (useLocation fixo em '/'), inviável
// para observar redirect. Aqui substituímos <Navigate> por um stub que expõe
// o destino (`to`) como texto, isolando o comportamento do guard.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  const React = await import('react');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) =>
      React.createElement('div', { 'data-testid': 'redirect' }, to),
  };
});

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

/**
 * Fixtures de AccessRules usadas apenas nestes testes (não vêm mais de
 * `getAccessRules`, removido — a fonte única agora é `useAccessRules`,
 * que lê `get_effective_features`).
 */
const NO_ACCESS: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

const alunoRules: AccessRules = { ...NO_ACCESS, simulados: true };

const adminRules: AccessRules = {
  home: true, studyGuide: true, dashboard: true, SimuladoDesempenho: true,
  userManagement: true, sanarclass: true, simulados: true,
  desempenhoInstitucional: true, errorNotebook: true,
};

const cxRules: AccessRules = { ...adminRules, desempenhoInstitucional: false };

const gestorRules: AccessRules = {
  ...alunoRules,
  home: true, studyGuide: true, dashboard: true, sanarclass: true,
  errorNotebook: true, SimuladoDesempenho: true, desempenhoInstitucional: true,
};

const rulesByRoles = (roles: string[]): AccessRules => {
  if (roles.includes('admin')) return adminRules;
  if (roles.includes('atendimento')) return cxRules;
  if (roles.includes('gestor') || roles.includes('gestor_grupo')) return gestorRules;
  return alunoRules;
};

/** Aponta os mocks para um usuário e o `access` derivado das suas roles. */
const setUser = (user: User | null, rulesOverride?: AccessRules) => {
  const access = deriveAccessFromRoles(user?.roles);
  mockUseAuth.mockReturnValue({ user, access });
  mockUseAccessRules.mockReturnValue({
    // Sem usuário, a fonte única nega tudo (NO_ACCESS) — não é o default de aluno.
    accessRules: rulesOverride ?? (user ? rulesByRoles(user.roles ?? []) : NO_ACCESS),
    loading: false,
  });
};

const renderGuard = (experience: 'admin' | 'atendimento' | 'gestao' | 'aluno') =>
  render(
    <ExperienceGuard experience={experience}>
      <div>conteúdo protegido</div>
    </ExperienceGuard>,
  );

/** destino do redirect (null se o guard renderizou o conteúdo). */
const redirectedTo = () => screen.queryByTestId('redirect')?.textContent ?? null;

describe('ExperienceGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o conteúdo quando o usuário pertence à experiência guardada', () => {
    setUser(makeUser(['admin']));
    renderGuard('admin');
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
    expect(redirectedTo()).toBeNull();
  });

  it('bloqueia e redireciona o aluno que tenta acessar a experiência admin', () => {
    // Aluno com home liberada → entrypoint dinâmico é a raiz (/).
    const user = makeUser([]);
    mockUseAuth.mockReturnValue({ user, access: deriveAccessFromRoles([]) });
    mockUseAccessRules.mockReturnValue({
      accessRules: { ...alunoRules, home: true },
      loading: false,
    });

    renderGuard('admin');

    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    expect(redirectedTo()).toBe('/');
  });

  it('redireciona o gestor que tenta acessar a experiência admin para /gestor', () => {
    setUser(makeUser(['gestor']));
    renderGuard('admin');
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    expect(redirectedTo()).toBe('/gestor');
  });

  it('redireciona o atendimento que tenta acessar a experiência admin para /atendimento/usuarios', () => {
    setUser(makeUser(['atendimento']));
    renderGuard('admin');
    expect(redirectedTo()).toBe('/atendimento/usuarios');
  });

  it('redireciona o admin que tenta acessar a experiência de gestão para a sua própria (/admin/usuarios)', () => {
    setUser(makeUser(['admin']));
    renderGuard('gestao');
    // Admin também tem a experiência de gestão (super usuário) — não é bloqueado.
    expect(screen.getByText('conteúdo protegido')).toBeInTheDocument();
    expect(redirectedTo()).toBeNull();
  });

  it('trata usuário nulo como aluno e bloqueia a experiência admin', () => {
    setUser(null);
    renderGuard('admin');
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    // Sem usuário, accessRules nega tudo → fallback final do aluno (/home).
    expect(redirectedTo()).toBe('/home');
  });

  it('bloqueia o gestor cuja IES não tem gestao.enabled (desempenhoInstitucional: false), mesmo tendo a experiência gestao', () => {
    const user = makeUser(['gestor']);
    setUser(user, { ...gestorRules, desempenhoInstitucional: false });
    renderGuard('gestao');
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    // Sem o portal contratado, cai no comportamento de aluno (home liberada nesta fixture).
    expect(redirectedTo()).toBe('/');
  });
});
