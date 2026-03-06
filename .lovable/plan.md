

# Fix CORS + Service Worker Cache Errors

## Problems Identified

1. **CORS on `b2b-create-user`**: The `Access-Control-Allow-Headers` on line 8 is incomplete. It's missing headers that the Supabase JS client sends automatically (`x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`). The browser blocks the request because the preflight response doesn't allow these headers.

2. **Service Worker cache error**: `sw.js` line 114 tries to `cache.put()` on responses with status 206 (partial content), which the Cache API doesn't support. Need to add a status check before caching.

## Changes

### 1. `supabase/functions/b2b-create-user/index.ts` (line 6-9)
Update `corsHeaders` to include all required Supabase client headers:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

### 2. `public/sw.js` — all three cache strategy functions
Add a check `response.status !== 206` before calling `cache.put()` in:
- `cacheFirst` (around line 93)
- `staleWhileRevalidate` (around line 113)
- `networkFirst` (around line 131)

Change condition from `response.ok` to `response.ok && response.status !== 206`.

