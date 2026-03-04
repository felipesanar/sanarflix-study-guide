

## Calendar Editor Fixes (Mobile + Desktop)

### Issues to Fix

1. **Mobile: "+" add slots between subjects cause confusion** — Move the single add slot to the end of the list only
2. **Mobile: ⋮ menu not working** — The DropdownMenu is implemented but may be blocked by the `fixed` overlay z-index; increase contrast on the trigger button
3. **Mobile: Remove icon is 3 bars (hamburger)** — Replace with `Trash2` icon from lucide
4. **Mobile: "Modo Premium" subtitle** — Remove it
5. **Mobile: Drag vs scroll conflict** — Remove drag-and-drop on mobile entirely; use tap-to-add via the drawer only, with clearer "Toque para adicionar" text
6. **Undo button doesn't work** — The undo stack is never populated; implement snapshot-based undo in `StudyGuide.tsx`
7. **Desktop: Floating bar not centered** — Already uses `left-1/2 -translate-x-1/2` but may be offset; verify and fix
8. **Desktop: Remove side arrows** — Delete the `ChevronLeft`/`ChevronRight` buttons in `CalendarEditorDesktop.tsx`

### Changes by File

#### 1. `src/components/calendar/CalendarEditorMobile.tsx`

- **Remove "Modo Premium" subtitle** (lines 149-154)
- **Replace hamburger icon with Trash2** in `MobileEventCard` (lines 368-370): use `<Trash2 className="h-4 w-4" />` instead of the SVG
- **Remove DropZone slots between cards** — Only render a single add slot after all events (not inside the `.map()` loop)
- **Improve empty state text**: Change "Toque no + ou arraste da gaveta abaixo" to "Toque no + para adicionar matérias"
- **Increase ⋮ button contrast**: Change `text-zinc-500` to `text-foreground` so it's more visible and clickable
- **Ensure DropdownMenuContent has high z-index**: Add `className="z-[99999]"` to ensure it renders above the fixed overlay

#### 2. `src/pages/StudyGuide.tsx`

- **Implement working undo**: Before each `addSubject` and `removeSubject` call, snapshot the current `calendarEvents` into `undoStack`
- **In `handleCalendarUndo`**: Pop the last snapshot and call `saveSubjects()` with it to restore previous state (using the hook's save function to sync back to DB)

#### 3. `src/components/calendar/CalendarEditorDesktop.tsx`

- **Remove side arrows** (lines 340-357): Delete the entire `variant === 'light'` block with `ChevronLeft`/`ChevronRight`
- **Verify floating bar centering**: The current CSS (`fixed bottom-6 left-1/2 -translate-x-1/2`) is correct; ensure no parent `transform` is interfering — add explicit `w-max` to the floating bar container

#### 4. `src/components/calendar/FloatingActionBar.tsx`

- Add `w-max` to the inner container to ensure proper centering with `translate-x-1/2`

