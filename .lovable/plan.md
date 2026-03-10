

## Audit: WeeklyEvolutionCard — Bugs, Data Issues, and Premium UI Plan

### Bugs Found

**Bug 1 (Critical): Weekly evolution ignores `study_progress` completions**
In `get-progress-hub/index.ts` line 522, the weekly evolution loop iterates only `progressData` (from `user_progress` table). But the system merges TWO progress sources: `user_progress` AND `study_progress`. Completions tracked via `study_progress` are invisible in the chart. This means the chart shows fewer completions than the user actually did.

**Bug 2 (Medium): Sunday week calculation is off by 1**
Line 529: `weekStart.setDate(date.getDate() - date.getDay() + 1)` — when the day is Sunday (`getDay() = 0`), this becomes `date + 1`, incorrectly assigning Sunday's completions to the NEXT Monday. Activity on a Sunday gets counted in the wrong week.

**Bug 3 (Medium): Misleading trend with insufficient data**
When there's only 1 week of data, `evolution[1]` is undefined, defaulting to 0. So any activity shows "↑ up trend" even though there's no real comparison. The screenshot shows exactly this: 3 completed in 1 week = "↑ tendência", which is meaningless.

**Bug 4 (Minor): Single data point renders as a dot, not a chart**
With only 1 data point, the AreaChart renders a tiny circle with no line or filled area. The chart looks broken/empty.

**Bug 5 (Minor): "Últimas 8 semanas" is hardcoded label**
The header always says "Últimas 8 semanas" even when there's only 1 week of data.

### UI/UX Issues

- Chart with 1 data point is ugly and uninformative
- No visual distinction between "this week" and past weeks
- Percentage mode is confusing (accumulated vs per-week semantics switch without explanation)
- Tooltip is plain and doesn't show the week range
- Stats row arrows (↑↓→) feel generic, not premium
- No animation on the data points
- No "zero weeks" padding — if the user only has 1 active week out of 8, the chart should still show the 8-week window with zeros for empty weeks

---

### Fix Plan

**File 1: `supabase/functions/get-progress-hub/index.ts` (lines 517-537)**
- Include `studyProgressData` in the weekly evolution loop alongside `progressData`, deduplicating by content_id to avoid double-counting
- Fix Sunday calculation: use `((date.getDay() + 6) % 7)` for Monday-based week start
- Pad the result to always emit 8 weeks (fill missing weeks with `completed_count: 0`), so the chart always has a full 8-point window

**File 2: `src/components/progress-hub/WeeklyEvolutionCard.tsx`**
- **Trend guard**: Show "—" (neutral) if fewer than 2 weeks have data
- **Dynamic label**: Show "Última semana" / "Últimas N semanas" based on actual data count
- **Premium tooltip**: Custom tooltip component showing week date range, count, and a small bar indicator
- **Active dot**: Add `activeDot` with a larger radius and glow effect for the most recent data point
- **Animated gradient**: Use a more vibrant gradient with emerald tones
- **Stats row redesign**: Replace plain arrows with colored pill badges (e.g., green "↑ 40%" or neutral "— sem dados")
- **Single data point handling**: When only 1 week has data, show a simplified stat display instead of the chart, with a message like "Complete mais uma semana para ver sua evolução"
- **Dot animation**: Add `animationBegin` and custom `dot` renderer for smooth entry

