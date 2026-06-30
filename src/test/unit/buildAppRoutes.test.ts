import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import { getAccessRules } from '@/utils/accessRules';
import { AccessRules, User } from '@/types';

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

/** AccessRules base de aluno (DEFAULT: só simulados liberado). */
const alunoRules: AccessRules = getAccessRules(makeUser([]));

/** Indexa as rotas por path para asserções diretas. */
const byPath = (routes: RouteObject[]) =>
  new Map(routes.map((r) => [r.path, r]));

/** Destino do redirect de uma rota (undefined se a rota renderiza conteúdo). */
const redirectTarget = (route: RouteObject | undefined): string | undefined =>
  (route?.element as ReactElement<{ to?: string }> | undefined)?.props?.to;

const aluno = makeUser([]);

describe('experiences/buildAppRoutes — aluno', () => {
  it('coloca a Home na raiz (/) quando a home está liberada', () => {
    const routes = byPath(buildAppRoutes(aluno, { ...alunoRules, home: true }));
    expect(routes.has('/')).toBe(true);
    // Renderiza conteúdo (Home), não um redirect.
    expect(redirectTarget(routes.get('/'))).toBeUndefined();
  });

  it('redireciona /home para a raiz (/)', () => {
    const routes = byPath(buildAppRoutes(aluno, { ...alunoRules, home: true }));
    expect(redirectTarget(routes.get('/home'))).toBe('/');
  });

  it('quando a home está bloqueada, a raiz redireciona para o entrypoint padrão', () => {
    // home off, simulados on (base) → default é /simulados.
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, home: false, simulados: true }),
    );
    expect(redirectTarget(routes.get('/'))).toBe('/simulados');
  });

  it('tela liberada vira página; tela bloqueada vira redirect', () => {
    const liberado = byPath(
      buildAppRoutes(aluno, { ...alunoRules, simulados: true }),
    );
    expect(redirectTarget(liberado.get('/simulados'))).toBeUndefined();

    const bloqueado = byPath(
      buildAppRoutes(aluno, {
        ...alunoRules,
        home: true,
        simulados: false,
      }),
    );
    // Bloqueado → redireciona para o entrypoint (com home on, é a raiz).
    expect(redirectTarget(bloqueado.get('/simulados'))).toBe('/');
  });

  it('expõe as rotas do caderno de erros quando liberado', () => {
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, errorNotebook: true }),
    );
    expect(redirectTarget(routes.get('/caderno-de-erros'))).toBeUndefined();
    expect(routes.has('/caderno-de-erros/revisao')).toBe(true);
    expect(routes.has('/caderno-de-erros/triagem')).toBe(true);
    expect(routes.has('/caderno-de-erros/reta-final')).toBe(true);
  });

  it('mantém a sub-rota do modo prova', () => {
    const routes = byPath(buildAppRoutes(aluno, alunoRules));
    expect(routes.has('/simulados/:id/prova')).toBe(true);
  });

  it('é pura: mesma entrada → mesmos paths', () => {
    const paths = (rules: AccessRules) =>
      buildAppRoutes(aluno, rules).map((r) => r.path);
    expect(paths(alunoRules)).toEqual(paths(alunoRules));
  });
});

describe('experiences/buildAppRoutes — compartilhadas', () => {
  it('inclui a rota /auth/callback', () => {
    const routes = byPath(buildAppRoutes(aluno, alunoRules));
    expect(routes.has('/auth/callback')).toBe(true);
    expect(redirectTarget(routes.get('/auth/callback'))).toBeUndefined();
  });

  it('/login redireciona para o entrypoint do usuário', () => {
    const routes = byPath(buildAppRoutes(aluno, { ...alunoRules, home: true }));
    // Aluno com home → entrypoint é a raiz.
    expect(redirectTarget(routes.get('/login'))).toBe('/');
  });

  it('sempre termina com o catch-all (*) para NotFound', () => {
    const routes = buildAppRoutes(aluno, alunoRules);
    expect(routes[routes.length - 1].path).toBe('*');
  });

  it('experiência sem módulo próprio ainda retorna compartilhadas + catch-all', () => {
    // Gestão ainda não tem rotas próprias nesta fase (F3).
    const gestor = makeUser(['gestor']);
    const routes = buildAppRoutes(gestor, getAccessRules(gestor));
    expect(routes.map((r) => r.path)).toEqual(['/login', '/auth/callback', '*']);
  });
});

describe('experiences/buildAppRoutes — admin', () => {
  const admin = makeUser(['admin']);
  const adminRules = getAccessRules(admin);

  it('expõe a rota-layout /admin com as seções como filhas', () => {
    const routes = byPath(buildAppRoutes(admin, adminRules));
    const adminRoute = routes.get('/admin');
    expect(adminRoute).toBeDefined();

    const childPaths = (adminRoute?.children ?? []).map((c) =>
      c.index ? 'index' : c.path,
    );
    expect(childPaths).toEqual([
      'index',
      'usuarios',
      'avisos',
      'ies',
      'guia',
      'sanarclass',
      'simulados',
      'feedbacks',
      'analytics',
    ]);
  });

  it('a index de /admin redireciona para /admin/usuarios', () => {
    const routes = byPath(buildAppRoutes(admin, adminRules));
    const indexChild = (routes.get('/admin')?.children ?? []).find(
      (c) => c.index,
    );
    expect(redirectTarget(indexChild)).toBe('/admin/usuarios');
  });

  it('inclui os redirects de compatibilidade das URLs antigas', () => {
    const routes = byPath(buildAppRoutes(admin, adminRules));
    expect(redirectTarget(routes.get('/gestao-usuarios'))).toBe(
      '/admin/usuarios',
    );
    expect(redirectTarget(routes.get('/analytics'))).toBe('/admin/analytics');
  });

  it('mantém o catch-all (*) ao final também para o admin', () => {
    const routes = buildAppRoutes(admin, adminRules);
    expect(routes[routes.length - 1].path).toBe('*');
  });
});
