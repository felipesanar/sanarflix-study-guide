

## Plan: Compact Exam Card Next to "Seu Progresso" Title (Mobile)

### Current State
The `MobileSummaryHeader` has:
- **Line 83-93**: Title row with "Seu Progresso" + user name on the left, sync spinner on the right
- **Line 142-211**: Full-width exam indicator card below the metrics grid

The title row has empty space on the right side (visible in the screenshot).

### Change
Move the next exam info into the title row as a compact pill/chip on the right side, replacing the current full-width exam card below the metrics.

**File: `src/components/progress-hub/mobile/MobileSummaryHeader.tsx`**

1. **Restructure the title row** (lines 83-93): Place a compact exam chip on the right side next to the title, showing:
   - Exam subject name (truncated)
   - Days remaining with status color
   - Status dot indicator
   - Clickable → triggers `onExamClick`

2. **Remove the full-width exam card** (lines 142-211): Delete the large exam indicator block since its info is now in the compact header chip.

3. **Compact exam chip design**:
   - Small rounded card (`rounded-xl`, `px-3 py-2`)
   - Status-colored left border or background tint
   - Subject name truncated + days remaining
   - GraduationCap icon, compact layout
   - Pulse animation for critical status preserved
   - Tappable with `whileTap` feedback

```text
┌──────────────────────────────────────────┐
│ Seu Progresso          ┌───────────────┐ │
│ Fame • 4º período      │ 🎓 Geral  3d │ │
│                        └───────────────┘ │
│ ┌─────────┐  ┌─────────────┐            │
│ │ 1%      │  │ 🔥 1/3 dias │            │
│ └─────────┘  └─────────────┘            │
│ [Continuar estudando]  [Organizar]       │
└──────────────────────────────────────────┘
```

### Implementation Details
- The compact chip uses `getExamStatusStyle` for consistent coloring
- On tap, navigates to the Provas tab (same `onExamClick` behavior)
- If no exam exists, the right side shows just the sync spinner (current behavior)
- Truncate subject name with `max-w-[120px] truncate`

