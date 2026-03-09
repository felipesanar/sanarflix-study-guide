

## Fix: Impersonation Mode Crashing and Not Reflecting Student Data

### Root Cause Analysis

There are **two distinct issues** causing the crash during impersonation:

#### 1. RLS 403 Errors on `analytics_events` and `page_views`
When impersonating, `useAuth()` returns the **impersonated student's** data as `user`. The analytics tracker and session tracker then try to INSERT rows with `user_id = impersonatedUser.id`. However, the RLS INSERT policies check `auth.uid() = user_id`, and `auth.uid()` is still the **admin's real JWT** — so the IDs don't match, causing 403 Forbidden.

This affects:
- `useAnalyticsTracker` — inserts into `analytics_events` with student's user_id
- `useSessionTracker` — inserts into `page_views` and `user_sessions` with student's user_id
- `usePageTimeTracking` — fires analytics events via the tracker

#### 2. TypeError: Cannot read properties of undefined (reading 'color')
In `ProgressSummaryCard` and `ProgressHeroCard`, the code does:
```typescript
const statusConfig = STATUS_CONFIG[overview.status_level];
```
If `status_level` is undefined or an unrecognized value (e.g., from impersonation data), this returns `undefined`, and accessing `.color` crashes the app. `MobileSummaryHeader` already has a fallback (`|| STATUS_CONFIG.starting`) but the other components don't.

### Fix Plan

#### File 1: `src/hooks/useAnalyticsTracker.ts`
- Add `isImpersonating` from `useAuth()`
- Early-return from `trackEvent` when impersonating — admin shouldn't generate student analytics events

#### File 2: `src/hooks/useSessionTracker.ts`
- Add `isImpersonating` from `useAuth()`
- Skip session creation, page view tracking, and session end when impersonating

#### File 3: `src/hooks/usePageTimeTracking.ts`
- Accept an optional `enabled` prop (already exists) — no change needed here since the caller can disable it, but we should also guard inside by checking impersonation. However, this hook uses `useAnalyticsTracker` which will be guarded. So the 403 errors will stop.

#### File 4: `src/components/home/ProgressSummaryCard.tsx`
- Add fallback: `STATUS_CONFIG[overview.status_level] || STATUS_CONFIG.starting`

#### File 5: `src/components/progress-hub/ProgressHeroCard.tsx`
- Add fallback: `STATUS_CONFIG[overview.status_level] || STATUS_CONFIG.starting`

### Summary of Changes

| File | Change |
|------|--------|
| `useAnalyticsTracker.ts` | Skip all tracking when `isImpersonating` |
| `useSessionTracker.ts` | Skip session/page_view inserts when `isImpersonating` |
| `ProgressSummaryCard.tsx` | Add `STATUS_CONFIG` fallback |
| `ProgressHeroCard.tsx` | Add `STATUS_CONFIG` fallback |

These changes ensure impersonation mode doesn't pollute student analytics data and doesn't crash due to missing status config.

