

## Batch User Deletion + Delete All Users by IES

### Overview
Add batch deletion capabilities to the admin user management: select multiple users via checkboxes and delete them in bulk, plus a dedicated action to delete all users from a specific IES.

### Changes

#### 1. Edge Function — `supabase/functions/delete-user/index.ts` (edit)
- Add support for `user_ids: string[]` (array) in addition to existing `user_id: string`
- When `user_ids` is provided, loop through each ID, run the same cascade deletion logic, collect results
- Return `{ success: true, results: { deleted: string[], failed: { id, error }[] } }`
- Keep single `user_id` backwards compatible
- Add support for `ies_id: string` mode: query all users from that IES (excluding admins and caller), then delete them all
- Self-deletion prevention applies to all modes

#### 2. `supabase/config.toml` — already has `delete-user` with `verify_jwt = false` (no change needed... wait, it's not listed)
- Add `[functions.delete-user]` with `verify_jwt = false`

#### 3. `UsersListTable.tsx` (edit)
- Add checkbox column (first column) with "select all on page" header checkbox
- Track `selectedUserIds: Set<string>` state
- Add a floating action bar (or toolbar above table) that appears when `selectedUserIds.size > 0` showing:
  - "X selecionados" count
  - "Excluir selecionados" button (destructive)
  - "Limpar seleção" button
- Add "Excluir todos da IES" button next to the IES filter dropdown (only visible when a specific IES is selected)
- Both actions open an AlertDialog with strong confirmation (type IES name or count)
- On confirm, call `delete-user` edge function with `user_ids` array or `ies_id`
- Show progress toast during batch deletion
- Refresh list after completion
- Admin users are excluded from selection checkboxes (can't batch-delete admins)

#### 4. Confirmation UX
- **Batch selected**: "Tem certeza que deseja remover X usuários? Digite 'EXCLUIR' para confirmar"
- **All from IES**: "Tem certeza que deseja remover TODOS os usuários da IES [nome]? Digite o nome da IES para confirmar"
- Both require typed confirmation to prevent accidents

### Files

| File | Action |
|------|--------|
| `supabase/functions/delete-user/index.ts` | Edit — add batch + IES modes |
| `supabase/config.toml` | Edit — add delete-user entry |
| `src/components/admin/UsersListTable.tsx` | Edit — checkboxes, batch toolbar, IES delete button |

