# Progresso da Remediação — Plano `monte-um-plano-completo-proud-whale.md`

Snapshot do estado das 8 fases planejadas. Atualize após cada PR.

## Resumo executivo

- **Achados resolvidos: 30 de 39** (77%)
  - 🔴 Críticos: **5/5** (100%)
  - 🟠 Altos: **12/15** (80%)
  - 🟡 Médios: **12/17** (71%)
  - 🔵 Baixos: **1/2** (50%)

- **Commits na branch:** 13
- **Linhas removidas:** ~3500 (deprecated)
- **Arquivos com `console.*` substituídos:** 91 → 0 em runtime
- **Edge functions com CORS allowlist (gatekeep):** 22/36
- **Edge functions migradas para template completo (rate limit + Zod + CORS):** 5 (`save-calendar-arrangement`, `request-password-reset`, `delete-user`, `sync-user-auth`, `corrigir-simulado`)
- **Edge functions com gatekeep de Origin (defesa em profundidade):** +16 via codemod
- **Service layer:** `calendarService` completo; `useCalendarSync` migrado (-1 dos 78 imports diretos de supabase em components/hooks)

## Fases

| Fase | Status | Commit | Observações |
|---|---|---|---|
| 0 — Fundação | ✅ Completa | `fd1cbfc` | Lockfiles padronizados, env.ts Zod, runbook §1-§6 criado |
| 1 — Críticos | ✅ Completa | `3ccf863` | 5/5 críticos resolvidos. Requer rotação de anon key (runbook §1) |
| 2 — Hardening edge fn | 🟡 Parcial | `5b2d96d`, `2407f88`, `f293f52` | Shared utils prontas; 5 funções migradas completas; +16 com gatekeep de Origin via codemod |
| 3 — Bug fixes hooks | 🟡 Parcial | `2d1b254`, `e7a8394` | useCalendarSync, StudyGuide, AuthContext fixos. Service layer iniciado (calendarService). God file refactor pendente |
| 4 — TS strict | ❌ Pendente | — | Adiado: sem validação local, risco alto de quebrar CI |
| 5 — Logger + cleanup | ✅ Completa | `aca5e97`, `c763f82`, `9f72c09` | `_deprecated/` removido, console→Logger codemod, ESLint hardening |
| 6 — Testes | 🟡 Parcial | `0f73147` | 3 suítes unit cobrindo fixes da Fase 1/2. Cobertura geral ainda baixa |
| 7 — Documentação | 🟡 Em curso | — | Este documento; runbook completo |

## Pendências priorizadas para próximos PRs

### Alto valor / baixo risco
1. **Migrar restantes edge functions** (`b2b-create-user`, `admin-upload-study-guide`, `admin-upload-simulado-images`, `corrigir-simulado` para CORS allowlist + rate limit, etc.) usando template `_shared/`. 1 PR por batch (B-E do runbook §3.2).
2. **Fase 4 TS strict incremental:** primeiro `strictNullChecks`, validar CI, depois `noImplicitAny`, etc. 1 PR por flag.
3. **Codemod `as any` → tipos derivados** de `Database['public']['Tables']`. Usar ts-morph. 1 PR.
4. **Suíte de testes para useCalendarSync** (version check, init key, stale closure) — agora que existe service layer infra. 1 PR.

### Alto valor / alto risco (PR dedicado, com revisão)
5. **Service layer completo:** criar `src/services/{authService,studyGuideService,simuladosService,calendarService,usersService}.ts` e migrar os ~78 imports diretos de `supabase` em components/pages. PR por domínio.
6. **Quebra de god files:**
   - `SimuladosTab.tsx` (1976 linhas) → `useSimuladosUpload`, `useExcelParser`, `SimuladoFormDialog`, `SimuladosList`.
   - `UsersListTable.tsx` (1379 linhas) → `UserFilterBar`, `UserBatchActions`, `UserRowEditor`.
   - `useHomeData.ts` (412 linhas) → hooks por domínio.
7. **Playwright E2E** (login, simulado completo, calendário, troca de senha) + job no CI. 1 PR.

## Ações manuais Supabase (do runbook)

Status no momento deste documento — confirmar antes de mergear para `main`.

| Item | Status | Onde |
|---|---|---|
| Rotacionar anon key Supabase | ⚠️ **PENDENTE** | Dashboard §1 |
| Rotacionar service_role | ⚠️ **PENDENTE** | Dashboard §1 |
| Aplicar `20260526_simulados_rls_defense_in_depth.sql` em staging | ⚠️ **PENDENTE** | `supabase db push` §2 |
| Habilitar Deno KV | ⚠️ **PENDENTE** | Dashboard §3.1 |
| Deploy `corrigir-simulado` (fix IDOR) | ⚠️ **PENDENTE** | `supabase functions deploy` §3.2 |
| Deploy `save-calendar-arrangement` | ⚠️ **PENDENTE** | idem |
| Deploy `request-password-reset` | ⚠️ **PENDENTE** | idem |
| Deploy `delete-user` | ⚠️ **PENDENTE** | idem |
| Deploy `sync-user-auth` | ⚠️ **PENDENTE** | idem |
| Configurar env vars de função (`ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MIN`) | ⚠️ **PENDENTE** | Dashboard §3.3 |
| Habilitar feature flag `VITE_FF_PROVA_RACE_FIX` em staging | ⚠️ **PENDENTE** | Vercel staging |
| Habilitar `VITE_FF_PROVA_RACE_FIX` em produção (após smoke) | ⚠️ **PENDENTE** | Vercel prod |

## Validação não executada localmente

O ambiente de execução remoto bloqueia o mirror npm/bun (403 em `bun install`).
**TODA validação `type-check` / `lint` / `test:run` precisa rodar via CI do GitHub Actions** quando o PR for aberto.

Mitigações usadas neste plano:
- Mudanças cirurgicamente isoladas (não tocam grandes arquivos sem necessidade).
- Interfaces públicas preservadas (`env.STUDY_GUIDE_API_BASE_URL`, etc.).
- Códigos novos seguem padrões do código existente.
- Codemods (Logger) idempotentes e roláveis via git.
- Feature flags para fluxos sensíveis (`VITE_FF_PROVA_RACE_FIX`).
