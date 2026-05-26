# Deploy Checklist — Remediação (operações manuais)

> Este documento lista **apenas** os passos que dependem de acesso humano
> ao Supabase Dashboard, Vercel, GitHub, ou execução de CLIs com credenciais
> de produção. Tudo que é código no repo já foi feito ou está listado em
> `docs/remediation-progress.md` § "Próximos PRs".
>
> Marque cada item com `[x]` conforme executa. Não pule a ordem dos blocos —
> a sequência minimiza blast radius.

Referências cruzadas: `docs/runbook-supabase.md` (procedimentos detalhados §1–§6).

---

## Bloco A — Rotação de credenciais (FAZER PRIMEIRO)

> Anon key antiga ficou commitada pré-`fd1cbfc`. Considere comprometida.

- [ ] **A1.** Supabase Dashboard → Settings → API → **Rotate** `anon (public)` key
- [ ] **A2.** Mesma tela → **Rotate** `service_role` key
- [ ] **A3.** Atualizar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em:
  - [ ] Vercel → Project → Settings → Environment Variables (Preview + Production)
  - [ ] GitHub → Settings → Secrets and variables → Actions → `VITE_SUPABASE_ANON_KEY`
  - [ ] `.env.local` de cada dev no time (comunicar via Slack)
- [ ] **A4.** Atualizar `SUPABASE_FUNCTION_URL`, `SERVICE_ROLE`, `GOOGLE_SHEETS_URL`,
      `ADMIN_KEY` em GitHub Actions (workflow `.github/workflows/import_users_daily.yml`)
- [ ] **A5.** Comunicar rotação aos integradores externos
      (pipelines TRI, importação diária, crons externos)

---

## Bloco B — Migrations SQL (staging → prod)

Migrations já no repo:
- `supabase/migrations/20260526000000_simulados_rls_defense_in_depth.sql`
- `supabase/migrations/20260526010000_impersonation_rpcs_security_definer.sql`

- [ ] **B1.** Staging → SQL Editor → executar `20260526000000_…rls_defense_in_depth.sql`
- [ ] **B2.** Staging → SQL Editor → executar `20260526010000_…impersonation_rpcs….sql`
- [ ] **B3.** Smoke em staging:
  - [ ] Fazer um simulado completo de ponta a ponta
  - [ ] Se for admin: testar impersonation
  - [ ] Tentar `INSERT` direto via REST com `user_id` de outro usuário (esperado: 403)
- [ ] **B4.** Repetir B1+B2 em **produção** após smoke verde (mín. 24h em staging)

---

## Bloco C — Habilitar Deno KV (pré-requisito de rate limit)

- [ ] **C1.** Supabase Dashboard → Edge Functions → Settings → **Enable KV Store**
- [ ] **C2.** Confirmar: `supabase functions list` deve listar a feature flag

---

## Bloco D — Deploy de Edge Functions

**Comando padrão:** `supabase functions deploy <nome> --project-ref gvqvrmkizemwsasmupmo`

### Batch A — Template completo (rate limit + Zod + CORS allowlist)
- [ ] **D1.** `corrigir-simulado` ← fix IDOR crítico
- [ ] **D2.** `save-calendar-arrangement`
- [ ] **D3.** `request-password-reset`
- [ ] **D4.** `delete-user`
- [ ] **D5.** `sync-user-auth`
- [ ] **D6.** `b2b-create-user`

### Batch B — Gatekeep de Origin (defense-in-depth)
Deploy individual (não usar `--all`) para isolar regressões:

- [ ] **D7.** `admin-import-simulado-responses`
- [ ] **D8.** `admin-upload-simulado-images`
- [ ] **D9.** `admin-upload-study-guide`
- [ ] **D10.** `admin-user-support`
- [ ] **D11.** `analyze-error-patterns`
- [ ] **D12.** `check-and-send-reminders`
- [ ] **D13.** `custom-email-templates`
- [ ] **D14.** `generate-user-link`
- [ ] **D15.** `get-progress-hub`
- [ ] **D16.** `get-study-contents`
- [ ] **D17.** `get-vapid-key`
- [ ] **D18.** `health-check`
- [ ] **D19.** `old-user-creation`
- [ ] **D20.** `resend-welcome-link`
- [ ] **D21.** `save-push-subscription`
- [ ] **D22.** `send-study-reminder`

### Env vars por função
- [ ] Dashboard → Edge Functions → cada função → Secrets:
  ```
  ALLOWED_ORIGINS=https://academy.sanar.com.br,https://guiadeestudos.sanar.com.br,https://sanarflix-study-guide.lovable.app
  RATE_LIMIT_PER_MIN=10
  ```

### Smoke por função
Para cada função do Batch A, executar e validar:

