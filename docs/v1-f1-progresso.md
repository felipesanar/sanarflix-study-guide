# V1 / F1 — Experiências apartadas por rota (relatório de progresso)

> **Branch:** `feat/v1-experiencias-rotas-apartadas` · **Último commit:** `cdc0c76` · **PR:** ainda não aberto (combinado: abrir ao final do F1).
>
> Objetivo da V1: separar as rotas por finalidade (experiências apartadas — aluno+professor, gestão, admin, atendimento), com cada role caindo na sua experiência e bloqueio de acesso cruzado.

---

## ✅ O que foi feito (F1·1 a F1·7)

| Task | Entrega | Commit |
|---|---|---|
| **F1·1** | `EXPERIENCE_ENTRYPOINTS` apontando para rotas aninhadas (admin→`/admin/usuarios`, atendimento→`/atendimento/usuarios`, gestão→`/gestor`) e 1ª preferência do aluno `/home`→`/`. Teste estendido. | `8b8511d` |
| **F1·2** | `src/experiences/types.ts`: `ExperienceId`, `NavItem`, `filterNavByAccess` (filtro de navegação por regras de acesso). TDD (6 casos). | `daff8b8` |
| **F1·3** | `ExperienceGuard` — bloqueio de acesso cruzado: redireciona quem está fora da sua experiência para o próprio entrypoint. TDD (6 casos). | `1713bc1` |
| **F1·4** | `buildAppRoutes` (função pura `(user, accessRules)→RouteObject[]`), `alunoRoutes` (Home em `/`, `/home`→`/`) e `ExperiencePage`. TDD (9 casos). | `ab5ce1c` |
| **F1·5** | `DynamicRoutes` reescrito para `useRoutes(buildAppRoutes(...))`; rotas compartilhadas (`/login`, `/auth/callback`) incorporadas ao builder. | `bec717b` |
| **F1·6** | Bloco não autenticado do `App.tsx`: `/`→login, `/login`→`/`, catch-all→`/`. **Verificado no navegador (deslogado).** | `d1d8199` |
| **F1·7** | `AlunoNav.ts` (navegação canônica do aluno), `isRouteActive` (ativo por prefixo) + teste; URLs novas e detecção de ativo aplicadas em `AppSidebar` e `MobileBottomNav`. | `cdc0c76` |

**Qualidade:** em todas as tasks o `tsc --noEmit` ficou limpo e o **build de produção** passou. Os testes novos somam **25 casos** (todos verdes). A experiência do **aluno** está funcional ponta a ponta (login → Home na raiz → telas controladas por `ies_features`).

### Novos módulos criados (`src/experiences/`)

- `types.ts` — `ExperienceId`, `NavItem`, `filterNavByAccess`.
- `buildAppRoutes.tsx` — montagem data-driven das rotas por experiência.
- `aluno/alunoRoutes.tsx` — rotas da experiência Aluno + Professor.
- `aluno/AlunoNav.ts` — navegação canônica do aluno.
- `shared/ExperiencePage.tsx` — wrapper de página (Suspense + PageWrapper).
- `shared/ExperienceGuard.tsx` — bloqueio de acesso cruzado.
- `shared/navActive.ts` — `isRouteActive` (detecção de ativo por prefixo).

---

## ⚠️ O que NÃO foi feito / precisa de atenção

**1. Admin, Atendimento e Gestão ainda caem em "NotFound" (o ponto mais importante).**
Os entrypoints já apontam para `/admin/usuarios`, `/atendimento/usuarios`, `/gestor`, mas **os módulos de rota dessas experiências ainda não existem** no `buildAppRoutes` (só o aluno foi criado). Hoje, ao logar como admin/CX/gestor, o usuário é redirecionado para uma rota inexistente. → São as **próximas tasks do F1**.

**2. Consequência direta: a branch não pode ir para produção ainda.** Estado intermediário esperado; só fica "shippable" quando os módulos de admin/atendimento/gestão entrarem.

**3. `ExperienceGuard` criado mas ainda não plugado.** Será usado para envolver as rotas das experiências admin/gestão (tasks futuras).

**4. `ALUNO_NAV` ainda não é consumido pelos componentes.** `AppSidebar`/`MobileBottomNav` receberam as URLs corretas, mas mantêm seus próprios arrays. A unificação acontece quando a navegação for apartada por experiência.

**5. Outros arquivos ainda usam URLs antigas** (`useIntelligentPrefetch.ts`, `MeuDiaCard.tsx`, `BulkEmailUpdateTab.tsx`) — fora do escopo do F1·7; provavelmente entram em tasks seguintes.

**6. Verificação visual da navegação pendente.** `AppSidebar`/`MobileBottomNav` só montam logados — validado por build/typecheck/teste do matcher, mas **falta conferência visual** (logado como aluno: "Início" ativo em `/`).

**7. Detalhe menor:** o fallback final de `getDefaultRouteForUser` ainda retorna `/home` no caso extremo de "nenhuma tela liberada" (ex.: usuário nulo). Sem impacto prático para usuários reais (alunos têm simulados na base), mas vale alinhar depois.

---

## Contexto importante para o time

- **46 falhas de teste são pré-existentes** (LoginForm, UserManagement, Announcements, auth-smoke, sidebar) — confirmado que existem na `main` antes destas mudanças; **não foram introduzidas por este trabalho**.
- A lógica de rotas é **testada por unidade** e o roteamento agora é **data-driven** (`RouteObject[]`), o que facilita adicionar as próximas experiências.

---

*Documento gerado durante a execução das tasks F1·1–F1·7. Atualizar conforme novas tasks do F1 forem concluídas.*
