

## Plano: Copiar links de primeiro acesso e redefinição de senha no portal admin

### Contexto
O admin precisa copiar diretamente o link de primeiro acesso (boas-vindas) e o de redefinição de senha de cada usuário, sem precisar enviar o email. Isso é útil para suporte direto (ex: enviar via WhatsApp).

### Abordagem

**1. Nova Edge Function: `generate-user-link`**

Criar uma edge function que recebe `{ email, type }` (onde type = `welcome` ou `reset`), valida que o chamador é admin, gera o link via `supabase.auth.admin.generateLink({ type: 'recovery', ... })` e retorna a URL canônica (usando `buildCanonicalLink`) sem enviar email.

- `type: 'welcome'` → `redirectPath: '/auth/update-password'`
- `type: 'reset'` → `redirectPath: '/reset-password'`

A function usa service role para gerar o link e verifica admin role do chamador.

**2. Dois novos itens no dropdown menu de cada usuário (UsersListTable)**

No `DropdownMenuContent` de cada linha, adicionar:
- **"Copiar link de primeiro acesso"** (ícone Link) → chama a edge function com `type: welcome`, copia a URL para o clipboard e mostra toast de sucesso
- **"Copiar link de redefinição"** (ícone KeyRound) → chama a edge function com `type: reset`, copia a URL para o clipboard e mostra toast de sucesso

Posicionados logo após "Reenviar Convite" e antes de "Sincronizar Auth".

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `supabase/functions/generate-user-link/index.ts` | Criar |
| `src/components/admin/UsersListTable.tsx` | Adicionar 2 itens ao dropdown + função `copyUserLink` |

### Segurança
- A edge function valida token JWT e verifica `has_role(adminId, 'admin')` antes de gerar qualquer link
- Registra a ação no `admin_audit_log`
- Links gerados expiram conforme configuração do Supabase Auth (24h padrão)