- [ ] **D23.** `curl -H "Origin: https://evil.example"` → esperado **403**
- [ ] **D24.** `curl -H "Authorization: Bearer fake"` → esperado **401**
- [ ] **D25.** `curl -X POST -d '{}'` (body inválido) → esperado **400**
- [ ] **D26.** Curl 11× em sequência rápida → 11ª esperada **429** (apenas com rate limit)
- [ ] **D27.** Happy path autenticado → **200**

---

## Bloco E — Feature flags (graduated rollout)

### `VITE_FF_PROVA_RACE_FIX`
- [ ] **E1.** Vercel staging → Env vars → `VITE_FF_PROVA_RACE_FIX=true`
- [ ] **E2.** Smoke completo em staging:
  - [ ] Iniciar simulado, responder, finalizar normalmente → verificar gravação
  - [ ] Iniciar simulado, fechar aba durante envio (DevTools → Network: **Offline**) →
        reabrir → fallback sendBeacon deve recuperar
- [ ] **E3.** Vercel production → `VITE_FF_PROVA_RACE_FIX=true` (após 24h estável em staging)
- [ ] **E4.** Após 2 semanas estáveis em prod, remover a flag
      (commit que limpa o código condicional em `ModoProva.finalizarSimulado`)

### `VITE_FF_CALENDAR_V2`
- [ ] **E5.** Hoje a flag é só declarada em `src/config/env.ts` mas não consumida.
      Quando o PR de finalização do migration server-first v2 do `useCalendarSync`
      for aberto, conectar a flag no mesmo padrão graduated (staging 24h → prod).

---

## Bloco F — Fixtures E2E (Playwright no CI)

- [ ] **F1.** Criar usuário fixture em staging:
  ```bash
  supabase functions invoke b2b-create-user --no-verify-jwt \
    --body '{"email":"e2e@sanarflix.test","nome":"E2E Bot","id_ies":"<UUID>"}'
  ```
- [ ] **F2.** Anotar a senha gerada (ou trocar via fluxo de reset)
- [ ] **F3.** GitHub → Repository Settings → Secrets → Actions:
  - `E2E_USER_EMAIL=e2e@sanarflix.test`
  - `E2E_USER_PASSWORD=<senha>`
- [x] **F4.** `tests/auth-smoke.spec.ts` agora usa essas credenciais
      opcionalmente — se ausentes, mantém o smoke de rendering atual.

---

## Bloco G — Monitoramento pós-deploy (primeiras 48h)

- [ ] **G1.** Supabase Dashboard → Edge Functions → logs de cada função tocada.
      **Esperado:** zero erros 5xx novos.
- [ ] **G2.** Vercel → Logs em prod. **Esperado:** zero spike em error rate.
- [ ] **G3.** (Se Sentry configurado) Monitorar issues marcados "first seen"
      nas primeiras 24h.
- [ ] **G4.** Comparar com baseline:
  - [ ] Latência P95 das edge functions (não regredir > 20%)
  - [ ] Taxa de erro em `corrigir-simulado` (deve cair — IDOR removido)
  - [ ] Simulados perdidos (deve cair — race condition fix)

---

## Bloco I — Longo prazo (próximos sprints)

- [ ] **I1.** Renovate ou Dependabot para gerenciar `^` em `package.json`
- [ ] **I2.** Sentry/LogRocket — `Logger.sendToMonitoring` é placeholder hoje
- [ ] **I3.** CSP estrita: já adicionado **report-only** em `index.html` e
      `vercel.json` neste sprint. Próximo passo: validar relatórios (Sentry
      ou endpoint próprio) e promover para enforce.
- [ ] **I4.** Definir SLO de cobertura de testes (threshold 80% já configurado,
      ainda com poucas suítes — ver Bloco H em `remediation-progress.md`)
- [ ] **I5.** Auditoria trimestral: rerodar o code-review prompt vs baseline

---

## Sequência recomendada (single maintenance window)

```
A → 30 min
C → 5 min
B em staging → 10 min + 30 min smoke
D1 staging → 5 min + 15 min smoke
D2-D6 staging → 30 min + smoke por função
D7-D22 staging → 1h + smoke amostral
E1-E2 staging → 30 min smoke
[24h buffer]
B em produção → repete
D em produção → repete
E3 → enable em prod
F → após produção estável
G → monitora 48h
I → sprints subsequentes
```

---

## O que NÃO está aqui

Tudo que é código (Bloco H da TODO original — strict flags, decomposição
de god files, service layer migration, codemod `as any`, novos testes)
está em `docs/remediation-progress.md` § "Decompostos parcialmente
(roteiro definido)" e será endereçado em PRs dedicados.
