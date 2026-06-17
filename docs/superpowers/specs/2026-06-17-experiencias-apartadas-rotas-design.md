# Reestruturação de Arquitetura — Experiências Apartadas por Rota (Academy v0)

- **Data:** 2026-06-17
- **Autor:** Felipe Souza (com João Nader)
- **Entrega alvo:** sexta-feira, 03/07/2026 (2 semanas)
- **Status:** Aprovado para planejamento

## 1. Contexto e Problema

Hoje todas as telas autenticadas do SanarFlix Academy vivem em rotas planas dentro
de um único root, orquestradas pelo monolito [`DynamicRoutes.tsx`](../../../src/components/DynamicRoutes.tsx).
O commit anterior (`feat(auth): segmenta login por experiência apartada`) já
introduziu o conceito de experiência em [`experiences.ts`](../../../src/utils/experiences.ts)
e roteia cada role para um entrypoint, mas a navegação interna de cada experiência
ainda é **baseada em estado, não em rota**:

- O Portal do Admin (`/gestao-usuarios`) usa `Radix <Tabs>` controlado por `useState`.
  Ao clicar em "Usuários", "Avisos", "IES" etc., **a URL não muda** — só troca o
  componente renderizado. Não há deep-link, voltar/avançar do browser não funciona
  entre abas, e não dá para dar permissão por aba via rota.
- O Desempenho Institucional (`/desempenho-institucional-v2`) tem o mesmo padrão:
  módulos (visão institucional, diagnóstico curricular etc.) são abas internas.

Consequência: as experiências não são de fato apartadas, não há URLs próprias por
página, e o time B2B não consegue navegar/compartilhar telas internas como rotas.

## 2. Objetivo

Reestruturar a arquitetura de roteamento do frontend para que cada **experiência**
seja uma árvore de rotas aninhadas, isolada por um *guard*, e cada **página interna**
(hoje aba por estado) tenha **URL própria**.

Não-objetivos desta entrega (explicitamente fora de escopo):
- Redesign de UI / nova identidade visual ("sem se preocupar com UI agora").
- Criar uma landing page de marketing nova. A raiz `/` para não-autenticados
  renderiza o **login** (comportamento atual movido de `/login` para `/`).
- Mudar regras de negócio de RBAC além do necessário para granularizar por página.

## 3. Experiências (4)

Mantém-se o mapeamento já existente em `experiences.ts`. Cada experiência ganha um
prefixo de rota próprio (exceto Aluno/Professor, que ocupa a raiz):

| Experiência       | Roles                          | Prefixo        |
|-------------------|--------------------------------|----------------|
| Aluno + Professor | `aluno`, `professor`, fallback | `/` (raiz)     |
| Admin             | `admin`                        | `/admin`       |
| Gestão            | `gestor`, `gestor_grupo`       | `/gestor`      |
| Atendimento (CX)  | `atendimento`                  | `/atendimento` |

A diferença entre gestor IES e gestor de grupo é **liberação/visibilidade por
página** dentro de `/gestor`, não rota separada (decisão de produto: João).

## 4. Mapa de Rotas Alvo

### Não autenticado
- `/` → tela de **Login** (hoje em `/login`).
- `/login` → mantido como redirect para `/` (compatibilidade).
- Fluxos públicos preservados: `/reset-password`, `/auth/update-password`,
  `/auth/resend`, `/cadastro-b2c`, `/auth/callback`.

### Aluno + Professor (raiz, sem prefixo)
| Rota                    | Origem hoje               |
|-------------------------|---------------------------|
| `/`                     | `/home` (Home)            |
| `/guia-estudos`         | igual                     |
| `/simulados`            | igual                     |
| `/simulados/:id/prova`  | igual (full-screen)       |
| `/desempenho-simulado`  | igual                     |
| `/dashboard`            | igual (Seu progresso)     |
| `/caderno-de-erros`     | igual                     |
| `/sanarclass`           | igual                     |
| `/meus-feedbacks`       | igual                     |

`/home` → redirect para `/`.

