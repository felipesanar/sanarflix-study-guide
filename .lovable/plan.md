

## Plano: Reenvio automático de link + OTP Expiry de 3 dias

### 1. Aumentar OTP Expiry para 3 dias

Isso precisa ser feito **manualmente no Supabase Dashboard**:
- Authentication > Settings > OTP Expiry: alterar de `3600` para `259200` (3 dias)
- Não requer mudança de código

### 2. Criar Edge Function `resend-welcome-link`

Nova Edge Function pública (`verify_jwt = false`) que:
- Recebe `{ email }` no body
- Busca o usuário em `public.users` pelo email
- Se não encontrar, retorna sucesso silencioso (segurança)
- Gera um novo recovery link via `generateLink({ type: 'recovery' })`
- Envia o email de boas-vindas (mesmo template) via Novu `workflow-email`
- Rate limit simples: verifica se já enviou nos últimos 5 minutos (opcional, via log ou in-memory)

Registrar em `supabase/config.toml`:
```toml
[functions.resend-welcome-link]
verify_jwt = false
```

### 3. Adicionar botão "Solicitar novo link" nos templates de email

Nos dois templates HTML (`buildWelcomeEmailHtml` e `buildResetPasswordHtml`), adicionar após o bloco do link alternativo uma nova seção com um link/botão secundário:

- **Welcome email**: link aponta para `https://academy.sanar.com.br/auth/resend?email={email_encoded}` — uma rota no frontend que chama a Edge Function `resend-welcome-link`
- **Reset password email**: link aponta para a tela de login com o botão "Esqueci a senha" já existente, tipo `https://academy.sanar.com.br/?forgot=true`

O botão terá estilo secundário (outline, sem preenchimento vermelho) com texto "Solicitar um novo link".

### 4. Criar rota `/auth/resend` no frontend

Página simples que:
- Lê o `email` da query string
- Mostra uma tela com mensagem "Gerando novo link de acesso..."
- Chama `supabase.functions.invoke('resend-welcome-link', { body: { email } })`
- Mostra feedback de sucesso: "Um novo link foi enviado para seu email"
- Redireciona para a tela de login após 5 segundos

### Arquivos modificados/criados

| Arquivo | Ação |
|---|---|
| `supabase/functions/resend-welcome-link/index.ts` | Criar |
| `supabase/config.toml` | Adicionar config da nova function |
| `supabase/functions/b2b-create-user/index.ts` | Atualizar HTML do welcome email |
| `supabase/functions/request-password-reset/index.ts` | Atualizar HTML do reset email |
| `src/pages/ResendWelcome.tsx` | Criar página `/auth/resend` |
| `src/App.tsx` | Adicionar rota `/auth/resend` |

### Nota importante

O aumento do OTP Expiry para 259200s (3 dias) precisa ser feito manualmente no dashboard do Supabase antes de tudo.

