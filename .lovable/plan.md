

# Edição de Nome e Semestre — Experiência Premium com Cooldown de 60 Dias

## Resumo

Permitir que alunos editem nome livremente e semestre com restrição de 60 dias entre alterações. A edição acontece via um modal/sheet premium acessível pelo card de perfil (sidebar e mobile header). Inclui alerta de impacto antes de confirmar mudança de semestre.

## Mudanças no Banco de Dados

### 1. Nova coluna na tabela `users`

```sql
ALTER TABLE public.users
  ADD COLUMN semestre_updated_at timestamptz DEFAULT NULL;
```

Essa coluna registra quando o semestre foi alterado pela última vez. `NULL` = nunca editou (pode editar livremente a primeira vez).

### 2. Atualizar trigger `validate_user_update`

Adicionar validação server-side no trigger existente:

- Se `semestre` mudou E o caller NÃO é admin/service_role:
  - Checar `semestre_updated_at`: se `< 60 dias atrás`, rejeitar com exceção clara
  - Setar `NEW.semestre_updated_at = now()` automaticamente
- Nome: permitir livremente para o próprio usuário (já permitido)

### 3. Atualizar RLS

A policy de UPDATE existente (`auth.uid() = id`) já cobre. O trigger é a barreira de segurança real.

## Frontend

### 1. Novo componente `EditProfileSheet`

Modal/sheet premium (usa `Sheet` no mobile, `Dialog` no desktop) com:

**Seção Nome:**
- Input editável com o nome atual
- Validação: 2+ caracteres, regex `^[a-zA-ZÀ-ÿ\s\-'.]+$`
- Salva com `supabase.from('users').update({ nome }).eq('id', user.id)`

**Seção Semestre:**
- Select com semestres 1-12
- **Antes de editar**, exibir um banner permanente (amarelo/warning):
  > "Seu semestre influencia diretamente o conteúdo exibido no Guia de Estudos, Central de Progresso, Rankings e Simulados. Após alterar, você só poderá mudar novamente após 60 dias."
- Se dentro do cooldown de 60 dias: campo **desabilitado** com texto:
  > "Você poderá alterar seu semestre novamente em DD/MM/AAAA" (calculado a partir de `semestre_updated_at + 60 dias`)
- Confirmação dupla: ao clicar "Salvar semestre", abre AlertDialog:
  > "Tem certeza? Essa ação não pode ser desfeita por 60 dias. Seu conteúdo, progresso e rankings serão recalculados para o Xº período."

**Após salvar:**
- Atualizar `user` no AuthContext (via `refreshUserProfile` forçado, bypass throttle)
- Atualizar localStorage
- Toast de sucesso
- Broadcast para outras tabs via `useTabSync`

### 2. Integrar no `SidebarUserCard`

Adicionar botão "Editar perfil" no Popover existente, que abre o `EditProfileSheet`.

### 3. Integrar no `MobileHeader`

Adicionar item "Editar perfil" no DropdownMenu da conta.

### 4. AuthContext — expor `refreshUserProfile` forçado

Adicionar método `forceRefreshProfile()` que bypassa o throttle de 30s para refletir mudanças imediatas.

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| **Migration SQL** | Adicionar `semestre_updated_at` + atualizar trigger `validate_user_update` |
| **`src/components/EditProfileSheet.tsx`** | Novo — modal premium de edição |
| **`src/components/sidebar/SidebarUserCard.tsx`** | Adicionar botão "Editar perfil" |
| **`src/components/navigation/MobileHeader.tsx`** | Adicionar item "Editar perfil" |
| **`src/contexts/AuthContext.tsx`** | Expor `forceRefreshProfile` no context |
| **`src/types/index.ts`** | Adicionar `forceRefreshProfile` ao `AuthContextType` |

## Segurança

- O trigger `validate_user_update` no banco é a barreira real — mesmo que o frontend seja manipulado, o banco rejeita
- Admin e service_role podem alterar semestre a qualquer momento (bypass do cooldown)
- A validação de 60 dias é feita server-side (trigger), não apenas no frontend

