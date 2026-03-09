

## Audit: Resend Email Flow and Token Consumption Fix

### Problem Identified

The resend flow for `amandarochazevedo@gmail.com` works correctly on the server side (logs confirm token generation and Novu email delivery). The issue is that when the student clicks the link, `verifyOtp` fails with "Link inválido".

**Root cause**: The `UpdatePassword` page auto-calls `verifyOtp()` on page load inside a `useEffect`. Email security scanners (Gmail Safe Browsing, Microsoft Safe Links, corporate proxies) load the page in a headless browser and **execute JavaScript**, which calls `verifyOtp()` and consumes the one-time token before the real user clicks.

**Secondary issue**: The `custom-email-templates` (invite-user.tsx, reset-password.tsx) still generate links pointing to the old vulnerable Supabase server-side verify endpoint (`supabase.co/auth/v1/verify?token=...`), which is consumed by ANY HTTP GET request from bots.

### Fix (3 files)

#### 1. `src/pages/UpdatePassword.tsx` — Defer `verifyOtp` behind user click

Instead of auto-calling `verifyOtp` on page load, show a "Validar meu acesso" button. Only call `verifyOtp` when the user clicks. Bots don't click buttons.

```
Page loads with token_hash in URL
  → Show card: "Clique para validar seu acesso" [button]
  → User clicks → verifyOtp() → success → show password form
  → If fail → show error + "Solicite um novo link"
```

The `useEffect` will only extract and store the params. The actual `verifyOtp` call moves to a button click handler.

#### 2. `supabase/functions/custom-email-templates/_templates/invite-user.tsx` — Frontend-direct link

Change line 31 from:
```
${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=...
```
To:
```
https://academy.sanar.com.br/auth/update-password?token_hash=${token_hash}&type=${email_action_type}
```

This makes the invite template consistent with the Novu flow — links go to the frontend, not to the Supabase verify endpoint.

#### 3. `supabase/functions/custom-email-templates/_templates/reset-password.tsx` — Frontend-direct link

Same change as above but for recovery emails. Change line 58 from the Supabase verify URL to:
```
https://academy.sanar.com.br/auth/update-password?token_hash=${token_hash}&type=${email_action_type}
```

#### 4. Deploy edge functions

Deploy `custom-email-templates` after template changes.

### Why this is the definitive fix

- The button-click approach is the **only** 100% reliable way to prevent bot token consumption — no scanner clicks buttons
- The template updates ensure that even if `custom-email-templates` is triggered (e.g., via Supabase's built-in auth flows), links are safe
- The Novu flow already generates correct links (confirmed by logs) — no changes needed there

### UX Impact

One extra tap for the student (click "Validar meu acesso" before seeing the password form). This is a minor trade-off for guaranteed reliability.

