# Experiências Apartadas por Rota — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar as 4 experiências do Academy (aluno/professor, admin, gestor, atendimento) em árvores de rotas aninhadas e isoladas por guard, com cada página interna (hoje aba por estado) ganhando URL própria, mantendo produção funcional a cada PR.

**Architecture:** Substituímos o monolito `DynamicRoutes` por uma config de rotas em dados (`RouteObject[]`) composta por módulo de experiência e resolvida via `useRoutes`. Uma função pura `buildAppRoutes(user, accessRules)` monta a árvore conforme a experiência, permitindo teste unitário. Um `ExperienceGuard` (layout route) impede acesso cruzado reusando `getExperience`/`getDefaultRouteForUser`. Redirects de compatibilidade preservam URLs antigas.

**Tech Stack:** React 18, React Router DOM v6 (`useRoutes`, `Outlet`, `NavLink`), Vite, TypeScript, Vitest + Testing Library, Radix/shadcn, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-17-experiencias-apartadas-rotas-design.md`

**Regras de trabalho:** branch única `feat/experiencias-apartadas-rotas`; cada task = 1 commit pequeno; PRs validados e mergeados pelo João; `npm run type-check` e `npm run test:run` verdes antes de cada PR; app sempre funcional (rotas antigas convivem via redirect).

---

## Estrutura de arquivos

```
src/
  experiences/
    types.ts                      # ExperienceId, NavItem, util de config
    buildAppRoutes.tsx            # função pura: (user, accessRules) → RouteObject[]
    shared/
      ExperienceGuard.tsx         # layout route: bloqueia acesso cruzado
      ExperiencePage.tsx          # wrapper fino (PageWrapper + ProtectedRoute)
    aluno/    alunoRoutes.tsx  + AlunoNav.ts
    admin/    adminRoutes.tsx  + AdminLayout.tsx + AdminNav.ts
              pages/ (UsuariosPage, AvisosPage, IesPage, GuiaPage,
                      SanarClassPage, SimuladosPage, FeedbacksPage, AnalyticsPage)
    gestor/   gestorRoutes.tsx + GestorLayout.tsx + GestorNav.ts
              pages/ (VisaoInstitucionalPage, DiagnosticoCurricularPage,
                      AlunosPage, InsightsPedagogicosPage, InteligenciaDecisoriaPage)
    atendimento/ atendimentoRoutes.tsx + AtendimentoLayout.tsx
  components/
    DynamicRoutes.tsx             # vira fino: <AppRoutes/> (ou removido)
    AppSidebar.tsx                # passa a consumir nav config por experiência
    navigation/MobileBottomNav.tsx# idem
  utils/experiences.ts            # EXPERIENCE_ENTRYPOINTS atualizado
```

Convenções de nomes (consistência entre tasks):
- `getExperience(user): Experience` — já existe em `utils/experiences.ts`.
- `buildAppRoutes(user: User | null, accessRules: AccessRules): RouteObject[]`
- `ExperienceGuard` — props `{ experience: Experience; children?: ReactNode }`.
- Cada `*Routes` exporta `getAdminRoutes(accessRules): RouteObject[]` etc.

---

## FASE 1 — Fundação

### Task 1: Atualizar entrypoints das experiências

**Files:**
- Modify: `src/utils/experiences.ts:45-52` (EXPERIENCE_ENTRYPOINTS)
- Test: `src/test/unit/experiences.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Adicionar ao `src/test/unit/experiences.test.ts`:
```ts
import { EXPERIENCE_ENTRYPOINTS, getDefaultRouteForUser } from '@/utils/experiences';

describe('EXPERIENCE_ENTRYPOINTS (rotas aninhadas)', () => {
  it('admin entra em /admin/usuarios', () => {
    expect(EXPERIENCE_ENTRYPOINTS.admin).toBe('/admin/usuarios');
  });
  it('atendimento entra em /atendimento/usuarios', () => {
    expect(EXPERIENCE_ENTRYPOINTS.atendimento).toBe('/atendimento/usuarios');
  });
  it('gestao entra em /gestor', () => {
    expect(EXPERIENCE_ENTRYPOINTS.gestao).toBe('/gestor');
  });
  it('aluno com home liberada cai em / (raiz)', () => {
    const rules = { home: true } as any;
    expect(getDefaultRouteForUser({ roles: [] } as any, rules)).toBe('/');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/experiences.test.ts`
Expected: FAIL (valores atuais `/gestao-usuarios`, `/desempenho-institucional-v2`; aluno retorna `/home`).

- [ ] **Step 3: Implementar**

Em `src/utils/experiences.ts`, atualizar:
```ts
export const EXPERIENCE_ENTRYPOINTS: Record<
  Exclude<Experience, 'aluno_professor'>,
  string
> = {
  admin: '/admin/usuarios',
  atendimento: '/atendimento/usuarios',
  gestao: '/gestor',
};
```
E em `getDefaultRouteForUser`, trocar a 1ª preferência do aluno de `/home` para `/`:
```ts
  if (accessRules.home) return '/';
  if (accessRules.simulados) return '/simulados';
  if (accessRules.studyGuide) return '/guia-estudos';
  if (accessRules.dashboard) return '/dashboard';
  if (accessRules.sanarclass) return '/sanarclass';
  return '/';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- src/test/unit/experiences.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/experiences.ts src/test/unit/experiences.test.ts
git commit -m "feat(routing): aponta entrypoints das experiências para rotas aninhadas"
```

