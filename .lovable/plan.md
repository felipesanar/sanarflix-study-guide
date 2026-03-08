

## Fix Dark Mode Contrast for Question Alternatives

### Problem
In dark mode, the correct (green) and wrong (red) alternative cards have extremely poor contrast:
- Background opacity is too low (`dark:bg-green-500/8`, `dark:bg-red-500/8`) — nearly invisible
- Border colors are too faint (`dark:border-green-500/25`, `dark:border-red-500/20`)
- The result is alternatives that look washed out and unreadable in dark mode (as shown in the screenshot)

### Affected Files

| File | What to fix |
|------|-------------|
| `src/pages/SimuladoCorrecao.tsx` | `AlternativeCard` component (lines 139-173) |
| `src/pages/SimuladoDesempenho.tsx` | Question modal alternatives (lines 201-226) |
| `src/components/caderno-erros/ErrorNotebookItem.tsx` | Question details alternatives (lines 289-304) |

### Changes

All three locations get the same fix — increase dark mode opacity for backgrounds, borders, and ensure text remains legible:

**Correct answer (green):**
- `dark:bg-green-500/8` → `dark:bg-green-950/60`
- `dark:border-green-500/25` → `dark:border-green-500/40`
- Text: keep `dark:text-green-100`
- Letter badge: `dark:bg-green-500/20` with `dark:text-green-300`

**Wrong answer (red):**
- `dark:bg-red-500/8` → `dark:bg-red-950/60`
- `dark:border-red-500/25` → `dark:border-red-500/40`
- Text: keep `dark:text-red-100`
- Letter badge: `dark:bg-red-500/20` with `dark:text-red-300`

**Caderno de Erros (emerald correct):**
- `dark:text-emerald-300` stays
- Background: bump to `dark:bg-emerald-950/50`
- Border: bump to `dark:border-emerald-500/30`

This uses the `950` shade (very dark tint) which provides a rich, visible background in dark mode without being garish — consistent with premium dark UI patterns (Linear, Vercel style).

