

## Premium UI Overhaul — Caderno de Erros

### Key Insight from Analysis

The current error notebook entries store `question_id` and metadata (area, tema, reason, learning_text) but **do not store the question text (enunciado) or alternatives**. The question data lives in the `simulado_questoes` table and is only available at correction time. This means to "visualize the question" in the notebook, we need to **fetch question details on-demand** when a user expands/clicks an entry.

### Architecture Changes

**1. Tab-based layout** — Split the page into two tabs:
- **Meus Erros** (default, primary) — search, filters, grouped list of error entries with expandable question preview
- **Evolução** — dashboard, charts, AI insights (moved here, de-prioritized visually)

**2. Question preview in entries** — When an entry has a `question_id`, allow expanding it to see the actual question (enunciado + alternatives + correct answer). This requires a new fetch function in `useErrorNotebook` that loads question details from `simulado_questoes` by `question_id`.

### Files to Create/Edit

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/CadernoErros.tsx` | **Rewrite** | Tab layout (Meus Erros / Evolução), premium header, framer-motion entry animations, wider layout |
| `src/components/caderno-erros/ErrorNotebookItem.tsx` | **Rewrite** | Premium card with expandable question preview, refined badges, better typography, hover states |
| `src/components/caderno-erros/ErrorNotebookList.tsx` | **Rewrite** | Premium group headers, staggered animations, refined skeletons |
| `src/components/caderno-erros/ErrorNotebookFilters.tsx` | **Edit** | Refined filter styling, better select components, premium spacing |
| `src/components/caderno-erros/ErrorNotebookDashboard.tsx` | **Edit** | Premium chart styling, refined KPI cards with motion, better tooltips |
| `src/components/caderno-erros/ErrorNotebookEmptyState.tsx` | **Rewrite** | Premium empty states with subtle animations |
| `src/components/caderno-erros/AIInsightsCard.tsx` | **Edit** | Visual polish only |
| `src/hooks/useErrorNotebook.ts` | **Edit** | Add `fetchQuestionDetails(questionId)` function to load enunciado/alternatives |

### Detailed Plan

#### Phase 1 — Layout & Structure (`CadernoErros.tsx`)
- Replace single-page scroll with `Tabs` component: "Meus Erros" (default) and "Evolução"
- Widen container: `max-w-4xl lg:max-w-6xl`
- Premium header: larger icon with gradient bg, refined typography (tracking, weight), action buttons with `rounded-xl`, shadow on hover
- "Modo Revisão" button → `variant="outline"` with `backdrop-blur` feel, subtle border
- "Adicionar" button → primary with `rounded-xl`, icon, smooth hover scale
- Move Dashboard + AIInsights into "Evolução" tab
- Search + Filters + List stay in "Meus Erros" tab
- Wrap sections with `motion.div` for staggered fade-in entry

#### Phase 2 — Question Preview (`useErrorNotebook.ts` + `ErrorNotebookItem.tsx`)
- Add `fetchQuestionDetails(questionId: string)` to hook — queries `simulado_questoes` table for `enunciado`, `alternativa_a-d`, `correta`, `comentario`, `grau_dificuldade`, `imagem`
- In `ErrorNotebookItem`, add expandable section (Collapsible) that loads question on first expand
- Show: enunciado text, 4 alternatives with correct one highlighted (green), user's wrong answer if available (red), difficulty badge
- Loading skeleton while fetching

#### Phase 3 — Premium Item Cards (`ErrorNotebookItem.tsx`)
- `rounded-2xl` container, `border-border/50`, subtle hover shadow (`hover:shadow-md`), `transition-all duration-200`
- Left accent strip (2px colored border-left based on reason)
- Better badge system: pill-shaped, softer colors, consistent `rounded-full px-3 py-0.5`
- Learning text with `text-[15px] leading-relaxed` and left quote-style accent
- Meta info row refined with dot separators and `text-[11px]` uppercase tracking
- Actions always visible on mobile (not just group-hover)
- Expand button for question preview with `ChevronDown` icon

#### Phase 4 — Group Headers (`ErrorNotebookList.tsx`)
- Grande Área: `text-base font-bold` with subtle left accent bar (4px colored div) and count badge
- Tema: `text-sm font-medium text-muted-foreground` with dotted separator and entry count
- Staggered `motion.div` for each group

#### Phase 5 — Filters & Search
- Search input: taller (`h-12`), `rounded-xl`, subtle `bg-muted/30`, larger icon, `ring-primary/20` on focus
- Filter selects: `rounded-xl`, consistent height, refined trigger styling
- Result count as subtle `text-xs` with `font-mono` for the number

#### Phase 6 — Dashboard (`ErrorNotebookDashboard.tsx`)
- KPI cards: `rounded-2xl`, staggered motion entrance, refined icon backgrounds
- Charts: better padding, refined tooltip styling (`bg-card border rounded-xl shadow-lg`), softer grid lines
- Responsive: 2-col on mobile for KPIs, stack charts vertically

#### Phase 7 — Empty States & Loading
- Premium skeletons with shimmer animation
- Empty states: larger icon, refined copy, subtle CTA to add first entry
- Motion fade-in for state transitions

### Technical Constraints
- Query `simulado_questoes` requires the user to have access — use existing RLS
- No new dependencies needed (framer-motion already installed)
- All motion: `duration: 0.2-0.3s`, `ease: "easeOut"` 
- Mobile-first: all layouts tested at 375px
- Actions visible on mobile (no group-hover dependency)
- No changes to business logic, analytics events, or API contracts

