

## INTERNATO Fallback for Progress Hub (Semesters 9-12)

### Problem

The "Seu Progresso" page shows "0 de 0 aulas / 0 matérias / 0 temas" for students in semesters 9-12 because the edge function `get-progress-hub` queries `conteudos` with `semestre = '10'` (for example), but the actual content is stored under `semestre = 'INTERNATO'`. The Study Guide already handles this fallback — the Progress Hub does not.

### Root Cause

In `get-progress-hub/index.ts` (lines 108-111), the query filters strictly by `eq('semestre', String(userSemestre))`. When no rows match, it returns the empty state. There is no fallback to try `INTERNATO`.

### Fix

**Single file change**: `supabase/functions/get-progress-hub/index.ts`

After the initial `conteudos` query returns empty results for semesters 9-12, retry with `semestre = 'INTERNATO'`:

```
// Lines 96-157 — replace the semester query + empty state block

const userSemestre = userData.semestre;
const INTERNATO_FALLBACK_SEMESTERS = [9, 10, 11, 12];
const shouldTryInternato = userSemestre && INTERNATO_FALLBACK_SEMESTERS.includes(userSemestre);

// First attempt: query by user's numeric semester
let conteudosQuery = supabaseAdmin
  .from('conteudos')
  .select('id, materia, tema, subtema, aula, semestre, link_aula, link_pdf, link_quiz')
  .eq('id_ies', userData.id_ies);

if (userSemestre) {
  conteudosQuery = conteudosQuery.eq('semestre', String(userSemestre));
}

let { data: conteudos, error: conteudosError } = await conteudosQuery;

// INTERNATO FALLBACK: If semesters 9-12 returned no content, try INTERNATO
let effectiveSemestre = userSemestre;
if (!conteudosError && (!conteudos || conteudos.length === 0) && shouldTryInternato) {
  console.log(`get-progress-hub: No content for semester ${userSemestre}, falling back to INTERNATO`);
  
  const { data: internatoConteudos, error: internatoError } = await supabaseAdmin
    .from('conteudos')
    .select('id, materia, tema, subtema, aula, semestre, link_aula, link_pdf, link_quiz')
    .eq('id_ies', userData.id_ies)
    .eq('semestre', 'INTERNATO');
  
  if (!internatoError && internatoConteudos && internatoConteudos.length > 0) {
    conteudos = internatoConteudos;
    effectiveSemestre = 'INTERNATO'; // Used for composite ID generation
  }
}
```

Then replace all downstream references to `userSemestre` (used for composite ID generation, progress filtering, and response payload) with `effectiveSemestre` where the semester value determines content scope. The `user.semestre` in the response still returns the original numeric value for display purposes, but adds a field `effective_semestre` so the frontend knows which semester was actually used.

The `extractSemestreFromContentId` function also needs to handle non-numeric semester prefixes (like `INTERNATO-Materia-...`) — add a check for the `INTERNATO` prefix in composite IDs.

### Changes Summary

| File | Change |
|------|--------|
| `supabase/functions/get-progress-hub/index.ts` | Add INTERNATO fallback query for semesters 9-12; use `effectiveSemestre` for content scoping; handle `INTERNATO` prefix in composite ID extraction |

After editing, the function must be redeployed via `supabase--deploy_edge_functions`.

