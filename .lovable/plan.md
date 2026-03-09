

## Fix: "Continuar estudos" button getting clipped by long names

### Problem
The user name `h1` has `truncate` with restrictive `max-w-[240px] sm:max-w-xs md:max-w-sm lg:max-w-md` which truncates long names. Meanwhile, the flex layout uses `xl:flex-row` so on screens below `xl`, name and button stack vertically — but on `xl+`, the name's `max-w` constraints still clip it. The button also gets clipped because the card has `overflow-hidden` and the layout doesn't wrap properly.

### Fix (line 129 in `WelcomeCard.tsx`)

1. **Remove restrictive max-width on the name** — replace `truncate max-w-[240px] sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-none` with `break-words` so long names wrap naturally instead of being truncated or pushing the button off-screen.

2. **Ensure the button never gets clipped** — the button container already has `flex-shrink-0 min-w-fit`, which is correct. The issue is the name forcing the row too wide. With `break-words` the name will wrap within its `flex-1` container.

### Change
**File: `src/components/home/WelcomeCard.tsx`**, line 129:
```
// Before:
className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight truncate max-w-[240px] sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-none"

// After:
className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight break-words"
```

This lets long names wrap to a second line naturally while the button remains fully visible and never clipped.

