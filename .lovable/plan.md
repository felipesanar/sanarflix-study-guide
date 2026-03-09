

## Fix: "Password update requires reauthentication" on First Access

### Problem

The screenshot shows a student on the "Primeiro Acesso" page at `academy.sanar.com.br` seeing the error **"Password update requires reauthentication"**. 

This happens because `supabase.auth.updateUser({ password })` (line 117 of `UpdatePassword.tsx`) requires a "fresh" session. When the user clicks the invite link, `verifyOtp` establishes a session, but by the time they type their password and submit, Supabase considers the session stale and demands reauthentication — which is impossible for a first-access user who has no password yet.

### Root Cause

Supabase GoTrue v2.185+ enforces reauthentication for password changes on sessions older than a few seconds. The `verifyOtp` → user fills form → `updateUser` flow naturally takes 30+ seconds, triggering this guard.

### Fix

Replace the client-side `supabase.auth.updateUser()` call with the existing **`update-password` edge function**, which uses `supabase.auth.admin.updateUserById()` (service role) and bypasses the reauthentication requirement entirely.

### Changes

**File: `src/pages/UpdatePassword.tsx`** (lines 116-127)

Replace:
```ts
const { error: updError } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false }
});
```

With:
```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) throw new Error('Sessão expirada.');

const res = await supabase.functions.invoke('update-password', {
    body: { newPassword: password },
});
if (res.error || !res.data?.success) {
    throw new Error(res.data?.error || 'Erro ao definir senha.');
}

// Clear must_change_password flag
await supabase.auth.updateUser({ data: { must_change_password: false } });
```

This reuses the already-deployed `update-password` edge function which validates the bearer token, extracts the user ID, and calls `auth.admin.updateUserById` — no reauthentication needed.

The `updateUser({ data: ... })` call for the metadata flag does NOT require reauthentication (only password changes do), so it will succeed.

### No other changes needed

The `update-password` edge function already exists and handles validation, CORS, and error responses correctly.

