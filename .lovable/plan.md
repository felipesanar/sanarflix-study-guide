

## Admin Support System: User Detail Panel + Impersonation

### Overview

Build a two-part admin support system:
1. **User Support Panel** — Read-only dashboard showing all data for a specific student (profile, progress, simulados, sessions, error notebook, activity logs)
2. **Impersonation Mode** — Admin can temporarily "become" a student to see exactly what they see, with a persistent banner to exit

### Architecture

```text
┌─────────────────────────────────────────────────┐
│  UsersListTable (existing)                      │
│  ┌─────────────────────────────────────────────┐│
│  │ Dropdown Menu per user                      ││
│  │  + "Ver Detalhes" → opens Support Panel     ││
│  │  + "Acessar como Aluno" → Impersonation     ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘

Support Panel (Sheet/Drawer):
┌─────────────────────────────────────────────────┐
│ Student: Maria Silva  |  FAME  |  Sem 5         │
│─────────────────────────────────────────────────│
│ Tabs:                                           │
│ [Perfil] [Progresso] [Simulados] [Sessões] [Log]│
│                                                 │
│ Perfil: id, email, IES, semestre, roles, dates  │
│ Progresso: study_progress + user_progress_nodes │
│ Simulados: finalizados + respostas + desempenho │
│ Sessões: user_sessions + page_views recentes    │
│ Log: analytics_events + aula_views              │
└─────────────────────────────────────────────────┘

Impersonation:
┌─────────────────────────────────────────────────┐
│ ⚠️ Você está visualizando como: Maria Silva    │
│                              [Sair] ────────────│
│─────────────────────────────────────────────────│
│  (entire app renders with student's data)       │
└─────────────────────────────────────────────────┘
```

### Part 1: User Support Panel

**New component**: `src/components/admin/UserSupportPanel.tsx`

A `Sheet` (side drawer) that opens from the users table. Uses tabs to organize:

- **Perfil**: User profile data, IES, semester, roles, `semestre_updated_at`, auth metadata
- **Progresso**: Queries `study_progress`, `user_progress_nodes`, `aula_views` for this user (using service role via edge function)
- **Simulados**: Queries `simulados_finalizados`, `answer_progress` for this user — shows scores, time, attempts
- **Sessões**: Queries `user_sessions`, `page_views` — shows login history, time spent, pages visited
- **Atividade**: Queries `analytics_events` — recent actions timeline

**New Edge Function**: `supabase/functions/admin-user-support/index.ts`

Since RLS restricts data to `auth.uid()`, the admin needs a service-role edge function to read another user's data. The function:
- Validates the caller is an admin (via JWT + `has_role` check)
- Accepts `{ userId, section }` (profile/progress/simulados/sessions/activity)
- Returns the relevant data using service-role client
- Never exposes passwords or auth tokens

Config addition:
```toml
[functions.admin-user-support]
verify_jwt = false
```

**Integration**: Add "Ver Detalhes" option to the dropdown menu in `UsersListTable.tsx`.

### Part 2: Impersonation

**How it works** (no actual auth session swap — safer approach):

1. Admin clicks "Acessar como Aluno" in the dropdown
2. `AuthContext` gains an `impersonatedUser` state + `startImpersonation(userId)` / `stopImpersonation()` methods
3. `startImpersonation` calls the edge function to load the student's full profile, then sets `impersonatedUser` as the active `user` in context, while storing the real admin user separately
4. All components that use `useAuth().user` now see the student's data (IES, semester, roles=[] )
5. Access rules resolve as the student's — admin sees exactly what the student sees
6. A persistent **ImpersonationBanner** at the top of the page shows who they're viewing as, with an "Sair" button
7. `stopImpersonation` restores the admin user

**Data access during impersonation**: RLS still uses the admin's JWT, so queries return admin-scoped data. To truly see student data, the edge function `admin-user-support` fetches data as service_role scoped to the student's `user_id`. The impersonation is a **visual/navigation simulation**, not a real session swap — this is the secure approach.

**Security**:
- Only admins can impersonate (checked both client-side and server-side)
- Cannot impersonate other admins
- All impersonation sessions are logged to `analytics_events` with `event_name: 'admin_impersonation'`
- No real auth token swap — the admin's JWT remains active
- Edge function validates admin role before returning any data

### Files to Create/Modify

1. **Create** `supabase/functions/admin-user-support/index.ts` — Service-role data fetcher
2. **Create** `src/components/admin/UserSupportPanel.tsx` — Support detail drawer
3. **Create** `src/components/admin/ImpersonationBanner.tsx` — Top banner during impersonation
4. **Modify** `src/contexts/AuthContext.tsx` — Add impersonation state/methods to context
5. **Modify** `src/types/index.ts` — Extend `AuthContextType` with impersonation
6. **Modify** `src/components/admin/UsersListTable.tsx` — Add menu items
7. **Modify** `src/components/Layout.tsx` — Render `ImpersonationBanner`
8. **Modify** `supabase/config.toml` — Add function config
9. **Migration** — Create `admin_audit_log` table for impersonation logging

### Audit Log Table

```sql
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);
```