### Admin (`/admin/*`) — abas viram rotas
| Rota                  | Componente de aba hoje         |
|-----------------------|--------------------------------|
| `/admin`              | → redirect `/admin/usuarios`   |
| `/admin/usuarios`     | `UsersTab`                     |
| `/admin/avisos`       | `AnnouncementsTab`             |
| `/admin/ies`          | `IesFeaturesTab`               |
| `/admin/guia`         | `StudyGuideImportTab`          |
| `/admin/sanarclass`   | `SanarClassTab`                |
| `/admin/simulados`    | `SimuladosTab`                 |
| `/admin/feedbacks`    | `FeedbackAdminTab`             |
| `/admin/analytics`    | página `Analytics`            |

> Observação: `components/admin/` contém também `LiberacoesTab`, `MonitoramentoTab`,
> `RealtimeDashboard`. Durante a implementação, confirmar quais estão ativas no
> `UserManagement.tsx` e mapeá-las (ex.: `/admin/liberacoes`, `/admin/monitoramento`).

### Gestão (`/gestor/*`) — módulos viram rotas
| Rota                              | Módulo hoje (PerformanceModuleTabs) |
|-----------------------------------|-------------------------------------|
| `/gestor`                         | → redirect `/gestor/visao-institucional` |
| `/gestor/visao-institucional`     | Visão Institucional                 |
| `/gestor/diagnostico-curricular`  | Diagnóstico Curricular              |
| `/gestor/alunos`                  | Visão de Alunos                     |
| `/gestor/insights-pedagogicos`    | Insights Pedagógicos                |
| `/gestor/inteligencia-decisoria`  | Inteligência Decisória              |

> Os slugs exatos serão confirmados contra as chaves reais de `PerformanceModuleTabs`
> / `ModuleContentRenderer` na implementação. Filtros globais (IES, semestre etc.)
> hoje em `GlobalFilterBar` devem ser preservados via querystring ou contexto ao
> trocar de rota, para não resetar o filtro a cada navegação.

### Atendimento / CX (`/atendimento/*`)
| Rota                    | Conteúdo                         |
|-------------------------|----------------------------------|
| `/atendimento`          | → redirect `/atendimento/usuarios` |
| `/atendimento/usuarios` | gestão de usuários (subset liberado) |

CX reaproveita os componentes de feature do Admin que tiver liberados (hoje só
usuários), renderizados sob seu próprio prefixo/experiência.

### Redirects de compatibilidade (prod sobe direto na main)
- `/home` → `/`
- `/gestao-usuarios` → `/admin/usuarios`
- `/desempenho-institucional` e `/desempenho-institucional-v2` → `/gestor`
- `/analytics` → `/admin/analytics`
- `*` → `NotFound`

## 5. Arquitetura

### 5.1 Composição de rotas
Substituir o monolito `DynamicRoutes` por um **compositor fino** que monta, conforme
a experiência do usuário, o grupo de rotas correspondente. Cada grupo é um módulo
próprio:

```
src/experiences/
  shared/
    ExperienceGuard.tsx     # redireciona p/ getDefaultRouteForUser se experiência ≠ atual
    ExperienceLayout.tsx    # opcional: casca comum (header/sidebar) parametrizável
  aluno/
    AlunoLayout.tsx
    alunoRoutes.tsx
  admin/
    AdminLayout.tsx         # sub-nav (NavLink) + <Outlet/>
    adminRoutes.tsx
  gestor/
    GestorLayout.tsx
    gestorRoutes.tsx
  atendimento/
    AtendimentoLayout.tsx
    atendimentoRoutes.tsx
```

- Cada `*Layout` renderiza a sub-navegação da experiência (NavLink) + `<Outlet/>`.
- Cada `*Routes` exporta o conjunto de `<Route>` aninhadas (layout route + filhas).
- `ExperienceGuard` envolve cada grupo e impede acesso cruzado, reusando
  `getExperience()` e `getDefaultRouteForUser()`.

