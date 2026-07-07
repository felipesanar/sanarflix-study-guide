import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import { getAccessRules } from '@/utils/accessRules';
import { deriveAccessFromRoles } from '@/experiences/access';
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
const alunoAccess = deriveAccessFromRoles(aluno.roles);

/** Monta as rotas para um usuário a partir das suas roles (access derivado). */
const routesForRoles = (roles: string[], rulesOverride?: AccessRules) => {
  const user = makeUser(roles);
  const rules = rulesOverride ?? getAccessRules(user);
  const access = deriveAccessFromRoles(roles);
  return byPath(buildAppRoutes(user, rules, access));
};

describe('experiences/buildAppRoutes — aluno', () => {
  it('coloca a Home na raiz (/) quando a home está liberada', () => {
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, home: true }, alunoAccess),
    );
    expect(routes.has('/')).toBe(true);
    // Renderiza conteúdo (Home), não um redirect.
    expect(redirectTarget(routes.get('/'))).toBeUndefined();
  });

  it('redireciona /home para a raiz (/)', () => {
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, home: true }, alunoAccess),
    );
    expect(redirectTarget(routes.get('/home'))).toBe('/');
  });

  it('quando a home está bloqueada, a raiz redireciona para o entrypoint padrão', () => {
    // home off, simulados on (base) → default é /simulados.
    const routes = byPath(
      buildAppRoutes(
        aluno,
        { ...alunoRules, home: false, simulados: true },
        alunoAccess,
      ),
    );
    expect(redirectTarget(routes.get('/'))).toBe('/simulados');
  });

  it('tela liberada vira página; tela bloqueada vira redirect', () => {
    const liberado = byPath(
      buildAppRoutes(aluno, { ...alunoRules, simulados: true }, alunoAccess),
    );
    expect(redirectTarget(liberado.get('/simulados'))).toBeUndefined();

    const bloqueado = byPath(
      buildAppRoutes(
        aluno,
        { ...alunoRules, home: true, simulados: false },
        alunoAccess,
      ),
    );
    // Bloqueado → redireciona para o entrypoint (com home on, é a raiz).
    expect(redirectTarget(bloqueado.get('/simulados'))).toBe('/');
  });

  it('expõe as rotas do caderno de erros quando liberado', () => {
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, errorNotebook: true }, alunoAccess),
    );
    expect(redirectTarget(routes.get('/caderno-de-erros'))).toBeUndefined();
    expect(routes.has('/caderno-de-erros/revisao')).toBe(true);
    expect(routes.has('/caderno-de-erros/triagem')).toBe(true);
    expect(routes.has('/caderno-de-erros/reta-final')).toBe(true);
  });

  it('mantém a sub-rota do modo prova', () => {
    const routes = byPath(buildAppRoutes(aluno, alunoRules, alunoAccess));
    expect(routes.has('/simulados/:id/prova')).toBe(true);
  });

  it('é pura: mesma entrada → mesmos paths', () => {
    const paths = (rules: AccessRules) =>
      buildAppRoutes(aluno, rules, alunoAccess).map((r) => r.path);
    expect(paths(alunoRules)).toEqual(paths(alunoRules));
  });
});

