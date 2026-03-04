

## Progress Hub Mobile — 4 Changes

### 1. Move ConsistencyCard from Insights to Agora tab

**InsightsTab.tsx**: Remove the ConsistencyCard section (keep only DiagnosticsCard).

**AgoraTab.tsx**: Add ConsistencyCard after the actions carousel and before risk alerts. Pass `streak`, `syncing`, and `onGoalChange` as new props.

**ProgressHubMobile.tsx**: Pass `streak`, `syncing`, and `onGoalChange` to AgoraTab.

### 2. Semester Map open by default

**ProgressoTab.tsx** line 67: Change `useState(false)` to `useState(true)`.

### 3. Better CTA labels + no navbar overlap

**MobileSummaryHeader.tsx** (lines 215-231): Replace button labels:
- "Continuar" → "Continuar estudando" with subtitle hint
- "Organizar" → "Vamos organizar" 

**MobileStickyCtaBar.tsx**: Same label updates. Fix `paddingBottom` to properly account for bottom nav (~70px) so it doesn't overlap.

### 4. Replace "Hoje no seu calendário" with AI recommendation

Replace the `TodaySubjectsSection` in AgoraTab with a new `AiRecommendationCard` component that:
- Calls a new edge function `ai-study-recommendation` on mount
- Sends a compact context payload: `{ exams, progress_overview, risk_alerts, by_materia_top5 }`
- The edge function uses Lovable AI (gemini-3-flash-preview) with a system prompt in Portuguese instructing it to give a short (2-3 sentence) study recommendation based on the student's upcoming exams, simulado performance, and progress gaps
- Displays the AI response in a compact card with a sparkle/brain icon
- Shows a skeleton while loading, caches the result in sessionStorage for 30 min
- Has a "refresh" button to regenerate

**New files:**
- `supabase/functions/ai-study-recommendation/index.ts` — Edge function that receives student context, calls Lovable AI gateway, returns a short recommendation
- `src/components/progress-hub/mobile/AiRecommendationCard.tsx` — UI component

**Data flow:**
```text
AgoraTab → AiRecommendationCard
  → fetch(`/functions/v1/ai-study-recommendation`, { progress, exams, risks })
  → Edge Function → Lovable AI Gateway (gemini-3-flash-preview)
  → Short recommendation text (2-3 sentences)
  → Display in card with ✨ icon
```

The edge function system prompt will be something like:
> "Você é um tutor de medicina. Com base no progresso, provas e alertas do aluno, dê uma recomendação curta (2-3 frases) do que ele deveria estudar agora e por quê. Seja direto e motivador."

### Files to change

| File | Change |
|------|--------|
| `src/components/progress-hub/mobile/tabs/AgoraTab.tsx` | Remove TodaySubjectsSection, add ConsistencyCard + AiRecommendationCard |
| `src/components/progress-hub/mobile/tabs/InsightsTab.tsx` | Remove ConsistencyCard section |
| `src/components/progress-hub/mobile/ProgressHubMobile.tsx` | Pass streak/syncing/onGoalChange to AgoraTab |
| `src/components/progress-hub/mobile/tabs/ProgressoTab.tsx` | `mapOpen` default to `true` |
| `src/components/progress-hub/mobile/MobileSummaryHeader.tsx` | Better CTA labels |
| `src/components/progress-hub/mobile/MobileStickyCtaBar.tsx` | Better labels + fix navbar overlap |
| `src/components/progress-hub/mobile/AiRecommendationCard.tsx` | New — AI recommendation UI |
| `supabase/functions/ai-study-recommendation/index.ts` | New — Edge function calling Lovable AI |

