

## Holistic AI Tutor — Full Plan

### Current State
- A simple `AiRecommendationCard` exists in the "Agora" tab showing 2-3 sentence tips
- The `ai-study-recommendation` edge function sends basic progress/risk data to Gemini and returns a short string
- Simulado performance data, user exams, and streak data exist in separate tables but are NOT aggregated into the AI prompt
- The UI is a single paragraph in a small card

### What We're Building
A comprehensive AI study coach that:
1. **Aggregates all student data** (progress, simulados, exams, streak, consistency) into a `StudentSnapshot` on the backend
2. **Returns structured JSON** (headline, todayPlan, weekPlan, priorities, risks, studyMethods) instead of a plain string
3. **Shows a premium expandable UI** with sections for today's plan, weekly plan, priorities, risks, and methods
4. Uses a **Context Pack** (Brazilian med school knowledge) baked into the system prompt

### Architecture

```text
AgoraTab → AiTutorCard (new component)
  → supabase.functions.invoke('ai-study-recommendation', { body: { mode: 'full' } })
  → Edge Function aggregates StudentSnapshot from DB tables:
      - users (semester, streak)
      - conteudos + user_progress (study progress)
      - user_exams (upcoming exams)
      - answer_progress + questoes_simulado (simulado performance)
  → Sends snapshot + context pack to Lovable AI Gateway
  → Returns TutorPlanResponse JSON
  → Component renders structured plan with expandable sections
```

### Changes

#### 1. Types — `src/types/aiTutor.ts` (new)
Define `StudentSnapshot`, `TutorPlanResponse`, and sub-types:
- `headline`, `whyThisMatters`
- `todayPlan: { durationMin, steps[] }` 
- `weekPlan[]`, `priorities[]`, `risks[]`, `studyMethods[]`
- `meta: { model, latencyMs }`

#### 2. Edge Function — `supabase/functions/ai-study-recommendation/index.ts` (rewrite)
- Support two modes: `mode: 'quick'` (existing behavior) and `mode: 'full'` (new holistic)
- For `mode: 'full'`:
  - Accept only the auth token; aggregate data server-side (no client-sent snapshot)
  - Query `users` → semester, name
  - Query `conteudos` + `user_progress` → progress overview, by_materia top gaps
  - Query `user_exams` → upcoming exams with days_remaining
  - Query `answer_progress` + `questoes_simulado` → simulado scores by area/tema, top 5 weaknesses
  - Query `user_progress` recent activity → streak/consistency calculation
  - Build `StudentSnapshot` JSON
  - Include a fixed **Context Pack** string about Brazilian med education
  - Call Lovable AI Gateway with structured output via **tool calling** (function `generate_study_plan` with the `TutorPlanResponse` schema)
  - Parse tool call result, validate, return JSON
  - Handle 429/402 errors, 15s timeout, logging with `[AITutorEngine]` prefix
- For `mode: 'quick'` (or missing mode): keep existing behavior for backwards compatibility
- Cache key per user in response headers for client-side caching

#### 3. UI Component — `src/components/progress-hub/mobile/AiTutorCard.tsx` (new)
Replace `AiRecommendationCard` in `AgoraTab` with this new component:
- **States**: loading (skeleton), error (retry + last cached), success (fade-in)
- **Sections** (collapsible on mobile):
  - **Header**: Sparkles icon + "Seu Coach de Estudos" + refresh button
  - **Headline**: Bold 1-line focus + "Por que agora" subtext
  - **Plano de Hoje**: Checklist with steps (title, detail, visual checkmark) — duration badge
  - **Plano da Semana**: Compact list with day labels + focus + outcome
  - **Prioridades**: Badges with impact level (high/med/low color coding)
  - **Riscos**: Collapsible section with risk + mitigation pairs
  - **Métodos de Estudo**: Small tips section
- **Actions**: Refresh, Copy plan (clipboard)
- **Cache**: `sessionStorage` with 30min TTL (same key pattern, new format)
- **Mobile-first**: All sections work at 375px, no text walls, collapsible sections

#### 4. Integration — `src/components/progress-hub/mobile/tabs/AgoraTab.tsx`
- Replace `<AiRecommendationCard>` import with `<AiTutorCard>`
- Remove old props (overview, byMateria, riskAlerts, nextExam) since the new component fetches server-side
- Keep the component position between "O que fazer agora" and "Sua Consistência"

#### 5. Desktop integration — `src/pages/Dashboard.tsx`
- Add `AiTutorCard` to the desktop layout grid (new card in the right column)

#### 6. Config — `supabase/config.toml`
- `ai-study-recommendation` already has `verify_jwt = false` — no change needed

### Files Summary

| File | Action |
|------|--------|
| `src/types/aiTutor.ts` | New — TypeScript types |
| `supabase/functions/ai-study-recommendation/index.ts` | Rewrite — add `mode: 'full'` with server-side aggregation + tool calling |
| `src/components/progress-hub/mobile/AiTutorCard.tsx` | New — premium coach UI |
| `src/components/progress-hub/mobile/tabs/AgoraTab.tsx` | Edit — swap component |
| `src/pages/Dashboard.tsx` | Edit — add AiTutorCard to desktop layout |
| `src/components/progress-hub/mobile/AiRecommendationCard.tsx` | Keep for now (backwards compat), eventually remove |

### Key Design Decisions
- **Server-side aggregation** (not client-side) to avoid sending too much data from the client and to keep the logic centralized
- **Tool calling** for structured output instead of asking model to return raw JSON (more reliable)
- **Backwards compatible** with `mode: 'quick'` keeping the existing simple recommendation working
- **No web browsing** — Context Pack is static knowledge baked into the prompt
- **No new DB tables** — reads existing tables only

