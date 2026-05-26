## Realidade do "faça tudo"

A maior parte desse checklist é **operação manual fora do meu alcance** (rotacionar chaves no Supabase Dashboard, mexer em env vars da Vercel, GitHub Secrets, habilitar Deno KV, rodar `supabase functions deploy`, monitorar logs por 48h, etc.). Eu **não tenho acesso** a Vercel, ao Dashboard da Sanar, ao GitHub Actions secrets, nem posso executar deploys em staging/prod por você.

O plano abaixo separa o que eu **executo de fato** do que eu **deixo pronto pra você apertar o botão**, e lista explicitamente o que continua sendo só seu.

---

## Parte 1 — O que eu vou executar no repo (Bloco H + preparação de B/D)

Sprint único, vários PRs lógicos dentro do mesmo loop de build.

### 1.1 Migrations SQL prontas pra deploy (Bloco B)
Verificar se `supabase/migrations/20260526000000_simulados_rls_defense_in_depth.sql` e `20260526010000_impersonation_rpcs_security_definer.sql` realmente existem; se não existirem, **criá-las** com:
- `WITH CHECK (user_id = auth.uid())` em `simulados_iniciados`, `respostas_alunos`, `answer_progress`.
- Helpers `is_admin()`, `is_authenticated()` e `SECURITY DEFINER` em `get_user_roles`, `get_accessible_ies`.

### 1.2 Edge function `admin-upload-study-guide` (item H10)
Refatorar para CORS allowlist completo via `buildCorsHeaders(origin)` + helpers `errorResponse/successResponse` recebendo cors por parâmetro, padrão do `_shared/cors.ts`.

### 1.3 TypeScript strict flags (H1 → H3)
Ativação em sequência num único PR, com fixes pontuais:
- `strictNullChecks: true`
- `noImplicitAny: true`
- `noUnusedLocals: true` + `noUnusedParameters: true`

Vou corrigir erros emergentes apenas onde necessários — se algum arquivo grande estourar centenas de erros, isolo com `// @ts-expect-error` documentado e abro nota pra acompanhamento.

### 1.4 Migração para service layer (H4, H5)
- `AuthContext.tsx` → usar `authService` em vez de chamar `supabase.auth.*` direto (~14 pontos).
- `UsersListTable.tsx` → usar `usersService` (~8 pontos).

### 1.5 Codemod `as any` (H6)
Script ts-morph que substitui `as any` por aliases de `src/types/domain.ts` quando há correspondência clara. Onde não houver, mantém `as unknown as <Tipo>` com comentário.

### 1.6 Decomposição de god files (H7, H8, H9)
- `SimuladosTab.tsx` (1977 L) → `useSimuladosUpload`, `useExcelParser`, `SimuladoFormDialog`, `SimuladosList`.
- `UsersListTable.tsx` (1380 L) → `UserFilterBar`, `UserBatchActions`, `UserRowEditor`.
- Migrar consumers de `useHomeData()` para os sub-hooks de `src/hooks/home/` e **deletar o monolito**.

### 1.7 Cobertura de testes (H12, H13)
Suítes Vitest novas:
- `useCalendarSync`: version check, init key, stale closure.
- `iesService`, `simuladosApi`, `studyGuideApi`.

### 1.8 Feature flag `VITE_FF_CALENDAR_V2` (E5)
Conectar a flag a `useCalendarSync` (atualmente declarada mas não usada), no padrão graduated rollout.

### 1.9 Suporte ao E2E fixture (F4)
Atualizar `tests/auth-smoke.spec.ts` para usar `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` opcionalmente: se presentes, faz login real e valida home; se ausentes, mantém o teste atual de render.

### 1.10 CSP básico (I3, base de H11)
Adicionar meta CSP em `index.html` + `vercel.json` com `Content-Security-Policy` razoável (`script-src 'self' https://*.supabase.co; object-src 'none'`). Sem nonce dinâmico — fica explícito como passo de robustez extra a iterar.

### 1.11 Documentação operacional
- Atualizar `docs/remediation-progress.md` marcando o que avançou.
- Criar `docs/deploy-checklist.md` com **apenas** os itens que dependem de você (blocos A, C, D batches, E, F1-F3, G, I1, I2, I4, I5), prontos pra você marcar conforme executa.

---

## Parte 2 — O que continua sendo SÓ você (não tenho como fazer)

Estes ficam documentados em `docs/deploy-checklist.md`, mas não tenho ferramentas:

- **Bloco A** completo (rotação de keys no Supabase Dashboard, Vercel, GitHub).
- **Bloco B3/B4** (executar as migrations em staging/prod e fazer smoke).
- **Bloco C** (habilitar Deno KV no Dashboard).
- **Bloco D1–D22** (deploys via `supabase functions deploy`). Posso preparar o código; o deploy é seu.
- **Bloco D23–D27** (smoke curl).
- **Bloco E1–E4** (Vercel env vars + janela de 24h + cleanup pós-2 semanas).
- **Bloco F1–F3** (criar fixture E2E + GitHub Actions Secrets).
- **Bloco G** (monitoramento 48h).
- **Bloco I1, I2, I4, I5** (Renovate/Dependabot, Sentry, SLO, auditoria trimestral) — posso fazer scaffold se você pedir explicitamente.

---

## Parte 3 — Sequência de execução

```
PR-1: Migrations B1+B2 (se ainda não existem) + doc deploy-checklist.md
PR-2: TS strict flags + fixes (H1-H3)
PR-3: AuthContext + UsersListTable → service layer (H4, H5)
PR-4: Decomposição SimuladosTab (H7)
PR-5: Decomposição UsersListTable (H8)
PR-6: Migração consumers useHomeData + remoção monolito (H9)
PR-7: Codemod as any (H6)
PR-8: Testes Vitest novos (H12, H13)
PR-9: FF_CALENDAR_V2 + E2E auth-smoke opcional (E5, F4)
PR-10: CSP + admin-upload-study-guide CORS (I3, H10)
```

Tudo no mesmo loop — quando terminar, te devolvo: lista de mudanças por PR, status do build, e o `docs/deploy-checklist.md` com **só** os passos manuais restantes.

---

## Riscos e observações

- **`strictNullChecks` é o maior risco**: pode gerar centenas de erros nos god files (Simulados, Users). Vou começar por ele para já validar se sobrevive ao type-check do harness; se for inviável num único PR, divido por domínio.
- **Codemod `as any`**: só substitui onde o tipo derivado é claro; resto fica anotado.
- **Decomposição de god files**: refactor amplo, alto risco de regressão. Vou preservar interfaces externas (props, exports) e manter testes existentes verdes.
- **CSP estrita**: pode quebrar tracking pixels ou inline scripts do Lovable preview. Começo com `Content-Security-Policy-Report-Only` para você validar antes de fazer enforce.
- **Não tenho como rodar `bun install` no sandbox** (mirror npm bloqueia 403, conforme `remediation-progress.md`). Toda validação real (`type-check`, `lint`, `test:run`, `playwright`) será no CI do GitHub Actions depois do PR — não consigo confirmar localmente antes.

Confirma esse escopo e eu mando ver?