describe('experiences/buildAppRoutes — compartilhadas', () => {
  it('inclui a rota /auth/callback', () => {
    const routes = byPath(buildAppRoutes(aluno, alunoRules, alunoAccess));
    expect(routes.has('/auth/callback')).toBe(true);
    expect(redirectTarget(routes.get('/auth/callback'))).toBeUndefined();
  });

  it('/login redireciona para o entrypoint do usuário', () => {
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, home: true }, alunoAccess),
    );
    // Aluno com home → entrypoint é a raiz.
    expect(redirectTarget(routes.get('/login'))).toBe('/');
  });

  it('sempre termina com o catch-all (*) para NotFound', () => {
    const routes = buildAppRoutes(aluno, alunoRules, alunoAccess);
    expect(routes[routes.length - 1].path).toBe('*');
  });

  it('/home é compartilhada e devolve admin/gestor/CX ao entrypoint da sua experiência (não NotFound)', () => {
    // Regressão: o LoginForm navega TODA experiência para /home no pós-login.
    // Como cada usuário monta só as árvores das suas experiências, /home
    // precisa existir para todos — senão admin/gestor/CX caem no catch-all
    // (NotFound).
    const cases: Array<[string[], string]> = [
      [['admin'], '/admin/usuarios'],
      [['gestor'], '/gestor'],
      [['atendimento'], '/atendimento/usuarios'],
    ];
    for (const [roles, expected] of cases) {
      const routes = routesForRoles(roles);
      expect(routes.has('/home')).toBe(true);
      expect(redirectTarget(routes.get('/home'))).toBe(expected);
    }
  });

  it('/ (raiz) renderiza a Home do aluno para admin/gestor/CX (base compartilhada)', () => {
    // A raiz é a experiência de aluno para TODOS. admin/gestor/CX têm home
    // liberada → '/' renderiza conteúdo (Home), não redireciona.
    const cases: string[][] = [['admin'], ['gestor'], ['atendimento']];
    for (const roles of cases) {
      const routes = routesForRoles(roles);
      expect(routes.has('/')).toBe(true);
      expect(redirectTarget(routes.get('/'))).toBeUndefined();
    }
  });

  it('aluno mantém a Home na raiz (/) — não vira redirect', () => {
    const routes = byPath(
      buildAppRoutes(aluno, { ...alunoRules, home: true }, alunoAccess),
    );
    expect(redirectTarget(routes.get('/'))).toBeUndefined();
  });

  it('privilegiados têm as rotas base de aluno montadas (/simulados, /guia-estudos)', () => {
    const routes = routesForRoles(['admin']);
    expect(routes.has('/simulados')).toBe(true);
    expect(routes.has('/guia-estudos')).toBe(true);
  });

  it('monta as árvores das experiências do usuário (admin também enxerga a Gestão)', () => {
    // Aluno puro: os paths de portal existem, mas como REDIRECT de negação
    // (volta ao entrypoint do usuário), nunca como a rota-layout do portal.
    const rAluno = routesForRoles([]);
    for (const portal of ['/admin', '/gestor', '/atendimento']) {
      // O destino exato depende das AccessRules do fixture; o que importa é
      // ser um redirect (negação) e não a rota-layout do portal.
      expect(redirectTarget(rAluno.get(portal))).toBeDefined();
      expect(rAluno.get(portal)?.children).toBeUndefined();
    }

    // Admin é super usuário: monta o próprio portal E o de Gestão (com filhos),
    // mas o CX vira redirect de negação para o entrypoint dele.
    const rAdmin = routesForRoles(['admin']);
    expect(rAdmin.get('/admin')?.children?.length).toBeGreaterThan(0);
    expect(rAdmin.get('/gestor')?.children?.length).toBeGreaterThan(0);
    expect(redirectTarget(rAdmin.get('/atendimento'))).toBe('/admin/usuarios');
    expect(rAdmin.get('/atendimento')?.children).toBeUndefined();
  });

});

describe('experiences/buildAppRoutes — atendimento (CX)', () => {
  const cxRules = getAccessRules(makeUser(['atendimento']));

  it('expõe a rota-layout /atendimento com as seções Usuários e Feedbacks', () => {
    const routes = routesForRoles(['atendimento'], cxRules);
    const cxRoute = routes.get('/atendimento');
    expect(cxRoute).toBeDefined();

    const childPaths = (cxRoute?.children ?? []).map((c) =>
      c.index ? 'index' : c.path,
    );
    expect(childPaths).toEqual(['index', 'usuarios', 'feedbacks']);
  });

  it('CX não tem analytics liberado no accessRules (fora do escopo v0)', () => {
    expect(cxRules.analytics).toBe(false);
  });

  it('a index de /atendimento redireciona para /atendimento/usuarios', () => {
    const routes = routesForRoles(['atendimento'], cxRules);
    const indexChild = (routes.get('/atendimento')?.children ?? []).find(
      (c) => c.index,
    );
    expect(redirectTarget(indexChild)).toBe('/atendimento/usuarios');
  });

  it('redireciona /gestao-usuarios para /atendimento/usuarios (compat do CX)', () => {
    const routes = routesForRoles(['atendimento'], cxRules);
    expect(redirectTarget(routes.get('/gestao-usuarios'))).toBe(
      '/atendimento/usuarios',
    );
  });
});

