

## Audit: Mass Email Resend Not Delivering

### Root Cause

The logs confirm the entire pipeline runs without errors:
1. `b2b-create-user` receives `resend_email: true` -- OK
2. Recovery link generated via `generateLink()` -- OK
3. `triggerNovuEvent('welcome-academy-email')` called -- OK
4. Novu Kong gateway returns `200` ("Event triggered successfully") -- OK
5. **But no emails arrive**

The problem is **Novu is a black box** here. The Kong gateway accepts the event, but Novu's internal workflow (`welcome-academy-email`) is not delivering the emails. This is an external service issue we cannot debug or fix from our side.

### Solution

Replace the Novu dependency for resends with **Supabase's built-in password reset flow** (`resetPasswordForEmail`), which triggers the managed `auth-email-hook` system. This system uses the verified domain (`academy.sanar.com.br`) and is proven to deliver emails.

The resend use case is specifically "send a user a link to set/reset their password" -- this is exactly what `resetPasswordForEmail` does.

### Changes

**1. Edge Function: `supabase/functions/b2b-create-user/index.ts`**

Add a new function `sendPasswordResetEmail` that uses the Supabase Auth API directly:

```typescript
async function sendPasswordResetEmail(supabaseAdmin, email: string): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://academy.sanar.com.br/auth/update-password' }
  });
  if (error) {
    console.error('[CreateUser] Password reset email failed:', error);
    return false;
  }
  return true;
}
```

Wait -- `generateLink` doesn't send emails. We need `resetPasswordForEmail` but that's a client-side method. For the admin API, we should use `supabaseAdmin.auth.admin.generateLink({ type: 'invite' })` which **does** trigger the auth email hook.

Actually, the correct approach: call the Supabase Auth `/recover` endpoint directly, or use `supabase.auth.resetPasswordForEmail()` from a service-role client. This triggers the email hook pipeline.

Modify the `sendWelcomeEmail` function (used when `resend_email: true`) to:
1. **Primary**: Call `supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo })` -- this triggers the managed auth-email-hook which sends the recovery email via the verified domain
2. **Fallback**: Keep Novu as a fallback if the reset call fails

For **new user creation** (not resend), keep the existing Novu welcome email flow (it has different copy/branding than a password reset).

**2. Split resend logic from create logic**

When `resend_email: true`, instead of calling `sendWelcomeEmail` (which uses Novu), call the new `sendPasswordResetEmail` which uses Supabase's native auth email system:

```typescript
if (resend_email) {
  // Use Supabase's native recovery flow — triggers auth-email-hook
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://academy.sanar.com.br/auth/update-password'
  });
  emailSent = !error;
  if (error) console.error('[CreateUser] Reset email failed:', error);
}
```

This bypasses Novu entirely for resends and uses the proven auth email pipeline.

### Files Modified
1. `supabase/functions/b2b-create-user/index.ts` -- replace Novu with `resetPasswordForEmail` for resend flow

### No Frontend Changes Needed
The frontend already works correctly. Only the email delivery mechanism in the edge function needs to change.

