

# Fix: b2b-create-user 401 "Auth session missing"

## Root Cause

`getClaims(token)` internally calls `getUser()`, which expects a persistent session. In Edge Functions there is no session, so it fails with "Auth session missing!". This happens on the anon-key client (`supabaseUser`).

## Solution

Use the **admin/service-role client** (`supabaseAdmin`) to call `auth.getUser(token)`. The service role client can verify any JWT token directly without needing a session.

## Changes

### File: `supabase/functions/b2b-create-user/index.ts`

Replace lines 155-170:

```typescript
// Remove the anon client entirely - not needed
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

// Verify caller using admin client's getUser (service role can validate any token)
const { data: { user: callerUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
if (authErr || !callerUser) {
  console.error('[Auth] Failed to verify token:', authErr);
  return new Response(
    JSON.stringify({ success: false, error: "Nao autorizado", code: "UNAUTHORIZED" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const callerUserId = callerUser.id;
```

### Same fix needed in: `get-study-contents` and `get-progress-hub`

These functions also use `getClaims()` (changed in the last edit) and will have the same issue. They should also switch to `supabaseAdmin.auth.getUser(token)`.

### Redeploy

All three functions: `b2b-create-user`, `get-study-contents`, `get-progress-hub`.

