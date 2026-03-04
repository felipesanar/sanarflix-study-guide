

## Fix: "Resetar Semana" and Mobile Options Button

### Problems Found

1. **"Resetar semana" does nothing**: `handleCalendarReset` in `StudyGuide.tsx` only shows a toast — never calls `clearAllSubjects()` from `useCalendarSync`.
2. **Mobile "⋮" button does nothing**: The `MoreVertical` button in `CalendarEditorMobile` has no click handler or menu attached.
3. **Mobile editor missing `onReset`**: The mobile editor interface doesn't accept an `onReset` prop, so reset can't be triggered at all on mobile.

### Changes

#### 1. `src/pages/StudyGuide.tsx`
- Destructure `clearAllSubjects` from `useCalendarSync()`
- Implement `handleCalendarReset` to actually call `clearAllSubjects()` (with confirmation dialog or toast undo pattern)
- Pass `onReset` to `CalendarEditorMobile` as well

#### 2. `src/components/calendar/CalendarEditorMobile.tsx`
- Add `onReset` to props interface
- Replace the empty `MoreVertical` button with a `DropdownMenu` containing two options:
  - **Resetar semana** — calls `onReset`
  - **Fechar editor** — calls `onClose`

#### 3. `src/components/calendar/FloatingActionBar.tsx`
No changes needed — desktop `FloatingActionBar` already wires `onReset` correctly.

### Interaction Details

- **Desktop**: "Resetar semana" in the floating bar will clear all subjects for the week via `clearAllSubjects()`
- **Mobile**: Tapping "⋮" opens a dropdown with "Resetar semana" (with a destructive/red style) and "Fechar editor"
- Reset shows a confirmation toast: "Semana resetada — todas as matérias foram removidas"

