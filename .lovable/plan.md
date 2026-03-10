

## Analysis: Simulados Page Ignoring IES Feature Settings

### Problem

The "Simulados" feature is **hardcoded to always show** in three places, completely ignoring the `ies_features` database configuration:

1. **`useAccessRules.ts` (line 45)**: `simulados: baseRules.simulados` — always uses base rules instead of `hasFeature('simulados')`. Base rules have `simulados: true` by default.

2. **`DynamicRoutes.tsx` (line 132-145)**: Comment says "Sempre disponível para usuários autenticados" — no `accessRules.simulados` check, route is always rendered.

3. **`AppSidebar.tsx` (line 170)**: `if (item.accessKey === "simulados") return true;` — hardcoded to always show.

4. **`MobileBottomNav.tsx` (line 94)**: `show: true` for simulados — hardcoded.
   Also line 127: `show: true` in the menu section.

### Other Pages Affected?

- **`SimuladoDesempenho`** — also has a separate issue: the `Simulados.tsx` page embeds `SimuladoDesempenho` as a tab, bypassing the `SimuladoDesempenho` access rule check. Even if `SimuladoDesempenho` feature is disabled for the IES, it shows inside the Simulados page tabs.

- **`errorNotebook`** and **`analytics`** — sidebar uses `isAdmin(user)` check instead of `accessRules[item.accessKey]`, so even if these features are enabled for an IES, non-admin users can't see them. This may be intentional but is inconsistent with `ies_features`.

### Fix Plan

**File 1: `src/hooks/useAccessRules.ts`**
- Change line 45 from `simulados: baseRules.simulados` to `simulados: hasFeature('simulados')` for B2B students, respecting the IES setting.

**File 2: `src/components/DynamicRoutes.tsx`**
- Wrap the `/simulados` route in the same `accessRules.simulados` conditional pattern used by other routes. If disabled, redirect to `/home` or first available route.

**File 3: `src/components/AppSidebar.tsx`**
- Change line 170 from `return true` to `return accessRules.simulados` so it respects the IES feature toggle.

**File 4: `src/components/navigation/MobileBottomNav.tsx`**
- Line 94: Change `show: true` to `show: accessRules.simulados`.
- Line 127: Change `show: true` to `show: accessRules.simulados`.

**File 5: `src/components/DynamicRoutes.tsx` (default route)**
- Update `getDefaultRoute()` to not assume `/simulados` is always available. Fallback logic: home → simulados → first available route.

**File 6: `src/pages/Simulados.tsx`**
- The "Desempenho" tab inside Simulados should check `accessRules.SimuladoDesempenho` before rendering.

### Impact

After these changes, the admin IES Features panel toggle for "Simulados" will actually control visibility for students of that IES, matching the behavior of Home, Guia de Estudos, Dashboard, etc.

