

# Plan: Fix Simulado Re-Release Flow - Complete Solution

## Problem Summary

After an admin releases a simulado for a student to retake (sets `liberado_novamente = true`), and the student completes the new attempt:

1. **Bug 1**: The simulado still shows as "available" instead of "concluido" (blocked)
2. **Bug 2**: The old finalization record still has `liberado_novamente = true` instead of being replaced with a new clean record
3. **Bug 3**: Only one record appears in the "Liberacoes" tab, and it's the old one with `liberado_novamente = true`
4. **Bug 4**: Performance data still shows the old attempt's results (previously addressed but incomplete)

## Root Cause Analysis

The edge function `corrigir-simulado` has a flawed logic flow:

1. **Condition Flaw**: The cleanup code (delete old answers + finalization) only runs when `existingAnswers.length > 0` (lines 88-130). If answers were deleted but finalization record wasn't, the cleanup block is skipped.

2. **Insert Failure**: After cleanup, a new insert attempts to create a finalization record. But if the old record wasn't deleted (due to the condition flaw), the insert fails with `23505` (unique constraint violation) and is silently ignored.

3. **Status Check**: The frontend checks `simulados_finalizados` for `liberado_novamente = false` to determine if blocked. Since the old record still has `liberado_novamente = true`, the simulado appears available.

## Solution

### Part 1: Fix Edge Function `corrigir-simulado/index.ts`

Restructure the logic to:
1. Always check for existing finalization record first
2. Handle the re-release cleanup **independently** of whether answers exist
3. Ensure the new finalization record is created correctly

**Key Changes:**
- Move finalization record check before answer check
- Add explicit cleanup for finalization record when `liberado_novamente = true`
- Ensure new record is created with `liberado_novamente = false` explicitly

```
// New logic flow:
1. Check for existing finalization record (with liberado_novamente status)
2. Check for existing answers

3. If finalization exists and liberado_novamente = true:
   - Delete old finalization record
   - Delete old answers (if any exist)
   - Continue to process new attempt

4. Else if finalization exists and liberado_novamente = false:
   - If answers exist: return idempotency response
   - If no answers: something is wrong, but proceed anyway

5. Process new answers and create new finalization record
```

### Part 2: Fix Frontend Status Check in `SimuladosDisponiveis.tsx`

The current logic correctly checks `liberado_novamente` status, but there's no issue here once the backend is fixed. The frontend will work correctly once the edge function creates proper records.

### Part 3: Fix Liberacoes Tab Display

Currently, the tab shows the old record with `liberado_novamente = true`. After the fix, when the student completes the second attempt:
- Old record is deleted
- New record is created with `liberado_novamente = false`
- The new attempt appears as a fresh finalization

### Technical Implementation Details

**Edge Function Changes (`supabase/functions/corrigir-simulado/index.ts`):**

```typescript
// Step 1: Check for existing finalization
const { data: finalizacaoExistente } = await supabaseAdmin
  .from('simulados_finalizados')
  .select('id, liberado_novamente')
  .eq('user_id', user_id)
  .eq('simulado_id', simulado_id)
  .maybeSingle();

// Step 2: Handle re-release scenario FIRST (before checking answers)
if (finalizacaoExistente && finalizacaoExistente.liberado_novamente) {
  // User was re-released, clean up everything
  await supabaseAdmin.from('answer_progress')
    .delete()
    .eq('user_id', user_id)
    .eq('simulado', simulado_id);

  await supabaseAdmin.from('simulados_finalizados')
    .delete()
    .eq('id', finalizacaoExistente.id);
  
  // Proceed to process new attempt
}

// Step 3: Handle duplicate submission (not re-released)
else if (finalizacaoExistente && !finalizacaoExistente.liberado_novamente) {
  return Response with "already processed"
}

// Step 4: Process answers and create new finalization record
// (existing code, but ensure liberado_novamente is explicitly false)
```

**New Finalization Insert (explicit fields):**
```typescript
const { error: finalizadoError } = await supabaseAdmin
  .from('simulados_finalizados')
  .insert({
    user_id: user_id,
    simulado_id: simulado_id,
    tempo_total_segundos: tempo_total_segundos,
    saidas_de_aba: saidas_de_aba,
    saidas_de_fullscreen: saidas_de_fullscreen ?? 0,
    finalizado_em: finalizadoEmTimestamp,
    liberado_novamente: false,  // Explicitly set
    liberado_em: null,
    liberado_por: null
  });
```

## Files to Modify

1. `supabase/functions/corrigir-simulado/index.ts` - Restructure cleanup and insert logic

## Testing Checklist

After implementation:
1. Admin releases simulado for a user
2. User completes the new attempt
3. Verify:
   - Simulado shows as "concluido" (not "disponivel")
   - New finalization record exists with `liberado_novamente = false`
   - Liberacoes tab shows the new attempt (not the old one)
   - Performance page shows data from the new attempt only
   - User cannot access the simulado again

