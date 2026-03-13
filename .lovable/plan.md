

## Plan: Add Semester Filter to Mass Deletion

Two changes needed: the edge function must accept an optional `semestre` parameter in `resolve_only` mode, and the frontend needs a semester filter dropdown + updated delete button/dialog.

### 1. Edge Function: `supabase/functions/delete-user/index.ts`

**`fetchIesUserIdsPage`** — add optional `semestre` parameter:
```typescript
async function fetchIesUserIdsPage(supabaseAdmin, iesId, cursor, pageSize, semestre?)
```
When `semestre` is provided, add `.eq('semestre', semestre)` to the query.

**`resolve_only` handler** — pass `body.semestre` to `fetchIesUserIdsPage`.

### 2. Frontend: `src/components/admin/UsersListTable.tsx`

- **New state**: `filterSemestre` (`string`, default `'all'`). Add to `useEffect` that resets page/selection.
- **Fetch query**: When `filterSemestre !== 'all'`, add `.eq('semestre', parseInt(filterSemestre))`.
- **Filters row**: Add a semester `Select` dropdown (values 1-12 + "Todos") next to the IES filter. Only show when `filterIes !== 'all'`.
- **Delete button**: Change from "Excluir todos da IES" to also show semester when filtered. E.g., "Excluir todos do 7º sem. da IES". Show the button when IES is selected (semester optional).
- **`handleIesDelete`**: Pass `semestre` in the `resolve_only` call body:
  ```typescript
  body: { ies_id: filterIes, resolve_only: true, cursor, page_size: 500, semestre: filterSemestre !== 'all' ? parseInt(filterSemestre) : undefined }
  ```
- **IES Delete dialog**: Update confirmation text to include semester when filtered. E.g., "Todos os usuários do **7º semestre** da IES **Claretiano**".

### Files Modified
1. `supabase/functions/delete-user/index.ts` — add `semestre` param to resolve
2. `src/components/admin/UsersListTable.tsx` — semester filter + updated delete flow

