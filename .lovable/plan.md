
# Atualização de Emails em Lote — Portal do Admin

## 1. Análise de Riscos e Garantias de Segurança

Investiguei o fluxo atual (b2b-create-user, delete-user, trigger `validate_user_update`, RLS de `public.users`) e identifiquei exatamente o que precisa ser protegido. Os riscos e as mitigações:

### 1.1 Risco: Privilege Escalation (admin malicioso ou token roubado)
**Mitigação (mesmo padrão de `b2b-create-user` / `delete-user`):**
- Gatekeeping de `Origin` via `isAllowedOrigin` (rejeita 403 antes de qualquer lógica).
- Exige header `Authorization: Bearer <jwt>` válido.
- Verifica JWT com cliente user-scoped (`supabaseCaller.auth.getUser()`).
- Checa role via `has_role(uid, 'admin')` — **`atendimento`, `gestor`, `professor` NÃO terão acesso** a esta função. Só `admin`.
- Rate limit: **5 req/min por IP** (operação destrutiva e cara — mais restrita que delete-user).

### 1.2 Risco: Sequestro de conta (trocar email de outro admin → tomar a conta via reset de senha)
**Mitigação:**
- Bloqueio server-side: se o `user_id` resolvido a partir do email antigo possui role `admin`, `gestor`, `gestor_grupo`, `professor` ou `atendimento`, a linha é **rejeitada** com motivo `protected_role`. Apenas alunos podem ter email alterado em lote.
- Bloqueio de self-update: admin não pode alterar o próprio email via esta função (use o fluxo normal de troca de email do Supabase Auth).
- Logs de auditoria em `admin_audit_log` (já existe na DB) com `actor_id`, `target_user_id`, `old_email`, `new_email`, `ip`, `user_agent`, `batch_id`.

### 1.3 Risco: Email novo já em uso (colisão → corrupção de identidade)
**Mitigação:**
- Pré-check em `public.users` E em `auth.users` (via `supabaseAdmin.auth.admin.listUsers` com filtro): se `email_novo` já existe em qualquer um dos dois, a linha é rejeitada com `email_already_in_use`.
- Operação atômica por linha: atualiza `auth.users` primeiro (fonte de verdade); só depois `public.users`. Se a primeira falha, a segunda nem é tentada.

### 1.4 Risco: Trigger `validate_user_update` bloqueia alteração de email
O trigger atual tem `IF OLD.email IS DISTINCT FROM NEW.email THEN RAISE EXCEPTION 'Users cannot change their email'`. **Já existe bypass para `service_role`** (`IF auth.role() = 'service_role' THEN RETURN NEW`). Como a edge function usa `SUPABASE_SERVICE_ROLE_KEY`, o update passa. **Sem migração no trigger necessária.**

### 1.5 Risco: Validação de entrada (CSV malicioso, injeção)
**Mitigação:**
- Parsing client-side com `papaparse` (já usado no projeto), normalização (`trim().toLowerCase()`).
- Validação Zod server-side em cada linha: schema `{ email_antigo: z.string().email().max(255), email_novo: z.string().email().max(255) }`.
- Limite de **500 linhas por CSV** (cap server-side; o cliente faz upload em chunks de 50 com pausa de 200ms).
- Deduplicação: rejeita CSVs com `email_antigo` duplicado ou com `email_novo` que aparece como `email_antigo` em outra linha (evita cadeias `A→B, B→C`).

### 1.6 Risco: CORS / origens não confiáveis
Mesmo `buildCorsHeaders(origin)` usado em `delete-user` — só responde para origens da allowlist Sanar.

### 1.7 Risco: Vazamento de PII em logs
Uso de `maskEmail()` (já existente) em todos os `console.log`. Audit log no DB armazena emails completos (necessário para rastreabilidade), mas é tabela com RLS admin-only.

---

## 2. Resposta às suas Perguntas Diretas

### "O usuário vai perder seu progresso e dados salvos?"
**NÃO.** Todos os dados (`user_progress`, `study_progress`, `simulados_finalizados`, `calendar_subjects`, `user_exams`, etc.) são vinculados por `user_id` (UUID imutável), **não por email**. Trocar o email mantém 100% do histórico, calendário, simulados, caderno de erros, ranking, TRI — nada é perdido.

### "Vai precisar de alguma verificação pelo usuário?"
Você tem 2 opções. A **recomendada** é a B:

- **Opção A — Sem verificação (silent update):** atualiza `email` direto via `supabaseAdmin.auth.admin.updateUserById(id, { email, email_confirm: true })`. O usuário continua logado nas sessões atuais. Na próxima vez que fizer login, **usa o email novo**.  
  Risco: se o admin errar o email, o usuário pode ficar sem acesso e sem aviso.

- **Opção B — Notificação por email (recomendada):** mesmo fluxo de atualização silenciosa, **+** dispara um email automático para o `email_novo` via Novu confirmando "Seu email de acesso foi atualizado pelo administrador da sua IES. Use este endereço a partir de agora." Sem clique necessário (não é double opt-in). E **invalida todas as sessões ativas** do usuário (`supabaseAdmin.auth.admin.signOut(userId, 'global')`) — assim ele é forçado a relogar com o novo email, evitando confusão.

Recomendo a **Opção B** por segurança e UX. Está prevista no plano abaixo.

---

## 3. Plano de Implementação

### 3.1 Backend: Nova Edge Function `admin-bulk-update-email`

