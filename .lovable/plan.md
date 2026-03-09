

## Bug Found: Invalid Enum Value in Trigger Breaks All Student Profile Updates

### Root Cause

The `validate_user_update` trigger on the `users` table contains this line:

```sql
IF public.has_role(auth.uid(), 'coordenador') THEN RETURN NEW; END IF;
```

**`'coordenador'` is not a valid value in the `app_role` enum** (valid values: `admin`, `moderator`, `user`, `b2b_partner`, `professor`). This causes a PostgreSQL error:

```
ERROR: 22P02: invalid input value for enum app_role: "coordenador"
```

This error fires for **every non-admin, non-service-role UPDATE** to the `users` table — because admins and service_role return early before hitting this line, but all regular students reach it and crash.

### Impact

- Students cannot change their semester
- Students cannot change their name
- Only admins and service_role updates work (they bypass via early return)

### Fix

**Single SQL migration** — Replace the trigger function, removing the invalid `'coordenador'` reference:

```sql
CREATE OR REPLACE FUNCTION public.validate_user_update()
  -- Same function but remove the line:
  -- IF public.has_role(auth.uid(), 'coordenador') THEN RETURN NEW; END IF;
```

If `coordenador` role is needed in the future, it should first be added to the `app_role` enum. For now, removing the reference fixes the issue immediately.

### Secondary Issue

The trigger's admin bypass returns `NEW` **before** setting `semestre_updated_at`, so admin semester changes don't record the cooldown timestamp. This should also be fixed by moving the `semestre_updated_at` assignment before the admin bypass, or handling it separately.

### No Frontend Changes Needed

The frontend code in `EditProfileSheet.tsx` is correct. The bug is entirely in the database trigger.

