# Experiência de aluno como base para todos + portais dedicados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as rotas base (`/`, `/simulados`, `/guia-estudos`, ...) servirem a experiência de aluno/professor para TODOS os usuários autenticados, mantendo os portais dedicados (`/admin`, `/gestor`, `/atendimento`) por cima para quem tem a role — eliminando o 404 da raiz para não-alunos.

**Architecture:** Inversão do modelo "1 experiência por usuário" para **acesso híbrido aditivo**. `buildAppRoutes` sempre monta as rotas de aluno (base) e adiciona os portais conforme as roles. Os guards passam de "experiência única" para checagem por role. A navegação volta a mostrar a experiência de aluno para todos, com uma entrada para o portal (aluno→portal) e um botão "Ir para versão aluno" no portal (portal→aluno).

**Tech Stack:** React 18, TypeScript, react-router-dom v6 (`useRoutes`/`RouteObject`), Vitest + jsdom, Tailwind, shadcn/ui, Supabase (sem alterações).

## Global Constraints

- **Sem mudanças de backend/RLS/Supabase.** É mudança de roteamento e navegação no front; a autorização de dados permanece no backend.
- **Landing pós-login preservado:** `getDefaultRouteForUser` continua mandando admin→`/admin/usuarios`, CX→`/atendimento/usuarios`, gestor→`/gestor`; aluno cai na primeira tela liberada. NÃO alterar essa função.
- **Portais montados por role** (não "sempre montados"): `isAdmin ? adminRoutes() : []`, etc. Evita colisão de path (`/gestao-usuarios` existe em admin e CX).
- **Copy em português** (pt-BR), seguindo o tom existente.
- **Comandos de verificação:** `npm run type-check`, `npm run lint`, `npm run test:run`.
- **Testes em** `src/test/unit/`. Alias `@` → `src`. Vitest com `globals: true` (não precisa importar `describe/it/expect`, mas os testes existentes importam — manter o padrão do arquivo que está editando).
- **Branch de trabalho:** `feat/experiencia-aluno-base-para-todos` (já criado). Commits frequentes, um por task.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---------|------------------|------|
| `src/utils/accessRules.ts` | Regras de acesso por role | Gestor ganha experiência de aluno completa |
| `src/utils/experiences.ts` | Resolução de experiência + rota default + **autorização por role** | Adicionar `canAccessExperience` |
| `src/experiences/shared/ExperienceGuard.tsx` | Fronteira de autorização de rota | Usar `canAccessExperience` (role-based) |
| `src/experiences/buildAppRoutes.tsx` | Montagem das rotas do usuário | Aditivo: aluno (base) + portais por role; sem redirect de `/` |
| `src/experiences/shared/globalNav.ts` | Entradas de navegação de portal | `getGlobalNav` → `getPortalEntries` (role-based) |
| `src/experiences/shared/GoToStudentButton.tsx` | Botão portal→aluno | **Criar** |
| `src/components/AppSidebar.tsx` | Sidebar desktop | Nav de aluno p/ todos + entradas de portal |
| `src/components/navigation/MobileBottomNav.tsx` | Nav mobile | Idem |
| `src/experiences/admin/AdminLayout.tsx` | Header do Portal Admin | Botão "Ir para versão aluno" |
| `src/experiences/gestor/GestorLayout.tsx` | Header do Gestor | Botão "Ir para versão aluno" |
| `src/experiences/atendimento/AtendimentoLayout.tsx` | Header do CX | Botão "Ir para versão aluno" |
| `src/test/unit/accessRules.test.ts` | Testes das regras do gestor | **Criar** |
| `src/test/unit/experiences.test.ts` | Testes de experiences utils | Adicionar `canAccessExperience` |
| `src/test/unit/buildAppRoutes.test.ts` | Testes de montagem de rotas | Ajustar `/` + novos casos |
| `src/test/unit/globalNav.test.ts` | Testes de nav de portal | Reescrever p/ `getPortalEntries` |

**Paralelização (para execução com subagentes):** Tasks 1, 2, 4 e 7 são independentes e podem rodar em paralelo. Task 3 depende de 1 (testes do gestor). Tasks 5 e 6 dependem de 1 e 4.

---

## Task 1: Gestor ganha a experiência de aluno completa

**Files:**
- Modify: `src/utils/accessRules.ts:144-151` (bloco `if (isGestor(user))`)
- Test: `src/test/unit/accessRules.test.ts` (criar)

**Interfaces:**
- Consumes: `getAccessRules(user: User | null): AccessRules` (existente)
- Produces: `getAccessRules` de um gestor passa a ter `home/studyGuide/dashboard/sanarclass/errorNotebook/simulados = true`, mantendo `desempenhoInstitucional/SimuladoDesempenho = true` e `userManagement/analytics = false`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/test/unit/accessRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getAccessRules } from '@/utils/accessRules';
import type { User } from '@/types';

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

