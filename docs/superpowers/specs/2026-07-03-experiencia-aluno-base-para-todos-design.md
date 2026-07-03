# Experiência de aluno como base para todos + portais dedicados por cima

**Data:** 2026-07-03
**Autor:** Felipe Souza (com Claude)
**Status:** Design aprovado — pronto para plano de implementação

---

## 1. Problema

Hoje o SanarFlix Academy roteia cada usuário para **uma única** experiência,
resolvida pela role de maior poder em `getExperience(user)`
(`admin > atendimento > gestao > aluno_professor`). O roteador (`buildAppRoutes`)
monta **apenas** as rotas dessa experiência, e para usuários não-aluno a raiz `/`
**redireciona para fora** (para `/admin/usuarios`, `/gestor`, etc.) — commit
`0906524` ("raiz autenticada devolve não-aluno ao seu entrypoint").

Consequências:

- **Admin, gestor e CX nunca conseguem ver a experiência de aluno.** A camada de
  gestão (nossa e dos gestores das IES) não consegue "ver e ter a experiência
  como aluno" para acompanhar/validar o produto que os estudantes usam.
- **O 404 do print** (admin abrindo `academy.sanar.com.br/` e caindo em
  "Oops! Page not found") é o mesmo comportamento em produção: um não-aluno em `/`
  sem rota montada cai no catch-all → NotFound. O redirect de `/` foi um band-aid;
  o comportamento correto é a raiz servir a Home do aluno.

Todo o sistema (roteador, guards, navegação, access rules) assume **1 experiência
por usuário**, e é isso que precisa mudar.

## 2. Objetivo

Inverter o modelo para **acesso híbrido**:

- **Rotas base = experiência de aluno/professor, para TODOS** os usuários
  autenticados (`/`, `/simulados`, `/guia-estudos`, `/dashboard`, `/sanarclass`,
  `/caderno-de-erros`, ...).
- **Portais dedicados por cima**, sob prefixo, para quem tem a role:
  `/admin/*` (admin), `/gestor/*` (gestor IES + grupo), `/atendimento/*` (CX).
