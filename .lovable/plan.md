

## Plan: Simplify Mobile Summary Header

Remove the "Continuar estudando" button from the header and reorganize the layout to reduce visual noise. The sticky CTA bar already provides these actions when the user scrolls, so having them twice is redundant.

### Changes

**File: `src/components/progress-hub/mobile/MobileSummaryHeader.tsx`**
- Remove the entire CTA buttons section (the `grid` with "Continuar estudando" + "Organizar")
- Remove `onContinue` and `onOrganize` from the props interface (and the `Play`, `Calendar` icon imports, `Button` import)
- Reduce bottom padding from `pb-5` to `pb-3` since we're removing the buttons
- Keep the title row + exam chip as-is — that's clean and useful

**File: `src/components/progress-hub/mobile/ProgressHubMobile.tsx`**
- Remove the `onContinue` and `onOrganize` props passed to `MobileSummaryHeader`
- The sticky CTA bar at the bottom already handles these actions

This removes ~20 lines of button code and simplifies the header to just: title + user info + exam chip. The "Continuar estudando" action remains accessible via the sticky bar that appears on scroll.

