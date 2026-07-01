import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { getAccessRules } from '@/utils/accessRules';
import { User } from '@/types';

// useAuth e useAccessRules são mockados; getExperience/getDefaultRouteForUser
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

/** Aponta os mocks para um usuário e suas regras de acesso reais. */
const setUser = (user: User | null) => {
  mockUseAuth.mockReturnValue({ user });
  mockUseAccessRules.mockReturnValue({
    accessRules: getAccessRules(user),
    loading: false,
  });
};

const renderGuard = (
  experience: 'admin' | 'atendimento' | 'gestao' | 'aluno_professor',
) =>
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
    mockUseAuth.mockReturnValue({ user });
    mockUseAccessRules.mockReturnValue({
      accessRules: { ...getAccessRules(user), home: true },
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
    expect(redirectedTo()).toBe('/admin/usuarios');
  });

  it('trata usuário nulo como aluno+professor e bloqueia a experiência admin', () => {
    setUser(null);
    renderGuard('admin');
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
    // Sem usuário, getAccessRules nega tudo → fallback final do aluno (/home).
    expect(redirectedTo()).toBe('/home');
  });
});
