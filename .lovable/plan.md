

## Fix: Progress Not Showing in Admin Panel + Data Integrity Audit

### Problem Identified

Two distinct issues found after code analysis:

### Issue 1: Admin Support Panel misses `study_progress` data

The `admin-user-support` edge function (line 100-119) only queries the `user_progress` table for the "progress" section. However, the Study Guide saves all completions to the **`study_progress`** table via the `useStudyProgress` hook. This is why the admin panel shows "0 Aulas concluídas" even though the student has completed items.

The `get-progress-hub` function correctly merges **both** `user_progress` and `study_progress` tables — but the admin panel was never updated to do the same.

### Issue 2: Potential `ies_nome` mismatch in progress loading

The `useStudyProgress.loadAllProgress()` filters by `ies_nome` when loading. If `user.ies_nome` is empty or undefined at the time of saving vs loading, records could be invisible. The `toggleContentCompletion` uses `user?.ies_nome || ''` which could store empty strings that don't match later.

### Fix Plan

**File 1: `supabase/functions/admin-user-support/index.ts`** — Add `study_progress` query to the `progress` section

In the `progress` case (lines 99-127), add a fourth parallel query for `study_progress` filtered by `user_id` and `completed = true`. Include the count in the response and display it in the panel.

**File 2: `src/components/admin/UserSupportPanel.tsx`** — Display `study_progress` data

Update the `ProgressTab` component to show:
- Legacy progress count (`user_progress`)
- Study Guide progress count (`study_progress`)  
- Combined total
- List of recent `study_progress` entries with materia, content_id, completed_at

**File 3: `src/hooks/useStudyProgress.ts`** — Remove `ies_nome` filter from `loadAllProgress`

The `ies_nome` filter is redundant since `user_id` + `semestre` already uniquely scopes the data. Removing it prevents invisible records when `ies_nome` changes or is inconsistent. Keep `ies_nome` on write for reference, but don't filter by it on read.

### Changes Summary

1. **Edge function**: Add `study_progress` query alongside `user_progress` in the progress section
2. **Admin panel UI**: Show both progress sources clearly with combined totals
3. **Progress loading**: Remove fragile `ies_nome` filter from read queries to prevent data invisibility