- **Alternância** entre os dois contextos por um botão simples ("Ir para versão
  aluno" no portal; entrada para o portal na navegação do aluno).

Isso elimina o 404 (a raiz sempre renderiza a Home do aluno) e entrega o requisito:
a camada de gestão tem a experiência de aluno **e** o seu ambiente dedicado.

## 3. Decisões de produto (confirmadas)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Landing pós-login de admin/gestor/CX | **No portal dedicado** (admin→`/admin`, gestor→`/gestor`, CX→`/atendimento`). A experiência de aluno fica acessível em `/` quando quiserem. |
| 2 | Como alternar entre exp. de aluno e portal | **Botão simples** "Ir para versão aluno" (portal → aluno) e uma entrada para o portal na navegação do aluno (aluno → portal). |
| 3 | O que gestor/CX enxergam na exp. de aluno | **Experiência de aluno completa** (todas as telas). |

## 4. Escopo

**Roles afetadas:** `admin`, `gestor`, `gestor_grupo`, `atendimento`, `professor`,
`aluno` (fallback). Todas passam a ter a experiência de aluno na base; as
privilegiadas ganham o portal por cima.

**Fora de escopo (YAGNI):**

- Dados/demo "de mentira" para privilegiados navegarem a experiência de aluno.
  Eles logam como si mesmos; telas sem dados aparecem vazias (empty state).
- Seletor de experiência sofisticado (dropdown/toggle de contexto). Fica só o
  botão simples.
- Qualquer mudança em RLS/Supabase. Esta é uma mudança **de roteamento e
  navegação no front**; a autorização de dados continua no backend (RLS) como já
  está.

## 5. Design

### 5.1 Montagem de rotas — `src/experiences/buildAppRoutes.tsx` (aditivo)

Deixa de escolher uma experiência única. Passa a **sempre** concatenar:

```
[
  // Compartilhadas da área autenticada
  { path: '/login',        element: <Navigate to={getDefaultRouteForUser(user, rules)} replace /> },
  { path: '/home',         element: <Navigate to={getDefaultRouteForUser(user, rules)} replace /> },
  { path: '/auth/callback', element: <ExperiencePage waitForData={false}><AuthCallback/></ExperiencePage> },

  // BASE: experiência de aluno/professor — para TODOS
  ...alunoRoutes(user, accessRules),

  // POR CIMA: portais dedicados (sempre montados; autorização fica no guard)
  ...adminRoutes(),
  ...gestorRoutes(),
  ...atendimentoRoutes(),

  // Catch-all
  { path: '*', element: <ExperiencePage waitForData={false}><NotFound/></ExperiencePage> },
]
```

Mudanças-chave:

- **Remover** o bloco condicional que injeta o redirect de `/` para não-aluno
  (`...(isAluno ? [] : [{ path: '/', element: <Navigate ...> }])`). A raiz `/`
  volta a vir de `alunoRoutes` para todos.
- Os módulos de portal passam a ser **sempre montados** (não mais escolhidos por
  `getExperience`). A autorização é responsabilidade do guard (5.2). Isso dá
  redirects amigáveis (gestor digitando `/admin` → guard manda para `/gestor`)
  em vez de NotFound, e centraliza a fronteira de autorização.

**Ordem e colisão de paths:** base e portais usam prefixos disjuntos
(`/`, `/simulados`, ... vs `/admin`, `/gestor`, `/atendimento`), então não colidem.
As exceções são os redirects de compatibilidade top-level: `/gestao-usuarios`
existe tanto em `adminRoutes` quanto em `atendimentoRoutes`. Com `useRoutes`, o
primeiro definido vence — mantemos `adminRoutes` antes de `atendimentoRoutes`, o
que resolve `/gestao-usuarios` → `/admin/usuarios` para quem for admin+CX
(inofensivo).

`getExperience` continua existindo e é usado por `getDefaultRouteForUser`
(landing/redirects) — sua semântica ("experiência dedicada do usuário, ou aluno")
não muda.

### 5.2 Guards — role-based — `src/experiences/shared/ExperienceGuard.tsx`

Hoje: `if (getExperience(user) !== experience) redirect`. Passa a checar a **role**
correspondente à experiência guardada:

- `experience="admin"` → exige `isAdmin(user)`
- `experience="gestao"` → exige `isGestor(user)` (cobre `gestor` e `gestor_grupo`)
- `experience="atendimento"` → exige `isAtendimento(user)`

Sem a role → `<Navigate to={getDefaultRouteForUser(user, accessRules)} replace />`.
Assim: um aluno tentando `/admin` cai em `/` (sua base); um gestor tentando `/admin`
cai em `/gestor` (o default dele). Um mapa `experience → predicado de role` mantém
o componente simples e é a única fronteira de autorização de navegação.

### 5.3 Access rules — `src/utils/accessRules.ts`

Habilitar a experiência de aluno completa para as roles privilegiadas que hoje não
a têm:

- **Gestor** (`isGestor`): hoje `{ desempenhoInstitucional, simulados,
  SimuladoDesempenho }`. Adicionar `home: true, studyGuide: true, dashboard: true,
  sanarclass: true, errorNotebook: true` (mantendo os flags de gestão). Assim a
  base do aluno renderiza para o gestor.
- **Admin**: já `ADMIN_RULES` (tudo `true`). Sem mudança.
- **Atendimento (CX)**: já parte de `ADMIN_RULES` (menos desempenho/analytics),
  logo já tem home/studyGuide/dashboard/sanarclass/errorNotebook/simulados. Sem
  mudança.
- **Professor**: já tem home/studyGuide/dashboard/sanarclass/errorNotebook +
  `simulados` (de `DEFAULT_RULES`). Sem mudança.

`useAccessRules` já faz short-circuit para admin/professor/gestor/atendimento
(retorna as regras base sem mesclar `ies_features`), então essas roles recebem
exatamente o que `getAccessRules` devolve — sem dependência de banco/IES.

### 5.4 Navegação — sidebar unificada + botões de alternância

**`src/components/AppSidebar.tsx` e `src/components/navigation/MobileBottomNav.tsx`:**

- Voltar a renderizar a **navegação do aluno para todos**, filtrada por
  `accessRules` (Início, Guia de Estudos/Progresso, Simulados, SanarClass, Caderno
  de Erros). Remover o branch por `getExperience`/`isAluno` que substituía a nav do
  aluno pela nav do portal.
- Para usuário privilegiado, acrescentar **uma entrada para o(s) seu(s) portal(is)**:
  - `isAdmin` → "Portal do Admin" (`/admin/usuarios`)
  - `isGestor` → "Desempenho Institucional" / "Gestão" (`/gestor`)
  - `isAtendimento` → "Atendimento" (`/atendimento/usuarios`)
  Encapsular num helper `getPortalEntries(user): NavItem[]` (substitui o papel de
  `getGlobalNav`, que era o switch por experiência). Um usuário com múltiplas roles
  recebe múltiplas entradas.

**Portais — `AdminLayout.tsx`, `GestorLayout.tsx`, `AtendimentoLayout.tsx`:**

- Adicionar no header o botão **"Ir para versão aluno"** → `navigate('/')`. É o
  caminho de volta explícito que o usuário pediu.

Resultado: privilegiado no portal → "Ir para versão aluno" → `/` (Home do aluno,
com a nav completa do aluno); no aluno → entrada "Portal do Admin/Gestão/Atendimento"
na sidebar → volta ao portal.

### 5.5 Sem mudança

- `getDefaultRouteForUser` — mantém o landing pós-login em portal para
  privilegiado; aluno cai na primeira tela liberada.
- Fluxo de login (`LoginForm` → `/home` → `getDefaultRouteForUser`).
- `ies_features` do aluno B2B (`useIesFeatures`).
- Backend / RLS / Supabase.

## 6. Fluxos (aceitação)

1. **Admin abre `academy.sanar.com.br/` já logado** → Home do aluno (não mais 404),
   com nav do aluno + entrada "Portal do Admin".
2. **Admin faz login** → cai em `/admin/usuarios` (portal). Clica "Ir para versão
   aluno" → `/` (Home do aluno). Clica "Portal do Admin" → volta a `/admin`.
3. **Gestor faz login** → `/gestor`. Navega para `/simulados`, `/guia-estudos`, etc.
   e vê a experiência de aluno completa (telas sem dados aparecem vazias, sem
   quebrar).
4. **CX faz login** → `/atendimento/usuarios`. Consegue navegar a experiência de
   aluno pela base.
5. **Aluno/professor** → comportamento atual preservado; `/admin`, `/gestor`,
   `/atendimento` redirecionam para `/` (não têm a role).
6. **Gestor digita `/admin`** → guard redireciona para `/gestor`.

## 7. Riscos e mitigações

- **Telas de aluno para privilegiado sem `id_ies`** (gestor/CX): StudyGuide,
  Dashboard, SanarClass e checagens que dependem de `user.id_ies` devem cair em
  **empty state**, não quebrar. Mitigação: smoke-test de cada tela de aluno logado
  como gestor/CX; onde houver crash em `id_ies` nulo, adicionar guarda de empty
  state. `ErrorBoundary` é a rede de segurança, mas o alvo é não estourar erro.
- **Colisão de rotas de compat** (`/gestao-usuarios` em admin e CX): ordem
  admin-antes-de-CX resolve; documentado em 5.1.
- **Regressão de testes**: `test/unit/globalNav.test.ts` e
  `test/unit/adminNav.test.ts` assumem o modelo antigo. Atualizar/expandir, e
  adicionar testes para: montagem aditiva de rotas, guards por role, e as regras de
  acesso do gestor.

## 8. Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/experiences/buildAppRoutes.tsx` | Montagem aditiva; remover redirect de `/` p/ não-aluno |
| `src/experiences/shared/ExperienceGuard.tsx` | Guard por role (isAdmin/isGestor/isAtendimento) |
| `src/utils/accessRules.ts` | Gestor recebe experiência de aluno completa |
| `src/experiences/shared/globalNav.ts` | Vira `getPortalEntries` (entradas de portal do privilegiado) |
| `src/components/AppSidebar.tsx` | Nav do aluno p/ todos + entrada(s) de portal |
| `src/components/navigation/MobileBottomNav.tsx` | Idem, na barra/menu mobile |
| `src/experiences/admin/AdminLayout.tsx` | Botão "Ir para versão aluno" |
| `src/experiences/gestor/GestorLayout.tsx` | Botão "Ir para versão aluno" |
| `src/experiences/atendimento/AtendimentoLayout.tsx` | Botão "Ir para versão aluno" |
| `test/unit/globalNav.test.ts`, `test/unit/adminNav.test.ts` (+ novos) | Ajustar/expandir |

## 9. Critérios de conclusão

- `npm run type-check`, `npm run lint` e `npm run test:run` passam.
- Fluxos de aceitação (seção 6) verificados no preview local, incluindo o cenário
  do print (admin em `/` → Home do aluno, sem 404).
- Nenhuma tela de aluno quebra logado como admin/gestor/CX.
