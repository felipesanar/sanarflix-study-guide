import { describe, it, expect } from 'vitest';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import type { User, AccessRules } from '@/types';

interface RouteNode {
  path?: string;
  children?: RouteNode[];
}

/** Achata a árvore de rotas em uma lista de caminhos absolutos. */
const paths = (user: User, rules: AccessRules): string[] => {
  const flat: string[] = [];
  const walk = (rs: RouteNode[], prefix = '') =>
    rs.forEach((r) => {
      const p = [prefix, r.path].filter(Boolean).join('/').replace(/\/+/g, '/');
      if (r.path) flat.push(p === '' ? '/' : p);
      if (r.children) walk(r.children, p);
    });
  walk(buildAppRoutes(user, rules) as RouteNode[]);
  return flat;
};

describe('buildAppRoutes — aluno', () => {
  it('aluno com home liberada tem a raiz "/" e redirect /home', () => {
    const out = paths(
      { roles: [] } as unknown as User,
      { home: true, simulados: true } as AccessRules,
    );
    expect(out).toContain('/');
    expect(out).toContain('/home'); // redirect de compat
  });
});

describe('buildAppRoutes — admin', () => {
  it('admin tem todas as abas como rota e redirect de compat', () => {
    const out = paths(
      { roles: ['admin'] } as unknown as User,
      { userManagement: true, analytics: true } as AccessRules,
    );
    [
      '/admin/usuarios',
      '/admin/avisos',
      '/admin/ies',
      '/admin/guia',
      '/admin/sanarclass',
      '/admin/simulados',
      '/admin/feedbacks',
      '/admin/analytics',
    ].forEach((p) => expect(out).toContain(p));
    expect(out).toContain('/gestao-usuarios'); // redirect de compat
  });
});

describe('buildAppRoutes — gestor', () => {
  it('gestor tem módulos como rota e redirects de compat', () => {
    const out = paths(
      { roles: ['gestor'] } as unknown as User,
      { desempenhoInstitucional: true } as AccessRules,
    );
    [
      '/gestor/visao-institucional',
      '/gestor/diagnostico-curricular',
      '/gestor/alunos',
      '/gestor/insights-pedagogicos',
      '/gestor/inteligencia-decisoria',
    ].forEach((p) => expect(out).toContain(p));
    expect(out).toContain('/desempenho-institucional-v2'); // compat
  });
});

describe('buildAppRoutes — atendimento', () => {
  it('atendimento tem /atendimento/usuarios', () => {
    const out = paths(
      { roles: ['atendimento'] } as unknown as User,
      { userManagement: true } as AccessRules,
    );
    expect(out).toContain('/atendimento/usuarios');
  });
});
