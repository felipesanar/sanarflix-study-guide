

## Auditoria do Link de Acesso: Diagnostico e Correcao

### Causa Raiz Identificada

Analisando os logs de autenticacao, o problema fica evidente:

```text
16:07:58  user_signedup  → maria.guerra@sanar.com criada
16:07:58  recovery_requested → token gerado (generateLink)
16:08:23  verify SUCCESS  → IP: 44.198.52.178 (AWS) ← BOT/SCANNER
16:08:27  verify FAIL     → IP: 187.103.33.162 (usuario real) ← "One-time token not found"
```

**O token OTP foi consumido por um bot de seguranca de email (IP AWS 44.198.52.178) 4 segundos antes do usuario real clicar.**

Isso acontece porque o `buildCanonicalLink` gera URLs que apontam para o endpoint server-side do Supabase:

```
https://gvqvrmkizemwsasmupmo.supabase.co/auth/v1/verify?token=TOKEN&type=recovery&redirect_to=...
```

Este endpoint auto-verifica o token em qualquer requisicao GET. Scanners de email (Outlook, Gmail corporativo, SendGrid) fazem GET nessas URLs para checar malware, consumindo o OTP antes do usuario.

### Solucao

Mudar os links para apontar diretamente para a pagina do frontend com o `token_hash` como parametro de query. O frontend verifica o token via `verifyOtp()` apenas quando JavaScript executa num browser real. Scanners de email nao executam JavaScript.

**Novo formato do link:**
```
https://academy.sanar.com.br/auth/update-password?token_hash=TOKEN&type=recovery
```

Em vez de:
```
https://supabase.co/auth/v1/verify?token=TOKEN&type=recovery&redirect_to=https://academy.sanar.com.br/auth/update-password
```

---

### Mudancas

#### 1. Alterar `buildCanonicalLink` para gerar links diretos ao frontend

**Arquivo: `supabase/functions/_shared/auth-links.ts`**

Mudar a Strategy 1 (token_hash) para construir URL apontando para `academy.sanar.com.br/auth/update-password?token_hash=X&type=Y` em vez de `supabase.co/auth/v1/verify?token=X`.

A Strategy 2 (action_link) e Strategy 3 (fallback) permanecem como backup.

#### 2. Atualizar `UpdatePassword.tsx` para verificar via query params

**Arquivo: `src/pages/UpdatePassword.tsx`**

Adicionar suporte para ler `token_hash` e `type` dos query params (alem dos hash params que ja le). Prioridade:
1. Query params `token_hash` + `type` → chamar `supabase.auth.verifyOtp({ token_hash, type })`
2. Hash params `access_token` + `refresh_token` → chamar `setSession` (fluxo existente)
3. Hash params `token` + `type` → chamar `verifyOtp` (fluxo existente)
4. Error params → mostrar erro

#### 3. Deploy da Edge Function

Fazer deploy de todas as Edge Functions que importam `auth-links.ts` (b2b-create-user, b2c-signup, e qualquer outra que use o utilitario).

---

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/_shared/auth-links.ts` | Links apontam direto ao frontend, nao ao Supabase verify |
| `src/pages/UpdatePassword.tsx` | Ler token_hash de query params e verificar via verifyOtp |
| Edge Functions | Redeploy b2b-create-user (usa auth-links) |

### Por que isso resolve

- Scanners de email fazem GET na URL → recebem HTML do React SPA → nao executam JS → token nao e consumido
- Usuario real abre a pagina → JS executa → `verifyOtp()` consome o token → senha pode ser definida
- Links antigos (formato Supabase verify) continuam funcionando no UpdatePassword via hash params

