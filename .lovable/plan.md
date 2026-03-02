

## Corrigir Fluxo "Esqueci a Senha" - Problema de Envio de Email

### Diagnostico

O erro "Failed to reach hook within maximum time of 5.000000 seconds" / 422 / 500 acontece porque:

1. A Edge Function `custom-email-templates` usa **Resend** para enviar emails
2. A API key do Resend esta vinculada a uma conta sandbox (free tier) do usuario `diegoquadros1806@gmail.com`
3. O Resend **bloqueia** envios para qualquer email que nao seja o do dono da conta sandbox
4. Quando alguem como `felipe.souza@sanar.com` tenta redefinir senha, Resend retorna 403
5. A Edge Function retorna 500, e o Supabase Auth interpreta como "hook failed"

**Evidencia dos logs:**
```
"You can only send testing emails to your own email address
(diegoquadros1806@gmail.com). To send emails to other recipients,
please verify a domain at resend.com/domains"
```

### Solucao

Migrar para o sistema gerenciado de emails do Lovable (`auth-email-hook`), que provisiona credenciais automaticamente sem depender de uma conta Resend externa com dominio verificado.

### Passos

#### 1. Configurar dominio de email

Antes de criar os templates, e necessario configurar um dominio de envio. O dominio ideal seria um subdominio como `notify.sanar.com.br` ou `mail.academy.sanar.com.br`.

Sera exibido o dialogo de configuracao de dominio de email para o usuario completar a verificacao DNS.

#### 2. Scaffold dos templates de email gerenciados

Usar a ferramenta `scaffold_auth_email_templates` para criar os templates padrao do Lovable que:
- Nao dependem de `RESEND_API_KEY` externa
- Nao dependem de `SEND_EMAIL_HOOK_SECRET`
- Usam `LOVABLE_API_KEY` (ja provisionada automaticamente)
- Sao compatíveis com o sistema de email do Lovable Cloud

#### 3. Aplicar branding dos templates

Adaptar os templates gerados para manter a identidade visual atual:
- Cores primarias do app (vermelho Sanar `#8B1538`)
- Logo do SanarFlix Academy
- Textos em portugues
- Mesmo tom e linguagem ja usados nos templates atuais

Os templates a serem estilizados:
- **recovery** (redefinicao de senha) - manter o visual atual do `reset-password.tsx`
- **invite** (convite de usuario) - manter o visual do `invite-user.tsx`
- **magic-link** (link magico) - manter o visual do `magic-link.tsx`
- **signup** (confirmacao de cadastro)
- **email-change** (alteracao de email)

#### 4. Deploy da Edge Function `auth-email-hook`

Fazer deploy da nova Edge Function gerenciada. Isso substitui o hook `custom-email-templates` que esta falhando.

#### 5. Verificar fluxo completo

O fluxo de "Esqueci a senha" no `LoginForm.tsx` ja esta correto:
- Chama `supabase.auth.resetPasswordForEmail` com `redirectTo: https://academy.sanar.com.br/reset-password`
- A pagina `/reset-password` (`ResetPassword.tsx`) ja existe e funciona corretamente
- Valida tokens da URL (access_token/refresh_token ou token/type)
- Valida complexidade da senha
- Chama `supabase.auth.updateUser({ password })`

Nenhuma alteracao no codigo do frontend e necessaria.

### Resultado

- Emails de redefinicao de senha serao enviados de um dominio verificado gerenciado pelo Lovable
- Nenhuma dependencia de conta Resend externa
- Todos os tipos de email de autenticacao funcionarao (recovery, invite, magic-link, signup)
- O visual e linguagem dos emails serao mantidos

### Resumo das Mudancas

| Acao | Detalhe |
|------|---------|
| Configurar dominio de email | Via dialogo de setup do Lovable Cloud |
| Scaffold templates gerenciados | `scaffold_auth_email_templates` |
| Estilizar templates | Aplicar branding Sanar (cores, logo, portugues) |
| Deploy `auth-email-hook` | Substituir o hook `custom-email-templates` que falha |
| Codigo frontend | Nenhuma alteracao necessaria |

