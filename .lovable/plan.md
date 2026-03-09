

## Audit: Impersonation Not Working Correctly

### Problems Found

**1. Dashboard hidden in sidebar for non-admin users (BUG)**
In `AppSidebar.tsx` line 160-163, the "Seu progresso" (dashboard) menu item uses `isAdmin(user)` instead of `accessRules.dashboard`. During impersonation, `user` is the student, so `isAdmin()` returns false and the dashboard is hidden — even though Fame has Dashboard enabled in IES features.

**2. Simulados not filtered by student's IES**
`simuladosApi.listarSimulados()` queries `simulados_admin` without filtering by `ies_ids`. It relies on RLS, but during impersonation `auth.uid()` is still the admin (who has global access), so ALL simulados from all institutions appear instead of only those assigned to the student's IES.

**3. Progress Hub uses admin's JWT**
`useProgressHub` calls the `get-progress-hub` edge function which uses the JWT token to identify the user. During impersonation, the JWT belongs to the admin, so it returns admin's progress data, not the student's.

### Fix Plan

**File 1: `src/components/AppSidebar.tsx`** — Fix dashboard visibility
- Line 160-163: Change `return isAdmin(user)` to `return accessRules[item.accessKey]` so Dashboard shows for any user whose IES has it enabled.

**File 2: `src/services/simuladosApi.ts`** — Add IES filtering
- Accept optional `userIesId` parameter in `listarSimulados()`
- After fetching simulados, filter by `ies_ids.includes(userIesId)` when the parameter is provided
- This ensures students (and impersonated views) only see their IES's simulados

**File 3: `src/components/simulados/SimuladosDisponiveis.tsx`** — Pass user IES to API
- Pass `user.id_ies` to `simuladosApi.listarSimulados(user.id_ies)` so the filtering works for both regular students and impersonation

**File 4: `src/hooks/useProgressHub.ts`** — Support impersonation in progress data
- When `isImpersonating` is true, call `admin-user-support` edge function with section `progress` instead of `get-progress-hub`
- This uses the service role to fetch the student's actual data rather than the admin's JWT-scoped data

**File 5: `src/contexts/AuthContext.tsx`** — Expose `realAdminUser` for impersonation checks
- Add `realAdminUser` to the context so hooks can detect impersonation and access the admin's identity when needed for edge function calls

**File 6: `src/types/index.ts`** — Add `realAdminUser` to AuthContextType

### Summary
Three distinct bugs: sidebar hiding dashboard for students, simulados showing all IES data, and progress using admin's JWT. All stem from the impersonation being a visual-only swap without adjusting data queries.