describe('experiences/buildAppRoutes — gestão', () => {
  const gestorRules = getAccessRules(makeUser(['gestor']));

  it('expõe a rota-layout /gestor com os 5 módulos como filhas', () => {
    const routes = routesForRoles(['gestor'], gestorRules);
    const gestorRoute = routes.get('/gestor');
    expect(gestorRoute).toBeDefined();

    const childPaths = (gestorRoute?.children ?? []).map((c) =>
      c.index ? 'index' : c.path,
    );
    expect(childPaths).toEqual([
      'index',
      'visao-institucional',
      'diagnostico-curricular',
      'alunos',
      'insights-pedagogicos',
      'inteligencia-decisoria',
    ]);
  });

  it('a index de /gestor redireciona para /gestor/visao-institucional', () => {
    const routes = routesForRoles(['gestor'], gestorRules);
    const indexChild = (routes.get('/gestor')?.children ?? []).find((c) => c.index);
    expect(redirectTarget(indexChild)).toBe('/gestor/visao-institucional');
  });

  it('inclui os redirects de compatibilidade do Desempenho Institucional', () => {
    const routes = routesForRoles(['gestor'], gestorRules);
    expect(redirectTarget(routes.get('/desempenho-institucional'))).toBe('/gestor');
    expect(redirectTarget(routes.get('/desempenho-institucional-v2'))).toBe('/gestor');
  });

  it('gestor_grupo cai na mesma experiência de gestão', () => {
    const routes = routesForRoles(['gestor_grupo']);
    expect(routes.get('/gestor')).toBeDefined();
  });
});

describe('experiences/buildAppRoutes — admin', () => {
  const adminRules = getAccessRules(makeUser(['admin']));

  it('expõe a rota-layout /admin com as 11 seções como filhas (index = Command Center)', () => {
    const routes = routesForRoles(['admin'], adminRules);
    const adminRoute = routes.get('/admin');
    expect(adminRoute).toBeDefined();

    const childPaths = (adminRoute?.children ?? []).map((c) =>
      c.index ? 'index' : c.path,
    );
    expect(childPaths).toEqual([
      'index',
      'simulados',
      'monitoramento',
      'usuarios',
      'ies',
      'guia',
      'avisos',
      'sanarclass',
      'feedbacks',
      'analytics',
      'auditoria',
    ]);
  });

  it('a index de /admin renderiza o Command Center — NÃO redireciona mais para /admin/usuarios', () => {
    const routes = routesForRoles(['admin'], adminRules);
    const indexChild = (routes.get('/admin')?.children ?? []).find(
      (c) => c.index,
    );
    expect(indexChild).toBeDefined();
    expect(redirectTarget(indexChild)).toBeUndefined();
  });

  it('inclui os redirects de compatibilidade das URLs antigas', () => {
    const routes = routesForRoles(['admin'], adminRules);
    expect(redirectTarget(routes.get('/gestao-usuarios'))).toBe(
      '/admin/usuarios',
    );
    expect(redirectTarget(routes.get('/analytics'))).toBe('/admin/analytics');
  });

  it('mantém o catch-all (*) ao final também para o admin', () => {
    const routes = buildAppRoutes(
      makeUser(['admin']),
      adminRules,
      deriveAccessFromRoles(['admin']),
    );
    expect(routes[routes.length - 1].path).toBe('*');
  });

  it('admin (super usuário) também monta a rota /gestor da experiência de Gestão', () => {
    const routes = routesForRoles(['admin'], adminRules);
    expect(routes.get('/admin')).toBeDefined();
    const gestorRoute = routes.get('/gestor');
    expect(gestorRoute).toBeDefined();
    const indexChild = (gestorRoute?.children ?? []).find((c) => c.index);
    expect(redirectTarget(indexChild)).toBe('/gestor/visao-institucional');
  });
});