### 5.2 Layout raiz
[`Layout.tsx`](../../../src/components/Layout.tsx) continua provendo providers
globais (Password, Feedback, SidebarProvider) e o chrome (header, mobile nav, FAB).
A diferença: **sidebar e bottom-nav passam a ser experience-aware** — renderizam o
menu da experiência atual em vez de uma lista plana filtrada por `accessRules`.
`AppSidebar` e `MobileBottomNav` consomem uma config de navegação por experiência.

### 5.3 Abas → páginas
Os componentes `*Tab.tsx` do admin e os módulos do gestor são hoje componentes de
conteúdo. Eles serão envolvidos por **páginas finas** roteáveis (uma por rota), e o
contêiner `UserManagement.tsx` / `DesempenhoInstitucionalV2.tsx` deixa de controlar
abas por `useState` — a aba ativa passa a ser derivada da URL (NavLink + Outlet).
Estado compartilhado entre páginas de uma experiência (ex.: filtros do gestor) sobe
para um contexto da experiência ou querystring.

### 5.4 RBAC por página
`useAccessRules` continua a fonte de verdade. A novidade é granularidade por página
dentro de uma experiência (ex.: gestor de grupo vê multi-IES; CX só vê usuários).
Cada rota filha consulta a regra correspondente; rota negada redireciona para o
entrypoint da experiência. `EXPERIENCE_ENTRYPOINTS` em `experiences.ts` é atualizado
para os novos roots (`/admin/usuarios`, `/gestor`, `/atendimento/usuarios`).

## 6. Fluxo de Dados / Navegação

1. Usuário não autenticado em qualquer rota protegida → `/` (login).
2. Pós-login → `getDefaultRouteForUser(user, accessRules)` resolve o entrypoint da
   experiência (aluno: 1ª tela liberada; demais: entrypoint fixo).
3. Dentro da experiência, navegação entre páginas é por rota real (deep-link,
   back/forward, refresh preservam a página).
4. Tentativa de acessar rota de outra experiência → `ExperienceGuard` devolve ao
   entrypoint próprio.

## 7. Tratamento de Erros / Riscos

- **Bookmarks/links antigos:** cobertos pelos redirects de compatibilidade (§4).
- **Loop de redirecionamento:** o entrypoint de cada experiência deve ser sempre uma
  rota liberada (invariante já garantida em `experiences.ts`); manter ao alterar.
- **Reset de filtros do gestor ao trocar de rota:** mitigado por contexto/querystring.
- **Deploy contínuo na main:** trabalho em branch única; PRs pequenos validados e
  mergeados pelo João. Cada PR deve manter o app funcional (rotas antigas + novas
  convivendo via redirects) para não quebrar produção a meio caminho.
- **Flash de redirect** enquanto `useAccessRules` carrega: manter o skeleton de
  loading já existente em `DynamicRoutes`/`ExperienceGuard`.

## 8. Estratégia de Testes / Verificação

- Build (`vite build` / `tsc`) verde a cada PR — CI do Actions está morto (lint
  falha sempre), então a verificação é local + validação manual no PR.
- Checklist manual por PR: cada rota nova abre, redireciona corretamente, deep-link
  funciona, back/forward funciona, e o guard bloqueia acesso cruzado.
- Smoke por experiência: logar com uma conta de cada role e percorrer as páginas.

## 9. Sequenciamento (Fundação → Admin → Gestor → Aluno/CX)

1. **Fundação:** `ExperienceGuard`, esqueleto `src/experiences/*`, compositor de
   rotas substituindo `DynamicRoutes`, raiz `/` = login, sidebar/nav experience-aware,
   redirects de compatibilidade. App segue funcional com rotas atuais preservadas.
2. **Admin:** abas → rotas (`/admin/*`), `AdminLayout` com sub-nav, páginas finas.
3. **Gestor:** módulos → rotas (`/gestor/*`), `GestorLayout`, preservar filtros.
4. **Aluno/CX:** mover home p/ `/`, consolidar rotas do aluno sob `AlunoLayout`,
   `/atendimento/*` com páginas liberadas.

Detalhe das tarefas no plano de implementação (próximo passo) e espelhado no Notion.