---

### Task 2: Tipos e config de navegação por experiência

**Files:**
- Create: `src/experiences/types.ts`
- Test: `src/test/unit/experiences-nav.test.ts`

- [ ] **Step 1: Escrever teste falhando**

`src/test/unit/experiences-nav.test.ts`:
```ts
import { filterNavByAccess, NavItem } from '@/experiences/types';

const items: NavItem[] = [
  { title: 'Usuários', url: '/admin/usuarios', accessKey: 'userManagement' },
  { title: 'Analytics', url: '/admin/analytics', accessKey: 'analytics' },
];

it('mantém apenas itens liberados pelo accessRules', () => {
  const rules = { userManagement: true, analytics: false } as any;
  const result = filterNavByAccess(items, rules);
  expect(result.map(i => i.url)).toEqual(['/admin/usuarios']);
});

it('item sem accessKey é sempre mantido', () => {
  const result = filterNavByAccess([{ title: 'X', url: '/x' }], {} as any);
  expect(result).toHaveLength(1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/experiences-nav.test.ts`
Expected: FAIL ("Cannot find module '@/experiences/types'").

- [ ] **Step 3: Implementar**

`src/experiences/types.ts`:
```ts
import type { LucideIcon } from 'lucide-react';
import type { AccessRules } from '@/types';

export type ExperienceId = 'aluno' | 'admin' | 'gestor' | 'atendimento';

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  accessKey?: keyof AccessRules;
  description?: string;
}

/** Mantém só os itens cujo accessKey está liberado (itens sem accessKey ficam). */
export const filterNavByAccess = (
  items: NavItem[],
  accessRules: AccessRules,
): NavItem[] =>
  items.filter((item) => !item.accessKey || !!accessRules[item.accessKey]);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- src/test/unit/experiences-nav.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/experiences/types.ts src/test/unit/experiences-nav.test.ts
git commit -m "feat(routing): tipos e filtro de navegação por experiência"
```

---

### Task 3: ExperienceGuard (bloqueio de acesso cruzado)

**Files:**
- Create: `src/experiences/shared/ExperienceGuard.tsx`
- Test: `src/test/components/ExperienceGuard.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

`src/test/components/ExperienceGuard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { roles: ['admin'] } }),
}));
vi.mock('@/hooks/useAccessRules', () => ({
  useAccessRules: () => ({ accessRules: { userManagement: true }, loading: false }),
}));

const renderAt = (path: string, experience: any) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gestor" element={<ExperienceGuard experience={experience}><div>GESTOR</div></ExperienceGuard>} />
        <Route path="/admin/usuarios" element={<div>ADMIN ENTRYPOINT</div>} />
      </Routes>
    </MemoryRouter>,
  );

it('admin tentando /gestor é redirecionado ao seu entrypoint', () => {
  renderAt('/gestor', 'gestao');
  expect(screen.getByText('ADMIN ENTRYPOINT')).toBeInTheDocument();
});