**Arquivo:** `supabase/functions/admin-bulk-update-email/index.ts`

Estrutura espelhada em `b2b-create-user`:
1. Gatekeep Origin → `isAllowedOrigin`
2. CORS preflight
3. Rate limit 5/min/IP (`checkRateLimit`)
4. Verifica JWT + `has_role(uid, 'admin')`
5. Valida body com Zod: `{ rows: [{ email_antigo, email_novo }], batch_id?: string }`
6. Cap server-side de 50 linhas por invocação (cliente itera)
7. Para cada linha:
   - Normaliza ambos os emails (`trim().toLowerCase()`)
   - Busca `users` por `email_antigo` → se não existe: `user_not_found`
   - Busca roles do user_id → se `admin/gestor/gestor_grupo/professor/atendimento`: `protected_role`
   - Bloqueia `target.id === caller.id`: `cannot_update_self`
   - Busca conflito em `users.email = email_novo`: `email_already_in_use`
   - Busca conflito em `auth.users` via `listUsers({ filter: email_novo })`: `email_already_in_use`
   - `supabaseAdmin.auth.admin.updateUserById(id, { email: email_novo, email_confirm: true })`
   - `supabaseAdmin.from('users').update({ email: email_novo }).eq('id', id)` (passa pelo trigger via service_role)
   - `supabaseAdmin.auth.admin.signOut(id, 'global')` (invalida sessões)
   - Dispara email Novu de notificação para `email_novo`
   - Insere registro em `admin_audit_log`
8. Retorna `{ results: [{ email_antigo, email_novo, status: 'updated'|'failed', reason? }] }`

### 3.2 Migração DB (mínima)

Apenas garantir que `admin_audit_log` aceita o action_type novo (verificar e, se necessário, documentar). Sem mudanças em `validate_user_update` (bypass de service_role já existe). Sem mudanças em RLS.

Possível adição: índice `CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (lower(email))` para acelerar lookup case-insensitive (se ainda não existir).

### 3.3 Frontend: Nova aba/seção no Portal do Admin

**Arquivo novo:** `src/components/admin/users/BulkEmailUpdateTab.tsx`  
Integração em: `src/components/admin/users/UsersTab.tsx` (ou nova aba dedicada em `UserManagement.tsx`)

Componentes:
- Card explicativo: "Atualização de emails em lote"
- Botão "Baixar modelo CSV" → download de `template_atualizacao_emails.csv`
- Dropzone para upload de CSV (PapaParse)
- Preview da tabela parseada (max 20 linhas mostradas) com validação client-side
- Checks client-side: emails válidos, sem duplicatas, não excede 500 linhas
- Botão "Processar atualização" com confirmação modal (`AlertDialog`) listando: quantos serão atualizados, alerta sobre logout forçado, alerta de irreversibilidade
- Processa em chunks de 50 via `usersService.bulkUpdateEmail(rows)`
- Tela de resultado com tabela: ✅ atualizados | ❌ erros (com motivo legível)
- Botão "Exportar relatório" → CSV dos resultados

### 3.4 Service Layer

Adicionar em `src/services/usersService.ts`:
```ts
async bulkUpdateEmail(rows: Array<{email_antigo: string; email_novo: string}>): Promise<BulkUpdateResult>
```

### 3.5 CSV Template

**Arquivo:** `public/templates/template_atualizacao_emails.csv`
```csv
email_antigo,email_novo
aluno.antigo@faculdade.edu.br,aluno.novo@faculdade.edu.br
joao.silva@old.com,joao.silva@new.com
```

### 3.6 Email de Notificação (Novu)

Template HTML inline (estilo dos emails Sanar existentes):
- Assunto: "Seu email de acesso ao SanarFlix Academy foi atualizado"
- Corpo: explica a mudança, lista o novo email, instrui a usar a partir de agora, link para "Esqueci minha senha" caso não tenha sido o usuário quem solicitou.
- `disableTracking: true` (per memória `auth-email-tracking-disabled`).

### 3.7 Testes

Criar `src/test/components/admin/BulkEmailUpdateTab.test.tsx` (validação CSV, preview, erros) e `supabase/functions/admin-bulk-update-email/_test.ts` (Deno test — happy path, protected_role, email_already_in_use, cannot_update_self).

---

## 4. Resumo de Garantias de Segurança

| Vetor | Proteção |
|---|---|
| Origem não autorizada | `isAllowedOrigin` (403) |
| Token ausente/inválido | 401 com cliente user-scoped |
| Não-admin tentando usar | `has_role(uid,'admin')` → 403 |
| Admin trocando email de outro admin/gestor | Bloqueio explícito `protected_role` |
| Admin trocando o próprio email | Bloqueio `cannot_update_self` |
| Email novo já existe | Pré-check em `users` + `auth.users` |
| CSV malicioso (XSS, SQLi) | Zod + parametrização via supabase-js |
| DoS / abuse | Rate limit 5/min, cap 50/req, cap 500/CSV |
| Perda de dados do aluno | Nenhuma — `user_id` UUID é imutável |
| Logout forçado / sessão zombie | `auth.admin.signOut(id, 'global')` |
| Auditoria | Insert em `admin_audit_log` por linha |
| Vazamento em logs | `maskEmail()` |

Após sua aprovação, implemento exatamente nesta ordem: edge function + tests → service → componente → template CSV → integração na UI.
