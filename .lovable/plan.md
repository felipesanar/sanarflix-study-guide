

## Auditoria: Remoção de Usuário

### Problemas Identificados

**1. Ordem de deleção incorreta (causa raiz do erro)**
A Edge Function tenta deletar `public.users` ANTES de `user_roles`. Porém, a tabela `user_roles` possui uma foreign key `granted_by_fkey` que referencia `public.users`. Isso causa o erro:
```
violates foreign key constraint "user_roles_granted_by_fkey" on table "user_roles"
```
Resultado: o delete de `public.users` falha, mas o código continua e tenta deletar de `auth.users`, que tambem falha porque `auth.users` tem dependencias com `public.users` (trigger `handle_new_user` ou FKs internas).

**2. Falta de limpeza de tabelas dependentes**
Alem de `user_roles`, existem outras tabelas com FK para o usuario que precisam ser limpas antes:
- `user_progress` (user_id)
- `user_progress_nodes` (user_id)
- `answer_progress` (user_id)
- Possivelmente `push_subscriptions`, `reminder_settings`, `calendar_subjects`, etc.

**3. Tela trava / sem atualização imediata (frontend)**
- O `fetchUsers()` apos delete recarrega TODA a lista, causando flash de loading
- Nao ha remoção otimista do usuario da lista local
- O dialog de confirmação nao fecha imediatamente apos sucesso
- Console cheio de logs porque o erro 500 dispara retentativas e logs excessivos

**4. CORS headers incompletos**
Os headers estao sem os headers extras do Supabase client (`x-supabase-client-platform`, etc.), podendo causar problemas em alguns browsers.

---

### Plano de Correção

#### 1. Edge Function `delete-user` -- corrigir ordem e completude

Reescrever a logica de deleção na ordem correta:
1. Deletar `user_roles` (remove a FK `granted_by` que bloqueia)
2. Deletar `user_progress`
3. Deletar `user_progress_nodes`
4. Deletar `answer_progress` (e `answer_progress_enamed` se existir)
5. Deletar outras tabelas dependentes (push_subscriptions, reminder_settings, calendar_subjects, etc.)
6. Deletar `public.users`
7. Deletar `auth.users`

Atualizar CORS headers para incluir os headers do Supabase client.
Reduzir logs desnecessários -- logar apenas inicio e resultado final.

#### 2. Frontend `UsersListTable` -- atualização otimista

- Apos confirmação de sucesso:
  - Remover o usuario da lista local (`setUsers(prev => prev.filter(...))`) ANTES de fazer refetch
  - Fechar o dialog imediatamente
  - Atualizar `totalCount` localmente
- Envolver o `deleteUser` em try/catch robusto para evitar crash
- Desabilitar interação durante deleção (ja existe, mas reforçar)

#### 3. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/delete-user/index.ts` | Corrigir ordem de deleção, limpar todas as tabelas dependentes, atualizar CORS |
| `src/components/admin/UsersListTable.tsx` | Atualização otimista, fechar dialog, reduzir re-renders |

### Detalhes Técnicos

**Edge Function -- nova ordem de deleção:**
```text
user_roles (WHERE user_id = X OR granted_by = X)
  -> user_progress
  -> user_progress_nodes
  -> answer_progress
  -> [outras tabelas com FK]
  -> public.users
  -> auth.users (admin.deleteUser)
```

**Frontend -- atualização otimista:**
```text
deleteUser()
  -> invoke edge function
  -> se sucesso:
     -> setUsers(prev => prev.filter(u => u.id !== deletedId))
     -> setTotalCount(prev => prev - 1)
     -> setDeleteConfirm(null)
     -> toast.success()
  -> refetch em background (silencioso, sem loading)
```

