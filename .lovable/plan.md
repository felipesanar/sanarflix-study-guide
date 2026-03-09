

## Fix: Single User Registration Error Handling

### Root Cause

When the `b2b-create-user` Edge Function returns a non-2xx status (e.g., 400 for validation errors), `supabase.functions.invoke` sets `data = null` and `error` is a `FunctionsHttpError` with a generic message like "Edge Function returned a non-2xx status code". The actual error details (`"Dados inválidos"`, `"semestre: ..."`) are buried in the response body inside `error.context`.

The single user flow (line 98) does:
```typescript
const msg = error?.message || data?.error || 'Erro ao criar usuário';
```
This returns the generic message instead of the specific validation error. The batch flow doesn't hit this because it pre-validates on the frontend.

### Fix Plan

**File: `src/components/admin/UsersTab.tsx`** (single user creation, lines 87-101)

1. After getting `error` from `functions.invoke`, attempt to parse the response body from `error.context` to extract the actual error message and details.
2. Use `error.context.json()` to get the structured error response with `error`, `code`, and `details` fields.
3. Display the specific error (e.g., "Dados inválidos: semestre: Semestre mínimo: 1") instead of the generic Supabase message.

**Key code change:**
```typescript
const { data, error } = await supabase.functions.invoke('b2b-create-user', { body: { ... } });

if (error || !data?.success) {
  let msg = data?.error || 'Erro ao criar usuário';
  let details = data?.details;
  
  // Extract actual error from FunctionsHttpError response body
  if (error && !data) {
    try {
      const errorBody = await (error as any).context?.json?.();
      if (errorBody?.error) msg = errorBody.error;
      if (errorBody?.details) details = errorBody.details;
    } catch { /* use fallback */ }
  }
  
  toast.error(details ? `${msg}: ${details}` : msg);
  addLog(`Erro ao criar ${singleUser.email}: ${details || msg}`);
  return;
}
```

Also apply the same fix to the batch flow error handling (lines 274-280) for consistency.

This is a frontend-only fix — no Edge Function changes needed.

