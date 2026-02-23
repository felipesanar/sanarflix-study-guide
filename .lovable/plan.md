
# Auditoria Completa: Fluxo de Email e Cadastro de Usuarios

## Problema Principal: confirmationUrl Estatica (Causa do "Link invalido")

A `confirmationUrl` enviada no email do Novu e uma URL fixa:
```
https://academy.sanar.com.br/auth/update-password
```

Mas a pagina `UpdatePassword.tsx` espera receber tokens na URL (via hash ou query params):
- `access_token` + `refresh_token`, ou
- `token` + `type`

Sem esses parametros, a pagina mostra "Link invalido" -- exatamente o que aparece no screenshot.

### Solucao

No `b2b-create-user`, apos criar o usuario, usar `supabase.auth.admin.generateLink()` para gerar um link de recuperacao com tokens reais:

```typescript
const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: {
    redirectTo: 'https://academy.sanar.com.br/auth/update-password'
  }
});
```

Isso retorna um `action_link` com os tokens embutidos. Esse link completo sera passado como `confirmationUrl` no payload do Novu.

---

## Problema 2: "Reenviar Convite" nao reenvia email

A funcao `resendInvite` no `UsersListTable.tsx` chama `b2b-create-user` novamente, mas para usuarios existentes o fluxo entra no branch de UPDATE, que apenas atualiza campos e NAO envia email.

### Solucao

Criar um endpoint dedicado ou adicionar um parametro `resend_email: true` ao `b2b-create-user` para que, no fluxo de update, tambem gere um novo link e dispare o email Novu.

---

## Problema 3: B2C Signup tem o mesmo bug da URL estatica

O `b2c-signup` tambem envia `confirmationUrl` estatica. Porem, como o usuario B2C ja define a propria senha no cadastro, esse email de boas-vindas e apenas informativo -- a URL nao e critica nesse caso. Mesmo assim, deve ser corrigido para consistencia.

---

## Problema 4: sync-user-auth retorna senha temporaria na response

A Edge Function `sync-user-auth` retorna a `temporary_password` no JSON de resposta (linha 172). Isso e uma exposicao desnecessaria. Alem disso, ela nao envia nenhum email ao usuario.

### Solucao

Remover `temporary_password` da response. Apos criar o usuario no auth, gerar um link de recuperacao e enviar o email via Novu (mesmo padrao do b2b-create-user).

---

## Plano de Implementacao

### 1. Corrigir `b2b-create-user` -- URL dinamica com token

- Usar `generateLink({ type: 'recovery', email })` apos criar o usuario
- Extrair o `action_link` e passa-lo como `confirmationUrl` no payload Novu
- Funciona porque o link gerado contem tokens que o Supabase valida

### 2. Adicionar suporte a reenvio de email no `b2b-create-user`

- Aceitar campo opcional `resend_email: boolean` no body
- No fluxo de usuario existente, se `resend_email === true`:
  - Gerar novo link via `generateLink({ type: 'recovery', email })`
  - Disparar email Novu com o link atualizado
  - Retornar `{ emailSent: true }` na response

### 3. Atualizar `resendInvite` no frontend

- Passar `resend_email: true` no body ao chamar `b2b-create-user` para reenvio

### 4. Corrigir `b2c-signup` -- consistencia

- Mesmo ajuste: gerar link dinamico com `generateLink` apos criacao

### 5. Corrigir `sync-user-auth` -- seguranca e email

- Remover `temporary_password` da response
- Apos criar usuario no auth, gerar link e enviar email Novu

### 6. Reimplantar Edge Functions

- `b2b-create-user`
- `b2c-signup`
- `sync-user-auth`

---

## Detalhes Tecnicos

### generateLink retorna:

```typescript
const { data, error } = await supabaseAdmin.auth.admin.generateLink({
  type: 'recovery',
  email: 'user@example.com',
  options: {
    redirectTo: 'https://academy.sanar.com.br/auth/update-password'
  }
});
// data.properties.action_link contém a URL completa com tokens
```

### Payload Novu corrigido:

```json
{
  "name": "welcome-academy-email",
  "payload": {
    "name": "Joao Silva",
    "email": "joao@example.com",
    "confirmationUrl": "https://gvqvrmkizemwsasmupmo.supabase.co/auth/v1/verify?token=abc123&type=recovery&redirect_to=https://academy.sanar.com.br/auth/update-password"
  },
  "to": [{
    "subscriberId": "user-uuid",
    "firstName": "Joao",
    "email": "joao@example.com"
  }]
}
```

### Arquivos modificados:

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/b2b-create-user/index.ts` | generateLink + resend_email support |
| `supabase/functions/b2c-signup/index.ts` | generateLink para URL dinamica |
| `supabase/functions/sync-user-auth/index.ts` | Remover temp password, adicionar email Novu |
| `src/components/admin/UsersListTable.tsx` | Passar `resend_email: true` no resendInvite |