it('experiência compatível renderiza o conteúdo', () => {
  renderAt('/gestor', 'admin'); // user é admin → experiência admin combina
  // Aqui o guard recebe experience='admin' e user é admin → libera
  expect(screen.getByText('GESTOR')).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/components/ExperienceGuard.test.tsx`
Expected: FAIL ("Cannot find module ExperienceGuard").

- [ ] **Step 3: Implementar**

`src/experiences/shared/ExperienceGuard.tsx`:
```tsx
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { getExperience, getDefaultRouteForUser, type Experience } from '@/utils/experiences';

interface Props {
  experience: Experience;
  children?: React.ReactNode;
}

/** Garante que o usuário só acesse a árvore de rotas da sua própria experiência. */
export const ExperienceGuard: React.FC<Props> = ({ experience, children }) => {
  const { user } = useAuth();
  const { accessRules } = useAccessRules();

  if (getExperience(user) !== experience) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />;
  }
  return <>{children}</>;
};
```

> Nota: o tipo de `experience` aqui é `Experience` ('aluno_professor' | 'gestao' | 'admin' | 'atendimento'), não `ExperienceId`. Ajustar o teste para usar esses valores ('gestao', 'admin').

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- src/test/components/ExperienceGuard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/experiences/shared/ExperienceGuard.tsx src/test/components/ExperienceGuard.test.tsx
git commit -m "feat(routing): ExperienceGuard bloqueia acesso entre experiências"
```

---

### Task 4: ExperiencePage (wrapper fino) + buildAppRoutes (esqueleto + aluno + redirects)

**Files:**
- Create: `src/experiences/shared/ExperiencePage.tsx`
- Create: `src/experiences/buildAppRoutes.tsx`
- Create: `src/experiences/aluno/alunoRoutes.tsx`
- Test: `src/test/unit/buildAppRoutes.test.ts`

- [ ] **Step 1: Escrever teste falhando**

`src/test/unit/buildAppRoutes.test.ts`:
```ts
import { buildAppRoutes } from '@/experiences/buildAppRoutes';

const paths = (user: any, rules: any) => {
  const flat: string[] = [];
  const walk = (rs: any[], prefix = '') => rs.forEach(r => {
    const p = [prefix, r.path].filter(Boolean).join('/').replace(/\/+/g, '/');
    if (r.path) flat.push(p === '' ? '/' : p);
    if (r.children) walk(r.children, p);
  });
  walk(buildAppRoutes(user, rules));
  return flat;
};

it('aluno com home liberada tem a raiz "/" e redirect /home', () => {
  const out = paths({ roles: [] }, { home: true, simulados: true });
  expect(out).toContain('/');
  expect(out).toContain('/home'); // redirect de compat
});

it('admin tem /admin/usuarios', () => {
  const out = paths({ roles: ['admin'] }, { userManagement: true });
  expect(out).toContain('/admin/usuarios');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

`src/experiences/shared/ExperiencePage.tsx`:
```tsx
import * as React from 'react';
import { PageWrapper } from '@/components/PageWrapper';

interface Props {
  loadingMessage?: string;
  waitForData?: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

/** Casca padrão de uma página roteável dentro de uma experiência. */
export const ExperiencePage: React.FC<Props> = ({ children, ...rest }) => (
  <PageWrapper waitForData {...rest}>{children}</PageWrapper>
);
```

`src/experiences/aluno/alunoRoutes.tsx`:
```tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules } from '@/types';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';

const Home = lazy(() => import('@/pages/Home').then(m => ({ default: m.Home })));
const StudyGuide = lazy(() => import('@/pages/StudyGuide').then(m => ({ default: m.StudyGuide })));
const Simulados = lazy(() => import('@/pages/Simulados'));
const ModoProva = lazy(() => import('@/pages/ModoProva'));
const SimuladoDesempenho = lazy(() => import('@/pages/SimuladoDesempenho').then(m => ({ default: m.SimuladoDesempenho })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const CadernoErros = lazy(() => import('@/pages/CadernoErros'));
const SanarClass = lazy(() => import('@/pages/SanarClass'));
const MeusFeedbacks = lazy(() => import('@/pages/MeusFeedbacks'));

/** Rotas da experiência Aluno + Professor (raiz, sem prefixo). */
export const getAlunoRoutes = (accessRules: AccessRules): RouteObject[] => {
  const r: RouteObject[] = [];
  if (accessRules.home) r.push({ path: '/', element: <ExperiencePage loadingMessage="Carregando início..."><Home /></ExperiencePage> });
  r.push({ path: '/home', element: <Navigate to="/" replace /> });
  if (accessRules.studyGuide) r.push({ path: '/guia-estudos', element: <ExperiencePage><StudyGuide /></ExperiencePage> });
  if (accessRules.simulados) r.push({ path: '/simulados', element: <ExperiencePage><Simulados /></ExperiencePage> });
  r.push({ path: '/simulados/:id/prova', element: <ModoProva /> });
  if (accessRules.SimuladoDesempenho) r.push({ path: '/desempenho-simulado', element: <ExperiencePage><SimuladoDesempenho /></ExperiencePage> });
  if (accessRules.dashboard) r.push({ path: '/dashboard', element: <ExperiencePage><Dashboard /></ExperiencePage> });
  if (accessRules.errorNotebook) r.push({ path: '/caderno-de-erros', element: <ExperiencePage><CadernoErros /></ExperiencePage> });
  if (accessRules.sanarclass) r.push({ path: '/sanarclass', element: <ExperiencePage><SanarClass /></ExperiencePage> });
  r.push({ path: '/meus-feedbacks', element: <ExperiencePage waitForData={false}><MeusFeedbacks /></ExperiencePage> });
  return r;
};
```

`src/experiences/buildAppRoutes.tsx`:
```tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { User, AccessRules } from '@/types';
import { getDefaultRouteForUser } from '@/utils/experiences';
import { getAlunoRoutes } from '@/experiences/aluno/alunoRoutes';

const AuthCallbackPage = lazy(() => import('@/pages/AuthCallback'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** Monta a árvore completa de rotas autenticadas conforme a experiência do usuário. */
export const buildAppRoutes = (user: User | null, accessRules: AccessRules): RouteObject[] => {
  const fallback = getDefaultRouteForUser(user, accessRules);
  return [
    { path: '/login', element: <Navigate to={fallback} replace /> },
    { path: '/auth/callback', element: <AuthCallbackPage /> },
    ...getAlunoRoutes(accessRules),
    // Fases seguintes inserem aqui: admin, gestor, atendimento + redirects de compat.
    { path: '*', element: <NotFound /> },
  ];
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/experiences/ src/test/unit/buildAppRoutes.test.ts
git commit -m "feat(routing): buildAppRoutes + rotas do aluno na raiz"
```

---

### Task 5: Plugar buildAppRoutes via useRoutes (substituir DynamicRoutes)

**Files:**
- Modify: `src/components/DynamicRoutes.tsx` (vira `AppRoutes` fino)
- Modify: `src/App.tsx:18,73` (import e uso)

- [ ] **Step 1: Reescrever DynamicRoutes para usar useRoutes**

Substituir o corpo de `src/components/DynamicRoutes.tsx` por:
```tsx
import * as React from 'react';
import { Suspense } from 'react';
import { useRoutes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import { PasswordChangeModal } from '@/components/PasswordChangeModal';
import { HomePageSkeleton } from '@/components/skeletons';

const RoutesLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

export const DynamicRoutes: React.FC = () => {
  const { user, needsPasswordChange } = useAuth();
  const { accessRules, loading } = useAccessRules();
  const element = useRoutes(buildAppRoutes(user, accessRules));

  if (loading) return <RoutesLoading />;

  return (
    <>
      <PasswordChangeModal isOpen={needsPasswordChange} />
      <Suspense fallback={<HomePageSkeleton />}>{element}</Suspense>
    </>
  );
};
```

> `App.tsx` já importa `DynamicRoutes` — manter o nome do export evita mudar `App.tsx` nesta task. (O `ProtectedRoute` antigo deixa de ser necessário: a autenticação já é garantida em `App.tsx`, que só monta `DynamicRoutes` quando `user` existe.)

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS (sem referências quebradas).

- [ ] **Step 3: Verificação manual**

Run: `npm run dev`
Verificar como **aluno**: `/` abre a Home; `/home` redireciona para `/`; `/simulados`, `/guia-estudos`, `/dashboard`, `/caderno-de-erros` abrem; refresh em cada uma mantém a página; back/forward funciona; rota inexistente → NotFound.

- [ ] **Step 4: Commit**

```bash
git add src/components/DynamicRoutes.tsx
git commit -m "refactor(routing): DynamicRoutes usa useRoutes + buildAppRoutes"
```

---

### Task 6: Raiz "/" = login para não autenticados

**Files:**
- Modify: `src/App.tsx:56-63` (bloco de rotas públicas)

- [ ] **Step 1: Implementar**

No `AppContent` de `src/App.tsx`, no bloco não autenticado, fazer `/` renderizar o login e `/login` redirecionar para `/`:
```tsx
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/auth/resend" element={<ResendWelcome />} />
          <Route path="/cadastro-b2c" element={<SignupB2C />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
```

- [ ] **Step 2: Verificação manual**

Run: `npm run dev` (deslogado)
Verificar: `/` mostra o login; `/login` redireciona para `/`; após login como aluno cai em `/` (Home); rota protegida deslogado → `/`.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routing): raiz / serve login para não autenticados"
```

---

### Task 7: Sidebar e bottom-nav experience-aware

**Files:**
- Create: `src/experiences/aluno/AlunoNav.ts`
- Modify: `src/components/AppSidebar.tsx:41-108` (consumir nav config; URLs novas)
- Modify: `src/components/navigation/MobileBottomNav.tsx` (URLs novas)

- [ ] **Step 1: Criar config de nav do aluno**

`src/experiences/aluno/AlunoNav.ts`:
```ts
import { BookOpen, BarChart3, ClipboardCheck, Home as HomeIcon, GraduationCap, BookMarked } from 'lucide-react';
import type { NavItem } from '@/experiences/types';

export const alunoNav: NavItem[] = [
  { title: 'Início', url: '/', icon: HomeIcon, accessKey: 'home', description: 'Sua página inicial' },
  { title: 'SanarClass', url: '/sanarclass', icon: GraduationCap, accessKey: 'sanarclass' },
  { title: 'Simulados', url: '/simulados', icon: ClipboardCheck, accessKey: 'simulados' },
  { title: 'Caderno de Erros', url: '/caderno-de-erros', icon: BookMarked, accessKey: 'errorNotebook' },
  { title: 'Seu guia', url: '/guia-estudos', icon: BookOpen, accessKey: 'studyGuide' },
  { title: 'Seu progresso', url: '/dashboard', icon: BarChart3, accessKey: 'dashboard' },
];
```

- [ ] **Step 2: Atualizar URLs administrativas/gestor na Sidebar**

Em `src/components/AppSidebar.tsx`, no array `menuItems`, trocar as URLs antigas pelas novas e o item "Início" para `/`:
```ts
  { title: 'Início', url: '/', icon: HomeIcon, accessKey: 'home' as const, description: 'Sua página inicial personalizada' },
  ...
  { title: 'Portal do Admin', url: '/admin/usuarios', icon: UserCog, accessKey: 'userManagement' as const, description: 'Administração da plataforma' },
  { title: 'Analytics', url: '/admin/analytics', icon: TrendingUp, accessKey: 'analytics' as const, description: 'Métricas e insights' },
  { title: 'Desempenho Institucional', url: '/gestor', icon: School, accessKey: 'desempenhoInstitucional' as const, description: 'Visão do desempenho' },
```
A detecção de "ativo" usa `currentPath` (já existe via `useLocation`). Trocar comparações exatas com `/home` por `/` e considerar prefixo para itens com sub-rotas (ex.: `currentPath.startsWith('/admin')`).

- [ ] **Step 3: Atualizar MobileBottomNav**

Em `src/components/navigation/MobileBottomNav.tsx`, trocar `url: '/home'` por `url: '/'` no item Início e as URLs `/gestao-usuarios`→`/admin/usuarios`, `/analytics`→`/admin/analytics`, `/desempenho-institucional-v2`→`/gestor` no menu dropdown.

- [ ] **Step 4: Verificação manual**

Run: `npm run dev`
Verificar (aluno e admin): item ativo destaca corretamente em `/`, sub-rotas destacam o item pai; links levam às URLs novas.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppSidebar.tsx src/components/navigation/MobileBottomNav.tsx src/experiences/aluno/AlunoNav.ts
git commit -m "feat(nav): sidebar e bottom-nav apontam para as rotas novas"
```

---

## FASE 2 — Admin (`/admin/*`)

### Task 8: AdminLayout com sub-navegação por rota

**Files:**
- Create: `src/experiences/admin/AdminNav.ts`
- Create: `src/experiences/admin/AdminLayout.tsx`

- [ ] **Step 1: Config de abas do admin**

`src/experiences/admin/AdminNav.ts`:
```ts
import { Users, Bell, Building2, Upload, FileText, ClipboardList, MessageSquare, TrendingUp } from 'lucide-react';
import type { NavItem } from '@/experiences/types';

export const adminNav: NavItem[] = [
  { title: 'Usuários', url: '/admin/usuarios', icon: Users },
  { title: 'Avisos', url: '/admin/avisos', icon: Bell },
  { title: 'IES', url: '/admin/ies', icon: Building2 },
  { title: 'Guia', url: '/admin/guia', icon: Upload },
  { title: 'SanarClass', url: '/admin/sanarclass', icon: FileText },
  { title: 'Simulados', url: '/admin/simulados', icon: ClipboardList },
  { title: 'Feedbacks', url: '/admin/feedbacks', icon: MessageSquare },
  { title: 'Analytics', url: '/admin/analytics', icon: TrendingUp },
];
```

- [ ] **Step 2: Layout com NavLink + Outlet**

`src/experiences/admin/AdminLayout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { adminNav } from './AdminNav';

/** Casca do Portal do Admin: header + abas-como-rotas (NavLink) + Outlet. */
export default function AdminLayout() {
  const { user } = useAuth();
  // Atendimento (CX) só enxerga Usuários; admin vê tudo.
  const nav = isAdmin(user) ? adminNav : adminNav.filter(i => i.url === '/admin/usuarios');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-10 w-10 text-primary" /> Portal do Administrador
          </h1>
        </header>
        <nav className="flex flex-wrap gap-2 border-b">
          {nav.map(({ title, url, icon: Icon }) => (
            <NavLink key={url} to={url} className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-t-md text-sm ${isActive ? 'bg-card border-b-2 border-primary font-medium' : 'text-muted-foreground'}`}>
              {Icon && <Icon className="h-4 w-4" />}{title}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/experiences/admin/AdminLayout.tsx src/experiences/admin/AdminNav.ts
git commit -m "feat(admin): AdminLayout com sub-nav por rota"
```

---

### Task 9: Páginas finas do admin (extrair as abas)

**Files:**
- Create: `src/experiences/admin/pages/UsuariosPage.tsx`, `AvisosPage.tsx`, `IesPage.tsx`, `GuiaPage.tsx`, `SanarClassPage.tsx`, `SimuladosPage.tsx`, `FeedbacksPage.tsx`, `AnalyticsPage.tsx`

- [ ] **Step 1: Criar uma página por aba reaproveitando os componentes existentes**

Cada página é um wrapper fino que renderiza o componente de aba que já existe em `src/components/admin/`. Exemplos (criar todos os 8):
```tsx
// UsuariosPage.tsx
import { UsersTab } from '@/components/admin/UsersTab';
import { BulkEmailUpdateTab } from '@/components/admin/BulkEmailUpdateTab';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
export default function UsuariosPage() {
  const { user } = useAuth();
  return <div className="space-y-8"><UsersTab />{isAdmin(user) && <BulkEmailUpdateTab />}</div>;
}
```
```tsx
// AvisosPage.tsx
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
export default function AvisosPage() { return <AnnouncementsTab />; }
```
```tsx
// IesPage.tsx
import IesFeaturesTab from '@/components/admin/IesFeaturesTab';
export default function IesPage() { return <IesFeaturesTab />; }
```
```tsx
// GuiaPage.tsx
import { StudyGuideImportTab } from '@/components/admin/StudyGuideImportTab';
export default function GuiaPage() { return <StudyGuideImportTab />; }
```
```tsx
// SanarClassPage.tsx
import SanarClassTab from '@/components/admin/SanarClassTab';
export default function SanarClassPage() { return <SanarClassTab />; }
```
```tsx
// SimuladosPage.tsx  — mantém as sub-abas internas (escopo controlado v0)
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Unlock, Upload } from 'lucide-react';
import SimuladosTab from '@/components/admin/SimuladosTab';
import LiberacoesTab from '@/components/admin/LiberacoesTab';
import SimuladosImportRespostasTab from '@/components/admin/SimuladosImportRespostasTab';
export default function SimuladosPage() {
  return (
    <Tabs defaultValue="simulados" className="w-full">
      <TabsList className="flex gap-2 w-full max-w-3xl">
        <TabsTrigger value="simulados" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Simulados</TabsTrigger>
        <TabsTrigger value="liberacoes" className="flex items-center gap-2"><Unlock className="h-4 w-4" />Liberações</TabsTrigger>
        <TabsTrigger value="importar-respostas" className="flex items-center gap-2"><Upload className="h-4 w-4" />Importar respostas</TabsTrigger>
      </TabsList>
      <TabsContent value="simulados" className="mt-6"><SimuladosTab /></TabsContent>
      <TabsContent value="liberacoes" className="mt-6"><LiberacoesTab /></TabsContent>
      <TabsContent value="importar-respostas" className="mt-6"><SimuladosImportRespostasTab /></TabsContent>
    </Tabs>
  );
}
```
```tsx
// FeedbacksPage.tsx
import FeedbackAdminTab from '@/components/admin/FeedbackAdminTab';
export default function FeedbacksPage() { return <FeedbackAdminTab />; }
```
```tsx
// AnalyticsPage.tsx
import Analytics from '@/pages/Analytics';
export default function AnalyticsPage() { return <Analytics />; }
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/experiences/admin/pages
git commit -m "feat(admin): páginas finas extraídas das abas do portal"
```

---

### Task 10: adminRoutes + plugar no buildAppRoutes (com guard)

**Files:**
- Create: `src/experiences/admin/adminRoutes.tsx`
- Modify: `src/experiences/buildAppRoutes.tsx`
- Modify: `src/test/unit/buildAppRoutes.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Adicionar ao `buildAppRoutes.test.ts`:
```ts
it('admin tem todas as abas como rota e redirect de compat', () => {
  const out = paths({ roles: ['admin'] }, { userManagement: true, analytics: true });
  ['/admin/usuarios','/admin/avisos','/admin/ies','/admin/guia','/admin/sanarclass','/admin/simulados','/admin/feedbacks','/admin/analytics']
    .forEach(p => expect(out).toContain(p));
  expect(out).toContain('/gestao-usuarios'); // redirect de compat
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar adminRoutes**

`src/experiences/admin/adminRoutes.tsx`:
```tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

const AdminLayout = lazy(() => import('@/experiences/admin/AdminLayout'));
const UsuariosPage = lazy(() => import('@/experiences/admin/pages/UsuariosPage'));
const AvisosPage = lazy(() => import('@/experiences/admin/pages/AvisosPage'));
const IesPage = lazy(() => import('@/experiences/admin/pages/IesPage'));
const GuiaPage = lazy(() => import('@/experiences/admin/pages/GuiaPage'));
const SanarClassPage = lazy(() => import('@/experiences/admin/pages/SanarClassPage'));
const SimuladosPage = lazy(() => import('@/experiences/admin/pages/SimuladosPage'));
const FeedbacksPage = lazy(() => import('@/experiences/admin/pages/FeedbacksPage'));
const AnalyticsPage = lazy(() => import('@/experiences/admin/pages/AnalyticsPage'));

/** Rotas da experiência Admin (mesma casca usada por Atendimento, ver atendimentoRoutes). */
export const getAdminRoutes = (): RouteObject[] => [
  {
    path: '/admin',
    element: <ExperienceGuard experience="admin"><AdminLayout /></ExperienceGuard>,
    children: [
      { index: true, element: <Navigate to="/admin/usuarios" replace /> },
      { path: 'usuarios', element: <UsuariosPage /> },
      { path: 'avisos', element: <AvisosPage /> },
      { path: 'ies', element: <IesPage /> },
      { path: 'guia', element: <GuiaPage /> },
      { path: 'sanarclass', element: <SanarClassPage /> },
      { path: 'simulados', element: <SimuladosPage /> },
      { path: 'feedbacks', element: <FeedbacksPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
    ],
  },
  // Compat
  { path: '/gestao-usuarios', element: <Navigate to="/admin/usuarios" replace /> },
  { path: '/analytics', element: <Navigate to="/admin/analytics" replace /> },
];
```

- [ ] **Step 4: Plugar no buildAppRoutes**

Em `src/experiences/buildAppRoutes.tsx`, importar e inserir antes do `*`:
```tsx
import { getAdminRoutes } from '@/experiences/admin/adminRoutes';
// ...
    ...getAlunoRoutes(accessRules),
    ...getAdminRoutes(),
    { path: '*', element: <NotFound /> },
```

- [ ] **Step 5: Rodar testes + verificação manual**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts` → PASS
Run: `npm run dev` (logado como admin): cada aba abre como rota própria; URL muda; deep-link/refresh funciona; `/admin` redireciona p/ `/admin/usuarios`; `/gestao-usuarios` redireciona; aluno tentando `/admin` é devolvido à sua home.

- [ ] **Step 6: Commit**

```bash
git add src/experiences/admin/adminRoutes.tsx src/experiences/buildAppRoutes.tsx src/test/unit/buildAppRoutes.test.ts
git commit -m "feat(admin): rotas aninhadas /admin/* com guard e redirects de compat"
```

---

### Task 11: Aposentar UserManagement por estado

**Files:**
- Modify: `src/test/components/admin/UserManagement.test.tsx` (atualizar/remover se obsoleto)
- Delete (opcional): `src/pages/UserManagement.tsx` se não houver mais referências

- [ ] **Step 1: Conferir referências**

Run: `git grep -n "UserManagement" src`
Se a única referência viva era o lazy em `DynamicRoutes` (já removido) e o teste, prosseguir.

- [ ] **Step 2: Atualizar/remover o teste de UserManagement**

Se `src/test/components/admin/UserManagement.test.tsx` testava as abas por estado, substituí-lo por um teste de `AdminLayout` (renderiza os NavLinks corretos para admin vs atendimento) ou removê-lo se redundante com os testes de rota.

- [ ] **Step 3: Remover a página antiga**

Se sem referências: `git rm src/pages/UserManagement.tsx`.

- [ ] **Step 4: Type-check + testes**

Run: `npm run type-check && npm run test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(admin): remove portal por estado (UserManagement)"
```

---

## FASE 3 — Gestor (`/gestor/*`)

> Pré-requisito: ler `src/pages/DesempenhoInstitucionalV2.tsx`, `src/components/analytics/v2/shell/PerformanceModuleTabs.tsx` e `ModuleContentRenderer.tsx` para extrair as chaves reais de módulo e confirmar os slugs. Ajustar nomes abaixo se divergirem.

### Task 12: GestorLayout + preservação de filtros globais

**Files:**
- Create: `src/experiences/gestor/GestorNav.ts`
- Create: `src/experiences/gestor/GestorLayout.tsx`

- [ ] **Step 1: Nav config do gestor**

`src/experiences/gestor/GestorNav.ts`:
```ts
import { LayoutDashboard, GraduationCap, Users, Lightbulb, Brain } from 'lucide-react';
import type { NavItem } from '@/experiences/types';

export const gestorNav: NavItem[] = [
  { title: 'Visão Institucional', url: '/gestor/visao-institucional', icon: LayoutDashboard },
  { title: 'Diagnóstico Curricular', url: '/gestor/diagnostico-curricular', icon: GraduationCap },
  { title: 'Alunos', url: '/gestor/alunos', icon: Users },
  { title: 'Insights Pedagógicos', url: '/gestor/insights-pedagogicos', icon: Lightbulb },
  { title: 'Inteligência Decisória', url: '/gestor/inteligencia-decisoria', icon: Brain },
];
```

- [ ] **Step 2: Layout com header global + filtros preservados + Outlet**

`src/experiences/gestor/GestorLayout.tsx`: renderiza `InstitutionalHeader`/`GlobalFilterBar` (reaproveitados de `components/analytics/v2/shell`) acima de uma `<nav>` de `NavLink` e `<Outlet/>`. Os filtros globais sobem para um contexto da experiência (ou querystring) para não resetarem ao trocar de rota. Estrutura análoga ao `AdminLayout` (NavLink + Outlet), com o header de filtros antes da nav.

> O estado de filtros hoje vive em `useDesempenhoV2State`/`desempenhoV2Filters`. Mover esse estado para um `GestorFiltersProvider` montado no `GestorLayout`, de modo que as páginas-módulo o consumam sem reinicializar.

- [ ] **Step 3: Type-check + commit**

Run: `npm run type-check`
```bash
git add src/experiences/gestor/GestorLayout.tsx src/experiences/gestor/GestorNav.ts
git commit -m "feat(gestor): GestorLayout com filtros globais preservados entre rotas"
```

---

### Task 13: Páginas-módulo do gestor

**Files:**
- Create: `src/experiences/gestor/pages/VisaoInstitucionalPage.tsx`, `DiagnosticoCurricularPage.tsx`, `AlunosPage.tsx`, `InsightsPedagogicosPage.tsx`, `InteligenciaDecisoriaPage.tsx`

- [ ] **Step 1: Extrair cada módulo do ModuleContentRenderer numa página**

Cada página renderiza o conteúdo do módulo correspondente (hoje selecionado por estado em `ModuleContentRenderer`). Reaproveitar os componentes de cada módulo, passando os filtros via `GestorFiltersProvider`. Uma página por módulo, default export.

> Confirmar os componentes reais de cada módulo no `ModuleContentRenderer` e importá-los diretamente, evitando duplicar lógica.

- [ ] **Step 2: Type-check + commit**

Run: `npm run type-check`
```bash
git add src/experiences/gestor/pages
git commit -m "feat(gestor): páginas-módulo extraídas do desempenho institucional"
```

---

### Task 14: gestorRoutes + plugar no buildAppRoutes

**Files:**
- Create: `src/experiences/gestor/gestorRoutes.tsx`
- Modify: `src/experiences/buildAppRoutes.tsx`
- Modify: `src/test/unit/buildAppRoutes.test.ts`

- [ ] **Step 1: Teste falhando**

```ts
it('gestor tem módulos como rota e redirects de compat', () => {
  const out = paths({ roles: ['gestor'] }, { desempenhoInstitucional: true });
  ['/gestor/visao-institucional','/gestor/diagnostico-curricular','/gestor/alunos','/gestor/insights-pedagogicos','/gestor/inteligencia-decisoria']
    .forEach(p => expect(out).toContain(p));
  expect(out).toContain('/desempenho-institucional-v2'); // compat
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts` → FAIL

- [ ] **Step 3: Implementar gestorRoutes**

`src/experiences/gestor/gestorRoutes.tsx` (espelha o padrão de `adminRoutes`):
```tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

const GestorLayout = lazy(() => import('@/experiences/gestor/GestorLayout'));
const VisaoInstitucionalPage = lazy(() => import('@/experiences/gestor/pages/VisaoInstitucionalPage'));
const DiagnosticoCurricularPage = lazy(() => import('@/experiences/gestor/pages/DiagnosticoCurricularPage'));
const AlunosPage = lazy(() => import('@/experiences/gestor/pages/AlunosPage'));
const InsightsPedagogicosPage = lazy(() => import('@/experiences/gestor/pages/InsightsPedagogicosPage'));
const InteligenciaDecisoriaPage = lazy(() => import('@/experiences/gestor/pages/InteligenciaDecisoriaPage'));

export const getGestorRoutes = (): RouteObject[] => [
  {
    path: '/gestor',
    element: <ExperienceGuard experience="gestao"><GestorLayout /></ExperienceGuard>,
    children: [
      { index: true, element: <Navigate to="/gestor/visao-institucional" replace /> },
      { path: 'visao-institucional', element: <VisaoInstitucionalPage /> },
      { path: 'diagnostico-curricular', element: <DiagnosticoCurricularPage /> },
      { path: 'alunos', element: <AlunosPage /> },
      { path: 'insights-pedagogicos', element: <InsightsPedagogicosPage /> },
      { path: 'inteligencia-decisoria', element: <InteligenciaDecisoriaPage /> },
    ],
  },
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
];
```

- [ ] **Step 4: Plugar no buildAppRoutes**

```tsx
import { getGestorRoutes } from '@/experiences/gestor/gestorRoutes';
// ...
    ...getAdminRoutes(),
    ...getGestorRoutes(),
    { path: '*', element: <NotFound /> },
```

- [ ] **Step 5: Testes + verificação manual**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts` → PASS
Run: `npm run dev` (logado como gestor): módulos abrem como rota; trocar de módulo **não reseta filtros**; deep-link/refresh ok; `/desempenho-institucional-v2` redireciona; aluno/admin tentando `/gestor` são devolvidos.

- [ ] **Step 6: Commit**

```bash
git add src/experiences/gestor/gestorRoutes.tsx src/experiences/buildAppRoutes.tsx src/test/unit/buildAppRoutes.test.ts
git commit -m "feat(gestor): rotas aninhadas /gestor/* com guard e compat"
```

---

## FASE 4 — Atendimento (CX) e fechamento

### Task 15: atendimentoRoutes (`/atendimento/*`)

**Files:**
- Create: `src/experiences/atendimento/AtendimentoLayout.tsx`
- Create: `src/experiences/atendimento/atendimentoRoutes.tsx`
- Modify: `src/experiences/buildAppRoutes.tsx`
- Modify: `src/test/unit/buildAppRoutes.test.ts`

- [ ] **Step 1: Teste falhando**

```ts
it('atendimento tem /atendimento/usuarios', () => {
  const out = paths({ roles: ['atendimento'] }, { userManagement: true });
  expect(out).toContain('/atendimento/usuarios');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts` → FAIL

- [ ] **Step 3: Implementar layout + rotas**

`AtendimentoLayout.tsx`: casca simples (header "Atendimento") com `<Outlet/>`; nav só com Usuários (reusa o padrão dos outros layouts).
`atendimentoRoutes.tsx`:
```tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

const AtendimentoLayout = lazy(() => import('@/experiences/atendimento/AtendimentoLayout'));
const UsuariosPage = lazy(() => import('@/experiences/admin/pages/UsuariosPage'));

export const getAtendimentoRoutes = (): RouteObject[] => [
  {
    path: '/atendimento',
    element: <ExperienceGuard experience="atendimento"><AtendimentoLayout /></ExperienceGuard>,
    children: [
      { index: true, element: <Navigate to="/atendimento/usuarios" replace /> },
      { path: 'usuarios', element: <UsuariosPage /> },
    ],
  },
];
```

- [ ] **Step 4: Plugar no buildAppRoutes**

```tsx
import { getAtendimentoRoutes } from '@/experiences/atendimento/atendimentoRoutes';
// ...
    ...getGestorRoutes(),
    ...getAtendimentoRoutes(),
    { path: '*', element: <NotFound /> },
```

- [ ] **Step 5: Testes + verificação manual**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts` → PASS
Run: `npm run dev` (conta atendimento): `/atendimento/usuarios` abre; `/atendimento` redireciona; atendimento tentando `/admin/avisos` é devolvido ao seu entrypoint.

- [ ] **Step 6: Commit**

```bash
git add src/experiences/atendimento src/experiences/buildAppRoutes.tsx src/test/unit/buildAppRoutes.test.ts
git commit -m "feat(atendimento): experiência CX em /atendimento/*"
```

---

### Task 16: Regressão final + abertura do PR

**Files:** nenhum novo

- [ ] **Step 1: Suíte completa**

Run: `npm run type-check && npm run test:run`
Expected: tudo verde.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 3: Smoke manual por experiência**

Logar (ou simular) uma conta de cada role e percorrer:
- Aluno: `/`, simulados, guia, dashboard, caderno, modo prova.
- Admin: todas as 8 rotas `/admin/*`.
- Gestor: 5 rotas `/gestor/*` com filtros preservados.
- Atendimento: `/atendimento/usuarios`.
- Compat: `/home`, `/gestao-usuarios`, `/analytics`, `/desempenho-institucional-v2` redirecionam.
- Guard: cada role tentando rota de outra experiência é devolvida.

- [ ] **Step 4: Push e PR**

```bash
git push -u origin feat/experiencias-apartadas-rotas
gh pr create --base main --title "feat: experiências apartadas por rota (Academy v0)" --body "Reestruturação de roteamento — ver docs/superpowers/specs/2026-06-17-experiencias-apartadas-rotas-design.md"
```
João valida e faz o merge.

---

## Self-review (cobertura da spec)

- §3 Experiências (4) → Tasks 1, 10, 14, 15. ✔
- §4 Mapa de rotas (aluno/admin/gestor/atendimento + compat) → Tasks 4,7,10,14,15. ✔
- §4 Raiz / = login → Task 6. ✔
- §5.1 Composição por módulo + useRoutes → Tasks 4,5. ✔
- §5.1 ExperienceGuard → Task 3. ✔
- §5.2 Sidebar/nav experience-aware → Task 7. ✔
- §5.3 Abas → páginas (admin/gestor) → Tasks 9,11,13. ✔
- §5.4 RBAC por página / EXPERIENCE_ENTRYPOINTS → Tasks 1,8 (filtro admin vs CX),10. ✔
- §7 Redirects de compat / sem loop / filtros do gestor → Tasks 10,14 / 1 / 12. ✔
- §8 Verificação (type-check, test:run, build, smoke) → Task 16. ✔
