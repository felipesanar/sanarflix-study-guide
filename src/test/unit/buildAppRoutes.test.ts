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
