

## Fix: Impersonation 403 Errors and UI Crash (Persistent)

### Root Cause 1: Stale Closure in `useAnalyticsTracker`

The `trackEvent` callback has `isImpersonating` in its closure but **NOT** in its dependency array (line 202: `[processQueue]`). When impersonation starts, `isImpersonating` changes to `true`, but `trackEvent` keeps using the stale `false` value. Every component calling `trackEvent` keeps firing events, causing the flood of 403 errors.

Same issue in `useSessionTracker`: `trackPageView` depends on `[user?.id, user?.id_ies, isImpersonating]` -- this one looks correct. But `initSession` depends on `[user?.id, user?.id_ies, isImpersonating]` and the `useEffect` that triggers it on line 154-158 only depends on `[user?.id, initSession]`, so when impersonation starts and `user?.id` changes, `initSession` runs again but `isImpersonating` is already true, so it returns early. This should be fine. But the route change effect (line 161) doesn't check `isImpersonating` before scheduling `trackPageView`. Even though `trackPageView` checks internally, the effect runs.

Actually the `trackPageView` has `isImpersonating` in dependencies, so it should work. The main issue is **`useAnalyticsTracker.trackEvent`** missing `isImpersonating` from deps.

### Root Cause 2: React Error #130 (Element type undefined)

`ProgressHeroCard.tsx` line 32: `StatusIcon` does `const Icon = icons[status]` without a fallback. If `status` is undefined, `Icon` is `undefined`, causing React error #130. The `ProgressSummaryCard` already has a fallback (`|| TrendingUp`), but `ProgressHeroCard`'s `StatusIcon` doesn't.

### Changes

**File 1: `src/hooks/useAnalyticsTracker.ts`**
- Add `isImpersonating` to `trackEvent`'s dependency array
- Also add `isImpersonating` guard to `processQueue` to prevent processing queued events during impersonation

**File 2: `src/components/progress-hub/ProgressHeroCard.tsx`**
- Add fallback in `StatusIcon`: `const Icon = icons[status] || TrendingUp`

