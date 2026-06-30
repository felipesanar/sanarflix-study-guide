# V1 — Experiências apartadas por rota (relatório de progresso)

> **Branch:** `feat/v1-experiencias-rotas-apartadas` · **PR:** a abrir ao final da F4 (regression-free).
>
> Objetivo da V1: separar as rotas por finalidade (experiências apartadas — aluno+professor, gestão, admin, atendimento), com cada role caindo na sua experiência e bloqueio de acesso cruzado. Roteamento data-driven (`buildAppRoutes` → `useRoutes`).
>
> _(O nome do arquivo mantém "f1" por histórico; o conteúdo cobre F1–F4.)_

---

## ✅ Fases concluídas

### F1 · Fundação (F1·1–F1·7)

| Task | Entrega | Commit |
|---|---|---|
| F1·1 | `EXPERIENCE_ENTRYPOINTS` → rotas aninhadas; aluno `/home`→`/`. | `8b8511d` |
| F1·2 | `experiences/types.ts`: `ExperienceId`, `NavItem`, `filterNavByAccess`. | `daff8b8` |
| F1·3 | `ExperienceGuard` (bloqueio de acesso cruzado). | `1713bc1` |
| F1·4 | `buildAppRoutes` (pura), `alunoRoutes` (Home em `/`), `ExperiencePage`. | `ab5ce1c` |
| F1·5 | `DynamicRoutes` via `useRoutes(buildAppRoutes(...))`; rotas compartilhadas. | `bec717b` |
| F1·6 | Raiz `/` serve login (deslogado); `/login`→`/`. **Verificado no navegador.** | `d1d8199` |
| F1·7 | `AlunoNav.ts`, `isRouteActive` (ativo por prefixo); URLs novas na sidebar/bottom-nav. | `cdc0c76` |

### F2 · Admin (F2·8–F2·11)

| Task | Entrega | Commit |
|---|---|---|
| F2·8 | `admin/AdminNav.ts` + `AdminLayout.tsx` (sub-nav NavLink + Outlet; CX só Usuários). | `234eefc` |
| F2·9 | 8 páginas finas em `admin/pages/` reusando os `*Tab.tsx`. | `8f320bc` |
| F2·10 | `adminRoutes.tsx` (layout + filhas + guard + redirects compat) no `buildAppRoutes`. | `7747c67` |
| F2·11 | Removido `UserManagement.tsx` + teste; sem referências vivas. | `e1169ec` |

### F3 · Gestor (F3·12–F3·14)

| Task | Entrega | Commit |
|---|---|---|
| F3·12 | `GestorNav.ts`, `GestorFiltersProvider` (filtros globais persistem entre módulos), `GestorLayout.tsx`. | `bbb1e7d` |
| F3·13 | 5 páginas-módulo em `gestor/pages/` (extraídas do `ModuleContentRenderer`). | `5ec67df` |
| F3·14 | `gestorRoutes.tsx` (layout + 5 módulos + guard + redirects `/desempenho-institucional(-v2)`). | `08d9fc4` |

### F4 · Atendimento/CX (F4·15) + fechamento

| Task | Entrega | Commit |
|---|---|---|
| F4·15 | `AtendimentoLayout.tsx` + `atendimentoRoutes.tsx` (reusa `UsuariosPage`; guard; compat `/gestao-usuarios`). | `f405ef2` |
| F4·16 | Regressão final + **abertura do PR** (em andamento). | — |

---

## 🗺️ Mapa de rotas final

- **Aluno + Professor** (raiz): `/` (Home) · `/guia-estudos` · `/simulados` · `/simulados/:id/prova` · `/desempenho-simulado` · `/dashboard` · `/caderno-de-erros` (+ sub) · `/sanarclass` · `/meus-feedbacks`
- **Admin** `/admin/*`: `usuarios · avisos · ies · guia · sanarclass · simulados · feedbacks · analytics`
- **Gestão** `/gestor/*`: `visao-institucional · diagnostico-curricular · alunos · insights-pedagogicos · inteligencia-decisoria`
- **Atendimento** `/atendimento/usuarios`
- **Compat:** `/home → /` · `/gestao-usuarios → /admin/usuarios` (ou `/atendimento/usuarios` p/ CX) · `/desempenho-institucional(-v2) → /gestor` · `/analytics → /admin/analytics`

---

## 🔍 Estado / qualidade

- **As 4 experiências têm módulo de rotas próprio** — o NotFound de admin/gestor/CX foi **resolvido**. Cada usuário recebe só as rotas da sua experiência (+ compartilhadas + catch-all), reforçado por `ExperienceGuard` em cada layout.
- `tsc --noEmit` limpo; **build de produção** OK; boot deslogado validado no navegador.
- **Testes novos:** ~40 casos unitários verdes (experiences, buildAppRoutes, navActive, adminNav, gestorNav, ExperienceGuard).
- **Falhas de teste pré-existentes (não introduzidas por este trabalho):** `LoginForm`, `AnnouncementEditor`, `AnnouncementsTab`, `UsersTab`, `tests/auth-smoke`, `tests/sidebar` — confirmadas na `main` antes destas mudanças (mocks/ambiente + specs Playwright capturados pelo vitest).

## ⚠️ Verificação manual logada pendente (recomendado antes/depois do merge)

Os layouts montam só autenticado; validei estrutura por testes/build, mas vale conferir logado:
- **Aluno:** Home em `/`, item "Início" ativo em `/`.
- **Admin:** `/admin/*` (sub-nav, deep-link/refresh/back-forward), `/gestao-usuarios` e `/analytics` redirecionam.
- **Gestor:** `/gestor/*`, e **trocar de módulo não reseta os filtros globais**.
- **CX:** `/atendimento/usuarios` (sem recursos exclusivos de admin).

## 📌 Pontos menores / follow-ups

- `useIntelligentPrefetch.ts` ainda mapeia algumas URLs antigas (`/home`, `/analytics`) — prefetch é só perf; vale um refresh futuro.
- `ALUNO_NAV` ainda não é consumido pela sidebar/bottom-nav (que mantêm seus arrays com as URLs corretas) — unificação futura.
- Fallback final de `getDefaultRouteForUser` retorna `/home` no caso extremo "nenhuma tela liberada" (sem impacto prático).

---

*Atualizado ao concluir F4·15 (regressão final). PR único cobrindo F1–F4 a ser aberto na F4·16.*
