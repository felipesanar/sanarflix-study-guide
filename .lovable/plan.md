

## Plan: Mass Email Resend by IES + Semester

### Approach
Reuse the existing `b2b-create-user` edge function (which already supports `resend_email: true`) and add a new chunked batch flow in `UsersListTable.tsx`, mirroring the mass deletion pattern.

No edge function changes needed -- the existing `b2b-create-user` with `resend_email: true` already handles individual resends. We just need to orchestrate batch calls from the frontend.

### Changes: `src/components/admin/UsersListTable.tsx`

**1. New state for batch email progress:**
- `emailProgress` (same shape as `BatchProgress` but tracking sent/failed instead of deleted/failed)
- `iesResendOpen` dialog state
- `emailConfirmText` for confirmation

**2. New function `executeChunkedResend(users: {id, nome, email, id_ies, semestre}[])`:**
- Same chunked pattern as `executeChunkedDelete` (chunks of 3, cancel support, progress bar)
- For each user in chunk, call `supabase.functions.invoke('b2b-create-user', { body: { nome, email, id_ies, semestre, resend_email: true } })`
- Track sent/failed counts

**3. New function `handleIesResend()`:**
- Resolve users from local query (not edge function) -- fetch all users from selected IES+semester using paginated Supabase queries
- Then call `executeChunkedResend` with the resolved users

**4. UI additions:**
- Add a "Reenviar emails" button next to the "Excluir todos da IES" button (only visible when IES is filtered), with Mail icon
- Button label adapts: "Reenviar emails" or "Reenviar {X}º sem."
- Add email progress overlay (similar to delete progress but with different wording/colors)
- Add confirmation dialog similar to IES delete dialog but for resending

**5. Batch selection resend:**
- Add a "Reenviar emails" button in the batch action bar (next to "Excluir selecionados")

### UI Layout (filters row)
```text
[Search] [IES filter] [Semester filter] [Reenviar emails] [Excluir IES] [Refresh]
```

### Confirmation Dialog
- Title: "Reenviar emails para X usuários da IES Y" (or with semester)
- No destructive styling -- use default/primary variant
- Require typing IES name to confirm (same as delete)