describe('utils/accessRules — gestor tem a experiência de aluno completa', () => {
  const gestorRules = getAccessRules(makeUser(['gestor']));

  it('libera todas as telas de aluno', () => {
    expect(gestorRules.home).toBe(true);
    expect(gestorRules.studyGuide).toBe(true);
    expect(gestorRules.dashboard).toBe(true);
    expect(gestorRules.sanarclass).toBe(true);
    expect(gestorRules.errorNotebook).toBe(true);
    expect(gestorRules.simulados).toBe(true);
  });

  it('mantém os flags de gestão', () => {
    expect(gestorRules.desempenhoInstitucional).toBe(true);
    expect(gestorRules.SimuladoDesempenho).toBe(true);
  });

  it('não vira admin (userManagement/analytics off)', () => {
    expect(gestorRules.userManagement).toBe(false);
    expect(gestorRules.analytics).toBe(false);
  });

  it('gestor_grupo recebe as mesmas regras', () => {
    const grupo = getAccessRules(makeUser(['gestor_grupo']));
    expect(grupo.home).toBe(true);
    expect(grupo.desempenhoInstitucional).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test:run -- src/test/unit/accessRules.test.ts`
Expected: FAIL — `gestorRules.home` é `false` (regras atuais do gestor não incluem `home`).

- [ ] **Step 3: Implementar a mudança mínima**

Em `src/utils/accessRules.ts`, substituir o bloco do gestor (linhas ~142-151):

```ts
  // Gestor: experiência de aluno completa (para "ver e ter a exp como aluno")
  // + os flags de gestão (desempenho institucional e simulados com visão ampla,
  // incluindo encerrados — controlado por RLS e por includeAll na API).
  if (isGestor(user)) {
    return {
      ...DEFAULT_RULES,
      home: true,
      studyGuide: true,
      dashboard: true,
      sanarclass: true,
      errorNotebook: true,
      simulados: true,
      SimuladoDesempenho: true,
      desempenhoInstitucional: true,
    };
  }
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test:run -- src/test/unit/accessRules.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/utils/accessRules.ts src/test/unit/accessRules.test.ts
git commit -m "feat(access): gestor ganha a experiência de aluno completa"
```

---

## Task 2: Autorização por role (`canAccessExperience`) + guard

**Files:**
- Modify: `src/utils/experiences.ts` (adicionar `canAccessExperience`)
- Modify: `src/experiences/shared/ExperienceGuard.tsx` (usar a nova função)
- Test: `src/test/unit/experiences.test.ts` (adicionar describe)

**Interfaces:**
- Consumes: `isAdmin`, `isAtendimento`, `isGestor` (de `@/utils/accessRules`, já importados em `experiences.ts`); `Experience` type.
- Produces: `canAccessExperience(user: User | null, experience: Experience): boolean` — `true` para `aluno_professor` (base, todos); role-based para `admin`/`gestao`/`atendimento`.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `src/test/unit/experiences.test.ts` (o arquivo já tem `makeUser`):

```ts
import { canAccessExperience } from '@/utils/experiences';

describe('utils/experiences — canAccessExperience (autorização por role)', () => {
  it('a base (aluno_professor) é acessível a todos, inclusive nulo', () => {
    expect(canAccessExperience(null, 'aluno_professor')).toBe(true);
    expect(canAccessExperience(makeUser([]), 'aluno_professor')).toBe(true);
    expect(canAccessExperience(makeUser(['admin']), 'aluno_professor')).toBe(true);
  });

  it('admin só para quem tem a role admin', () => {
    expect(canAccessExperience(makeUser(['admin']), 'admin')).toBe(true);
    expect(canAccessExperience(makeUser(['gestor']), 'admin')).toBe(false);
    expect(canAccessExperience(makeUser([]), 'admin')).toBe(false);
  });

  it('gestao cobre gestor e gestor_grupo', () => {
    expect(canAccessExperience(makeUser(['gestor']), 'gestao')).toBe(true);
    expect(canAccessExperience(makeUser(['gestor_grupo']), 'gestao')).toBe(true);
    expect(canAccessExperience(makeUser(['atendimento']), 'gestao')).toBe(false);
  });

  it('atendimento só para quem tem a role atendimento', () => {
    expect(canAccessExperience(makeUser(['atendimento']), 'atendimento')).toBe(true);
    expect(canAccessExperience(makeUser(['admin']), 'atendimento')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test:run -- src/test/unit/experiences.test.ts`
Expected: FAIL — `canAccessExperience` não existe (import quebra / referência indefinida).

- [ ] **Step 3: Implementar `canAccessExperience`**

Em `src/utils/experiences.ts`, adicionar (após `getExperience`, mantendo os imports de `isAdmin/isAtendimento/isGestor` já presentes no topo):

```ts
/**
 * Autorização de acesso a uma experiência DEDICADA, baseada em role (não na
 * experiência única de maior poder). É a fronteira usada pelo ExperienceGuard:
 * no modelo híbrido, o usuário tem a experiência de aluno na base E, por cima,
 * a(s) experiência(s) dedicada(s) que a(s) sua(s) role(s) concede(m).
 *
 * A base (aluno_professor) é acessível a todo usuário autenticado.
 */
export const canAccessExperience = (
  user: User | null,
  experience: Experience,
): boolean => {
  switch (experience) {
    case 'admin':
      return isAdmin(user);
    case 'atendimento':
      return isAtendimento(user);
    case 'gestao':
      return isGestor(user);
    case 'aluno_professor':
      return true;
  }
};
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test:run -- src/test/unit/experiences.test.ts`
Expected: PASS (inclui os testes antigos de `getExperience`/`getDefaultRouteForUser`, que não mudam).

- [ ] **Step 5: Atualizar o `ExperienceGuard` para role-based**

Substituir todo o conteúdo de `src/experiences/shared/ExperienceGuard.tsx`:

```tsx
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { canAccessExperience, getDefaultRouteForUser } from '@/utils/experiences';
import type { ExperienceId } from '@/experiences/types';

interface ExperienceGuardProps {
  /** Experiência a que esta subárvore de rotas pertence. */
  experience: ExperienceId;
  children: React.ReactNode;
}

/**
 * Fronteira de autorização das experiências dedicadas.
 *
 * Renderiza os filhos apenas quando a role do usuário concede a `experience`
 * guardada ({@link canAccessExperience}). Caso contrário, redireciona para o
 * entrypoint padrão do usuário ({@link getDefaultRouteForUser}) — um aluno cai
 * em `/` (sua base); um gestor tentando `/admin` cai em `/gestor`.
 *
 * Pressupõe que as regras de acesso já estejam carregadas (o gate de loading
 * fica em DynamicRoutes).
 */
export const ExperienceGuard: React.FC<ExperienceGuardProps> = ({
  experience,
  children,
}) => {
  const { user } = useAuth();
  const { accessRules } = useAccessRules();

  if (!canAccessExperience(user, experience)) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />;
  }

  return <>{children}</>;
};
```

- [ ] **Step 6: type-check e commit**

Run: `npm run type-check`
Expected: sem erros.

```bash
git add src/utils/experiences.ts src/experiences/shared/ExperienceGuard.tsx src/test/unit/experiences.test.ts
git commit -m "feat(routing): autorização de experiência por role (canAccessExperience)"
```

---

## Task 3: `buildAppRoutes` aditivo (aluno base + portais por role)

**Files:**
- Modify: `src/experiences/buildAppRoutes.tsx` (reescrever a montagem)
- Test: `src/test/unit/buildAppRoutes.test.ts` (ajustar `/` + adicionar casos)

**Interfaces:**
- Consumes: `alunoRoutes(user, accessRules)`, `adminRoutes()`, `gestorRoutes()`, `atendimentoRoutes()` (existentes); `isAdmin/isGestor/isAtendimento` (de `@/utils/accessRules`); `getDefaultRouteForUser`.
- Produces: `buildAppRoutes(user, accessRules): RouteObject[]` — mesma assinatura. Agora inclui SEMPRE as rotas de aluno; `/` renderiza a Home (não redireciona) para quem tem `home`; portais montados só para a role correspondente.

- [ ] **Step 1: Ajustar/escrever os testes que falham**

Em `src/test/unit/buildAppRoutes.test.ts`:

**(a)** SUBSTITUIR o teste `'/ (raiz autenticada) devolve admin/gestor/CX ao entrypoint (não NotFound)'` (o bloco `it(...)` das linhas ~124-137) por:

```ts
  it('/ (raiz) renderiza a Home do aluno para admin/gestor/CX (base compartilhada)', () => {
    // No modelo híbrido a raiz é a experiência de aluno para TODOS. admin/gestor/CX
    // têm home liberada → '/' renderiza conteúdo (Home), não redireciona.
    const cases: User[] = [
      makeUser(['admin']),
      makeUser(['gestor']),
      makeUser(['atendimento']),
    ];
    for (const user of cases) {
      const routes = byPath(buildAppRoutes(user, getAccessRules(user)));
      expect(routes.has('/')).toBe(true);
      expect(redirectTarget(routes.get('/'))).toBeUndefined();
    }
  });
```

**(b)** ADICIONAR, dentro do describe `'experiences/buildAppRoutes — compartilhadas'`:

```ts
  it('privilegiados têm as rotas base de aluno montadas (/simulados, /guia-estudos)', () => {
    const admin = makeUser(['admin']);
    const routes = byPath(buildAppRoutes(admin, getAccessRules(admin)));
    expect(routes.has('/simulados')).toBe(true);
    expect(routes.has('/guia-estudos')).toBe(true);
  });

  it('monta apenas os portais das roles do usuário', () => {
    const aluno = makeUser([]);
    const rAluno = byPath(buildAppRoutes(aluno, getAccessRules(aluno)));
    expect(rAluno.has('/admin')).toBe(false);
    expect(rAluno.has('/gestor')).toBe(false);
    expect(rAluno.has('/atendimento')).toBe(false);

    const admin = makeUser(['admin']);
    const rAdmin = byPath(buildAppRoutes(admin, getAccessRules(admin)));
    expect(rAdmin.has('/admin')).toBe(true);
    expect(rAdmin.has('/gestor')).toBe(false);
    expect(rAdmin.has('/atendimento')).toBe(false);
  });
```

> Nota: os testes existentes `'/home é compartilhada e devolve ... ao entrypoint'`, `'aluno mantém a Home na raiz'`, e os describes de admin/gestão/CX continuam válidos (o `/home` ainda redireciona via `getDefaultRouteForUser`; os portais das respectivas roles continuam montados). Não removê-los.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts`
Expected: FAIL nos casos novos/ajustados — hoje `/` para admin/gestor/CX é um redirect (não `undefined`), e as rotas base não são montadas para eles.

- [ ] **Step 3: Reescrever `buildAppRoutes.tsx`**

Substituir todo o conteúdo de `src/experiences/buildAppRoutes.tsx`:

```tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getDefaultRouteForUser } from '@/utils/experiences';
import { isAdmin, isGestor, isAtendimento } from '@/utils/accessRules';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { adminRoutes } from '@/experiences/admin/adminRoutes';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import { atendimentoRoutes } from '@/experiences/atendimento/atendimentoRoutes';

const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

/**
 * Monta a lista de rotas (RouteObject[]) do usuário atual — modelo HÍBRIDO.
 *
 * Função pura de `(user, accessRules)`:
 *  - Rotas compartilhadas da área autenticada (`/login`, `/home` → entrypoint do
 *    usuário; `/auth/callback`).
 *  - BASE: a experiência de aluno/professor é montada para TODOS (a Home vive em
 *    `/`; as telas seguem controladas por AccessRules). É isso que dá à camada de
 *    gestão "ver e ter a experiência como aluno" e elimina o 404 da raiz.
 *  - POR CIMA: cada portal dedicado é montado apenas quando a role do usuário o
 *    concede (admin/gestor/atendimento), evitando colisão de paths de compat.
 *  - Catch-all (`*`) com o NotFound.
 *
 * A autorização fina de cada portal fica no ExperienceGuard (por role).
 */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
): RouteObject[] => {
  const defaultRoute = getDefaultRouteForUser(user, accessRules);

  return [
    { path: '/login', element: <Navigate to={defaultRoute} replace /> },
    // Compat: /home é o destino pós-login do LoginForm para TODA role. Devolve
    // cada usuário ao entrypoint da sua experiência (portal p/ privilegiado).
    { path: '/home', element: <Navigate to={defaultRoute} replace /> },
    {
      path: '/auth/callback',
      element: (
        <ExperiencePage waitForData={false}>
          <AuthCallback />
        </ExperiencePage>
      ),
    },

    // BASE: experiência de aluno/professor — para TODOS os usuários.
    ...alunoRoutes(user, accessRules),

    // POR CIMA: portais dedicados, montados conforme as roles do usuário.
    ...(isAdmin(user) ? adminRoutes() : []),
    ...(isGestor(user) ? gestorRoutes() : []),
    ...(isAtendimento(user) ? atendimentoRoutes() : []),

    {
      path: '*',
      element: (
        <ExperiencePage waitForData={false}>
          <NotFound />
        </ExperiencePage>
      ),
    },
  ];
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- src/test/unit/buildAppRoutes.test.ts`
Expected: PASS (todos, incluindo os antigos mantidos).

- [ ] **Step 5: type-check e commit**

Run: `npm run type-check`
Expected: sem erros (`getExperience` deixou de ser usado aqui; confirme que não sobrou import morto — o novo arquivo não o importa).

```bash
git add src/experiences/buildAppRoutes.tsx src/test/unit/buildAppRoutes.test.ts
git commit -m "feat(routing): rotas base de aluno para todos + portais por role"
```

---

## Task 4: `getPortalEntries` (entradas de portal role-based)

**Files:**
- Modify: `src/experiences/shared/globalNav.ts` (substituir `getGlobalNav` por `getPortalEntries`)
- Test: `src/test/unit/globalNav.test.ts` (reescrever)

**Interfaces:**
- Consumes: `isAdmin/isGestor/isAtendimento` (de `@/utils/accessRules`); `NavItem` type.
- Produces: `getPortalEntries(user: User | null): NavItem[]` — links dos portais que a(s) role(s) concede(m), com a URL correta por role (CX aponta para `/atendimento/usuarios`, nunca `/admin`).

- [ ] **Step 1: Reescrever o teste que falha**

Substituir todo o conteúdo de `src/test/unit/globalNav.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getPortalEntries } from '@/experiences/shared/globalNav';
import type { User } from '@/types';

const makeUser = (roles: string[]): User => ({
  id: 'u1',
  email: 'u1@example.com',
  nome: 'Usuário',
  id_ies: 'ies-1',
  ies_nome: 'IES 1',
  roles,
});

const urls = (user: User) => getPortalEntries(user).map((i) => i.url);

describe('experiences/shared/getPortalEntries — links de portal por role', () => {
  it('admin: link para o Portal do Admin', () => {
    expect(urls(makeUser(['admin']))).toEqual(['/admin/usuarios']);
  });

  it('gestor / gestor_grupo: link para o Desempenho Institucional', () => {
    expect(urls(makeUser(['gestor']))).toEqual(['/gestor']);
    expect(urls(makeUser(['gestor_grupo']))).toEqual(['/gestor']);
  });

  it('atendimento (CX): aponta para /atendimento/usuarios (nunca /admin)', () => {
    const out = urls(makeUser(['atendimento']));
    expect(out).toEqual(['/atendimento/usuarios']);
    expect(out.some((u) => u.startsWith('/admin'))).toBe(false);
  });

  it('aluno/professor: nenhuma entrada de portal', () => {
    expect(urls(makeUser([]))).toEqual([]);
    expect(urls(makeUser(['professor']))).toEqual([]);
  });

  it('múltiplas roles: uma entrada por portal, na ordem admin > gestão > CX', () => {
    expect(urls(makeUser(['atendimento', 'admin', 'gestor']))).toEqual([
      '/admin/usuarios',
      '/gestor',
      '/atendimento/usuarios',
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:run -- src/test/unit/globalNav.test.ts`
Expected: FAIL — `getPortalEntries` não existe (ainda é `getGlobalNav`).

- [ ] **Step 3: Reescrever `globalNav.ts`**

Substituir todo o conteúdo de `src/experiences/shared/globalNav.ts`:

```ts
import { UserCog, School, Headset } from 'lucide-react';
import type { User } from '@/types';
import { isAdmin, isGestor, isAtendimento } from '@/utils/accessRules';
import type { NavItem } from '@/experiences/types';

/**
 * Entradas de navegação para os PORTAIS dedicados do usuário.
 *
 * No modelo híbrido, todo usuário tem a experiência de aluno na base; quem tem
 * role privilegiada ganha, por cima, o(s) link(s) para o seu portal dedicado.
 * Cada entrada aponta para o entrypoint CORRETO da role — em especial, o CX vai
 * para `/atendimento/usuarios` (não `/admin/*`, que ele não acessa). Um usuário
 * com múltiplas roles recebe uma entrada por portal, na ordem admin > gestão > CX.
 */
export const getPortalEntries = (user: User | null): NavItem[] => {
  const entries: NavItem[] = [];
  if (isAdmin(user)) {
    entries.push({ title: 'Portal do Admin', url: '/admin/usuarios', icon: UserCog });
  }
  if (isGestor(user)) {
    entries.push({ title: 'Desempenho Institucional', url: '/gestor', icon: School });
  }
  if (isAtendimento(user)) {
    entries.push({ title: 'Atendimento', url: '/atendimento/usuarios', icon: Headset });
  }
  return entries;
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:run -- src/test/unit/globalNav.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

> `type-check` vai acusar `getGlobalNav` faltando em AppSidebar/MobileBottomNav — isso é corrigido nas Tasks 5 e 6. Commit só do que é coeso aqui; rode o type-check global ao final da Task 6.

```bash
git add src/experiences/shared/globalNav.ts src/test/unit/globalNav.test.ts
git commit -m "feat(nav): getPortalEntries — links de portal por role (substitui getGlobalNav)"
```

---

## Task 5: AppSidebar — nav de aluno para todos + entradas de portal

**Files:**
- Modify: `src/components/AppSidebar.tsx`

**Interfaces:**
- Consumes: `getPortalEntries(user)` (Task 4); `useAccessRules()`; regras do gestor (Task 1).
- Produces: sidebar que mostra a navegação de aluno (filtrada por `accessRules`) para TODOS + as entradas de portal do usuário privilegiado.

- [ ] **Step 1: Ajustar imports**

Em `src/components/AppSidebar.tsx`:
- Remover os imports `getExperience` (linha 19) e `getGlobalNav` (linha 20).
- Adicionar: `import { getPortalEntries } from "@/experiences/shared/globalNav";`
- Remover dos imports de `lucide-react` os ícones que deixam de ser usados neste arquivo: `UserCog`, `TrendingUp`, `School`. Manter `BookOpen, BarChart3, ClipboardCheck, Home as HomeIcon, GraduationCap, BookMarked`.

- [ ] **Step 2: Reduzir `menuItems` às telas de aluno**

Substituir o array `menuItems` (linhas ~44-94) por (removidos "Portal do Admin", "Analytics", "Desempenho Institucional" — passam a vir de `getPortalEntries`):

```tsx
// Itens de navegação da experiência de aluno (visíveis para todos, filtrados por accessRules).
const menuItems = [
  {
    title: "Início",
    url: "/",
    icon: HomeIcon,
    accessKey: "home" as const,
    description: "Sua página inicial personalizada",
  },
  {
    title: "SanarClass",
    url: "/sanarclass",
    icon: GraduationCap,
    accessKey: "sanarclass" as const,
    description: "Aulas da sua IES com o SanarFlix Academy",
  },
  {
    title: "Simulados",
    url: "/simulados",
    icon: ClipboardCheck,
    accessKey: "simulados" as const,
    description: "Simulados completos e desempenho",
  },
  {
    title: "Caderno de Erros",
    url: "/caderno-de-erros",
    icon: BookMarked,
    accessKey: "errorNotebook" as const,
    description: "Revise seus gaps e evite repeti-los",
  },
];
```

- [ ] **Step 3: Trocar o cálculo de `visibleMenuItems` e remover `isAluno`**

Substituir o bloco (linhas ~171-184) que define `experience`/`isAluno`/`visibleMenuItems` por:

```tsx
  // Modelo híbrido: a navegação de aluno é mostrada para TODOS (filtrada por
  // accessRules). Usuários privilegiados recebem, ao final, as entradas para o(s)
  // seu(s) portal(is) dedicado(s) — cada uma apontando para o entrypoint da role.
  const studentItems = menuItems.filter(
    (item) => item.accessKey !== "home" && accessRules[item.accessKey],
  );
  const portalEntries = getPortalEntries(user);
  const visibleMenuItems = [...studentItems, ...portalEntries];
```

- [ ] **Step 4: Mostrar Início e Guia de Estudos para todos**

- Trocar `{isAluno && accessRules.home && (` (linha ~237) por `{accessRules.home && (`.
- Trocar `{isAluno && accessRules.studyGuide && hasStudyGuideContent && (` (linha ~251) por `{accessRules.studyGuide && hasStudyGuideContent && (`.

(O `.map` de `visibleMenuItems` nas linhas ~271-278 permanece; entradas de portal não têm `accessKey`, então a lógica de badge `item.accessKey === "errorNotebook"` simplesmente não as afeta.)

- [ ] **Step 5: type-check**

Run: `npm run type-check`
Expected: sem erros neste arquivo (confirmar que não sobrou referência a `getExperience`/`getGlobalNav`/ícones removidos).

- [ ] **Step 6: Verificar no preview (admin e gestor)**

Iniciar o preview e validar via ferramentas (sem pedir ao usuário):
1. `preview_start` (config `dev`); garantir servidor no ar.
2. Logar/impersonar um admin (ou usar sessão existente). Navegar para `/`.
3. `preview_snapshot` — a sidebar deve listar itens de aluno (Início, Simulados, SanarClass, Caderno) **e** "Portal do Admin". O conteúdo deve ser a Home do aluno (não 404).
4. `preview_click` em "Portal do Admin" → URL vira `/admin/usuarios`.
5. `preview_console_logs` (level error) — sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat(nav): AppSidebar mostra a experiência de aluno para todos + link de portal"
```

---

## Task 6: MobileBottomNav — nav de aluno para todos + seção de portal

**Files:**
- Modify: `src/components/navigation/MobileBottomNav.tsx`

**Interfaces:**
- Consumes: `getPortalEntries(user)` (Task 4); `useAccessRules()`.
- Produces: barra/menu mobile com os itens de aluno para todos + uma seção "Gestão" com as entradas de portal do privilegiado.

- [ ] **Step 1: Ajustar imports**

Em `src/components/navigation/MobileBottomNav.tsx`:
- Remover `getExperience` (linha 27) e `getGlobalNav` (linha 28).
- Adicionar `import { getPortalEntries } from "@/experiences/shared/globalNav";`
- Remover dos imports `lucide-react` os que deixam de ser usados: `UserCog`, `TrendingUp`, `School`. (Manter `Home, BookOpen, ClipboardCheck, BarChart3, Menu, X, ChevronRight, GraduationCap, BookMarked, Lock, Sun, Moon, LogOut, User`.)

- [ ] **Step 2: `quickNavItems` sempre com itens de aluno**

Substituir o `useMemo` de `quickNavItems` (linhas ~99-118, incluindo a linha `const isAluno = ...`) por:

```tsx
  // Barra rápida: sempre a navegação de aluno (filtrada por accessRules), para todos.
  const quickNavItems: BottomNavItem[] = useMemo(
    () =>
      [
        { id: "home", title: "Início", url: "/", icon: Home, show: accessRules.home },
        { id: "guide", title: "Guia", url: "/guia-estudos", icon: BookOpen, show: accessRules.studyGuide },
        { id: "progress", title: "Progresso", url: "/dashboard", icon: BarChart3, show: accessRules.dashboard },
        { id: "simulados", title: "Simulados", url: "/simulados", icon: ClipboardCheck, show: accessRules.simulados },
      ].filter((item) => item.show),
    [accessRules],
  );
```

- [ ] **Step 3: `menuSections` com Estudos + Ferramentas para todos + Gestão via portal**

Substituir o `useMemo` de `menuSections` (linhas ~132-174) por:

```tsx
  // Menu completo: seções de aluno para todos + seção de portal para privilegiados.
  const menuSections = useMemo(() => {
    const sections: {
      title: string;
      items: { title: string; url?: string; icon: React.ElementType; action?: () => void; show: boolean; badge?: number }[];
    }[] = [];

    // Estudos
    const estudosItems = [
      { title: "Guia de Estudos", url: "/guia-estudos", icon: BookOpen, show: accessRules.studyGuide },
      { title: "Seu Progresso", url: "/dashboard", icon: BarChart3, show: accessRules.dashboard },
      { title: "SanarClass", url: "/sanarclass", icon: GraduationCap, show: accessRules.sanarclass },
      { title: "Caderno de Erros", url: "/caderno-de-erros", icon: BookMarked, show: accessRules.errorNotebook, badge: notebookDueCount },
    ].filter((item) => item.show);
    if (estudosItems.length > 0) {
      sections.push({ title: "Estudos", items: estudosItems });
    }

    // Ferramentas
    const ferramentasItems = [
      { title: "Simulados", url: "/simulados", icon: ClipboardCheck, show: accessRules.simulados },
    ].filter((item) => item.show);
    if (ferramentasItems.length > 0) {
      sections.push({ title: "Ferramentas", items: ferramentasItems });
    }

    // Gestão: entradas dos portais que a role concede (URLs corretas por role).
    const portalItems = getPortalEntries(user).map((e) => ({
      title: e.title,
      url: e.url,
      icon: e.icon ?? ChevronRight,
      show: true,
    }));
    if (portalItems.length > 0) {
      sections.push({ title: "Gestão", items: portalItems });
    }

    return sections;
  }, [accessRules, user, notebookDueCount]);
```

- [ ] **Step 4: type-check**

Run: `npm run type-check`
Expected: sem erros em todo o projeto (agora AppSidebar e MobileBottomNav não referenciam mais `getGlobalNav`).

- [ ] **Step 5: Verificar no preview (mobile)**

1. `preview_resize` preset `mobile`.
2. Como admin em `/`: `preview_snapshot` — barra inferior com Início/Guia/Progresso/Simulados (conforme liberado). Abrir o menu (botão "Menu") e confirmar a seção "Gestão" com "Portal do Admin".
3. `preview_console_logs` (error) — limpo.

- [ ] **Step 6: Commit**

```bash
git add src/components/navigation/MobileBottomNav.tsx
git commit -m "feat(nav): MobileBottomNav com experiência de aluno para todos + seção de portal"
```

---

## Task 7: Botão "Ir para versão aluno" nos portais

**Files:**
- Create: `src/experiences/shared/GoToStudentButton.tsx`
- Modify: `src/experiences/admin/AdminLayout.tsx`
- Modify: `src/experiences/gestor/GestorLayout.tsx`
- Modify: `src/experiences/atendimento/AtendimentoLayout.tsx`

**Interfaces:**
- Produces: `GoToStudentButton` — botão que navega para `/` (experiência de aluno). Usado nos headers dos 3 portais.

- [ ] **Step 1: Criar o componente**

Criar `src/experiences/shared/GoToStudentButton.tsx`:

```tsx
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Alternância portal → experiência de aluno.
 *
 * Presente no header de cada portal dedicado (Admin/Gestor/CX) para que o
 * usuário privilegiado volte à base (a Home do aluno em `/`). É o par do link
 * de portal exibido na navegação de aluno (aluno → portal).
 */
export const GoToStudentButton: React.FC<{ className?: string }> = ({ className }) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-2 shrink-0', className)}
      onClick={() => navigate('/')}
    >
      <GraduationCap className="h-4 w-4" aria-hidden="true" />
      Ir para versão aluno
    </Button>
  );
};
```

- [ ] **Step 2: AdminLayout — header em flex + botão**

Em `src/experiences/admin/AdminLayout.tsx`:
- Adicionar import: `import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';`
- Substituir o bloco do header (o `<div className="space-y-2">` com h1+p, linhas ~26-34) por:

```tsx
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Shield className="h-10 w-10 text-primary" />
              Portal do Administrador
            </h1>
            <p className="text-muted-foreground">
              Gerencie usuários, configurações e todos os aspectos da plataforma
            </p>
          </div>
          <GoToStudentButton />
        </div>
```

- [ ] **Step 3: AtendimentoLayout — header em flex + botão**

Em `src/experiences/atendimento/AtendimentoLayout.tsx`:
- Adicionar import: `import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';`
- Substituir o bloco do header (o `<div className="space-y-2">` com h1+p, linhas ~23-31) por:

```tsx
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Headset className="h-10 w-10 text-primary" />
            Atendimento
          </h1>
          <p className="text-muted-foreground">
            Gestão de usuários e feedback da plataforma para o time de Atendimento (CX).
          </p>
        </div>
        <GoToStudentButton />
      </div>
```

- [ ] **Step 4: GestorLayout — botão na linha de ações**

Em `src/experiences/gestor/GestorLayout.tsx`:
- Adicionar import: `import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';`
- Na linha de ações (o `<div className="flex items-center gap-1.5 shrink-0">`, linhas ~49-66), adicionar o botão como PRIMEIRO filho, antes do botão "Exportar":

```tsx
          <div className="flex items-center gap-1.5 shrink-0">
            <GoToStudentButton className="h-8" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setExportOpen(true)}
            >
              <FileDown className="h-3.5 w-3.5" /> Exportar
            </Button>
            {/* ...botão IA permanece... */}
```

- [ ] **Step 5: type-check**

Run: `npm run type-check`
Expected: sem erros.

- [ ] **Step 6: Verificar no preview**

1. Como admin, ir para `/admin/usuarios`: `preview_snapshot` deve conter o botão "Ir para versão aluno". `preview_click` nele → URL `/`, Home do aluno.
2. Repetir mentalmente para `/gestor` e `/atendimento/usuarios` (se houver sessão dessas roles; senão validar via `preview_snapshot` a presença do botão).
3. `preview_console_logs` (error) — limpo.

- [ ] **Step 7: Commit**

```bash
git add src/experiences/shared/GoToStudentButton.tsx src/experiences/admin/AdminLayout.tsx src/experiences/gestor/GestorLayout.tsx src/experiences/atendimento/AtendimentoLayout.tsx
git commit -m "feat(nav): botão 'Ir para versão aluno' nos portais Admin/Gestor/CX"
```

---

## Task 8: Verificação completa e cenário do print

**Files:** nenhum (verificação). Fixes contingentes viram novas tasks se necessário.

- [ ] **Step 1: Suíte completa + lint + types**

```bash
npm run test:run
npm run lint
npm run type-check
```
Expected: testes PASS, lint sem erros novos, types OK.

- [ ] **Step 2: Cenário do print (o bug relatado)**

No preview, como **admin**, abrir a raiz `/`:
- `preview_snapshot` — deve renderizar a **Home do aluno** (não "404 / Oops! Page not found").
- `preview_screenshot` — anexar como prova da correção.

- [ ] **Step 3: Fluxos de aceitação (spec §6)**

Validar via preview (snapshot/click), sem pedir ao usuário:
1. Admin logado em `/` → Home do aluno + sidebar com "Portal do Admin". ✅
2. `/admin/usuarios` → botão "Ir para versão aluno" leva a `/`. ✅
3. Aluno (sem role) tentando `/admin` → redireciona para `/` (guard). ✅
4. `/home` → redireciona ao entrypoint (admin→`/admin/usuarios`). ✅

- [ ] **Step 4: Smoke das telas de aluno para gestor/CX (risco do spec §7)**

Se houver sessão de gestor/CX, navegar por `/guia-estudos`, `/dashboard`, `/sanarclass` e checar `preview_console_logs` (error): as telas devem exibir **estado vazio**, não estourar erro por `id_ies` ausente.
- Se alguma tela **quebrar** (erro não tratado por `id_ies` nulo), abrir uma nova task: envolver o fetch/derivação em guarda de estado vazio na respectiva página. NÃO alargar o escopo desta mudança de roteamento além do necessário para não quebrar.

- [ ] **Step 5: Commit final (se houver ajustes de verificação)**

```bash
git add -A
git commit -m "test: verificação do acesso híbrido (aluno base + portais)"
```

---

## Self-Review (preenchido)

**1. Spec coverage:**
- §5.1 montagem aditiva + sem redirect de `/` → Task 3 ✅
- §5.2 guard por role → Task 2 ✅
- §5.3 access rules do gestor → Task 1 ✅
- §5.4 sidebar unificada + botões → Tasks 4, 5, 6, 7 ✅
- §5.5 sem mudança em getDefaultRouteForUser/login/ies_features → respeitado (Global Constraints) ✅
- §6 fluxos de aceitação → Task 8 ✅
- §7 risco de telas sem id_ies → Task 8 Step 4 ✅

**2. Placeholder scan:** sem TBD/TODO; todo código está presente. ✅

**3. Type consistency:** `canAccessExperience(user, experience)` (Task 2) é consumido pelo guard (Task 2); `getPortalEntries(user)` (Task 4) é consumido por AppSidebar (Task 5) e MobileBottomNav (Task 6); `GoToStudentButton` (Task 7) usado nos 3 layouts. `buildAppRoutes` mantém assinatura. ✅

**Refinamento vs spec:** o spec dizia "portais sempre montados; guard autoriza"; o plano monta **por role** (evita colisão de `/gestao-usuarios`) e mantém o guard por role como fronteira. Mesmo comportamento observável para o usuário.
