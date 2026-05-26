# Runbook Supabase — SanarFlix Guia de Estudos

Operações manuais necessárias no Supabase Dashboard, na CLI ou nos secrets externos para o plano de remediação. Cada PR referencia uma seção (§N) deste runbook.

> ⚠️ Sempre executar primeiro em **staging** e validar via smoke antes de aplicar em produção.

---

## §1 — Rotação de chaves (Fase 1)

**Quando:** imediatamente após merge do PR que remove a anon key hardcoded de `src/integrations/supabase/client.ts`.

**Motivo:** a anon key antiga foi commitada no histórico git e deve ser considerada comprometida.

**Passos:**

1. Acessar Supabase Dashboard → `Settings` → `API`.
2. Na seção **Project API keys**, clicar em **Rotate** para `anon (public)` e `service_role`.
3. Copiar os novos valores para um cofre seguro.
4. Atualizar em:
   - GitHub → Repository Settings → Secrets → `VITE_SUPABASE_ANON_KEY`.
   - Vercel → Project → Settings → Environment Variables (Preview + Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - Workspace local de cada dev: `.env.local`.
5. Comunicar rotação aos integradores externos (importação diária, pipelines TRI).
6. Redeploy do front (Vercel) e das edge functions que injetam a anon key como env.

**Validação:** abrir produção → fazer login → console limpo, sem 401.

**Rollback:** Supabase mantém a chave antiga por janela de transição (verificar Dashboard). Em emergência, recolocar a chave antiga até nova rotação.

---

## §2 — Defesa em profundidade RLS (Fase 1)

**Quando:** junto com PR que corrige IDOR em `corrigir-simulado`.

**Motivo:** garantir que mesmo se a edge function falhar, o banco recuse escrita em nome de outro usuário.

**Tabelas a auditar:**
- `simulados_iniciados`
- `resultados_alunos_*`
- `respostas_alunos`

**Policies necessárias (criar migration nova com timestamp):**
```sql
-- WITH CHECK em INSERT/UPDATE
CREATE POLICY "user owns row insert" ON public.simulados_iniciados
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user owns row update" ON public.simulados_iniciados
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Aplicação:**
```bash
supabase db push --linked     # staging
# validar smoke completo
supabase db push --linked     # production (após approve)
```

**Validação:** com JWT do usuário A, tentar `INSERT` direto via REST passando `user_id` do usuário B → deve retornar 403.

---

## §3 — Hardening de Edge Functions (Fase 2)

### §3.1 — Habilitar Deno KV (rate limiting)

1. Supabase Dashboard → `Edge Functions` → `Settings`.
2. Habilitar **KV Store** no projeto.
3. Confirmar via CLI: `supabase functions list --kv`.

### §3.2 — Deploy em batches

A Fase 2 padroniza ~15 funções com novo shared layer (`_shared/cors.ts`, `_shared/auth.ts`, `_shared/validate.ts`, `_shared/rateLimit.ts`). Deploy em batches de 5 para reduzir blast radius:

**Batch A — funções de autenticação/onboarding:**
- `b2b-create-user`
- `sync-user-auth`
- `delete-user`
- `request-password-reset`
- `update-password`

**Batch B — funções de simulado:**
- `corrigir-simulado` (já tocada na Fase 1; redeploy aqui com template)
- `admin-upload-simulado-images`
- `admin-import-simulado-responses`

**Batch C — funções administrativas:**
- `admin-upload-study-guide`
- `admin-user-support`

**Batch D — funções de calendário e progresso:**
- `save-calendar-arrangement`
- `save-push-subscription`
- `check-and-send-reminders`
- `get-progress-hub`

**Batch E — restantes (analytics, recommendations):**
- `ai-study-recommendation`
- `analyze-error-patterns`
- `session-security`

**Comando por função:**
```bash
supabase functions deploy <nome> --project-ref <ref>
# smoke: curl com Origin inválido (→ 403), JWT inválido (→ 401), body inválido (→ 400), happy (→ 200), rate (→ 429)
```

### §3.3 — Env vars por função

Em **cada** função adicionar (Dashboard → Edge Functions → `<função>` → Secrets):

```
ALLOWED_ORIGINS=https://academy.sanar.com.br,https://guiadeestudos.sanar.com.br,https://sanarflix-study-guide.vercel.app
RATE_LIMIT_PER_MIN=10
```

### §3.4 — Rollback por função

```bash
# listar versões
supabase functions list --history <nome>
# rollback
supabase functions deploy <nome> --version <id_anterior>
```

---

## §4 — Migration UNIQUE em calendar_subjects (Fase 3)

**Pré-requisito:** rodar script de deduplicação ANTES da constraint para evitar falha.

**Script de deduplicação (executar via SQL Editor):**
```sql
WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, name, day_of_week ORDER BY created_at DESC
  ) AS rn
  FROM public.calendar_subjects
)
DELETE FROM public.calendar_subjects
WHERE id IN (SELECT id FROM dups WHERE rn > 1);
```

**Migration:**
```sql
ALTER TABLE public.calendar_subjects
ADD CONSTRAINT calendar_subjects_user_name_day_unique
UNIQUE (user_id, name, day_of_week);
```

**Validação:** tentar inserir duplicata → deve falhar com `23505`.

---

## §5 — RPCs com SECURITY DEFINER (Fase 5)

**Objetivo:** garantir que toda RPC chamada durante impersonation valide `auth.uid()` no banco, não apenas no client.

**Auditoria prévia (executar):**
```sql
SELECT n.nspname, p.proname, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

**Padrão a aplicar em RPCs sensíveis:**
```sql
CREATE OR REPLACE FUNCTION public.<rpc_name>(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  -- lógica
END;
$$;
```

**RPCs a auditar (lista a completar na Fase 5):**
- `get_institutional_*`
- `get_user_progress_*`
- _(a expandir conforme Fase 5)_

---

## §6 — Fixtures e seeds E2E (Fase 6)

**Objetivo:** habilitar testes Playwright reproduzíveis em CI.

**Criar usuário fixture:**
```sql
-- Migration em supabase/migrations/<timestamp>_e2e_fixture.sql
-- Idempotente: só cria se não existe
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'e2e@sanarflix.test';
  IF v_user_id IS NULL THEN
    -- inserção via auth.admin pelo job de seed (não via SQL direto em auth.users)
    RAISE NOTICE 'Criar via supabase auth admin: e2e@sanarflix.test';
  END IF;
END $$;
```

**Script de seed (executar via CI):**
```bash
supabase functions invoke seed-e2e-fixture --no-verify-jwt
```

**Secrets necessários no CI:**
- `E2E_USER_EMAIL=e2e@sanarflix.test`
- `E2E_USER_PASSWORD=<gerado-no-supabase>`

---

## Quando atualizar este runbook

- Toda vez que uma fase introduzir nova operação manual no Dashboard.
- Toda vez que uma RPC ganhar `SECURITY DEFINER`.
- Toda vez que uma migration depender de pre-flight (deduplicação, backfill).

Histórico de mudanças vai no fundo via PR (não editar diretamente em main).
