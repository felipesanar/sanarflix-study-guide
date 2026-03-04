

## Add Sheet Selection (Enable/Disable) for XLSX Import

### Problem
When uploading an XLSX with multiple sheets/IES, all sheets must be mapped to proceed. There's no way to skip/exclude specific sheets from the import.

### Solution
Add a checkbox to each `SheetMappingCard` that controls whether that sheet is included in the import. Unchecked sheets are excluded from validation and import.

### Changes

#### 1. `SheetMappingCard.tsx` — Add enabled/disabled toggle
- Add new props: `enabled: boolean` and `onToggleEnabled: (sheetName: string) => void`
- Add a `Checkbox` to the left of the sheet icon
- When unchecked, dim the entire card and disable the IES selector
- Visual: `opacity-50` + muted styling when disabled

#### 2. `StudyGuideImportWizard.tsx` — Track excluded sheets
- Add state: `excludedSheets: Set<string>` (starts empty — all included by default)
- Pass `enabled` and `onToggleEnabled` to each `SheetMappingCard`
- **`canProceed` for configure step**: Only require mappings for *enabled* sheets (filter out excluded)
- **`runValidation`**: Skip excluded sheets (don't generate `UNMAPPED_SHEET` errors for them)
- **`runImport`**: Only send rows from enabled sheets
- **`duplicateIesIds`**: Only consider enabled sheets

#### 3. Interaction Details
- Checkbox is only shown for XLSX (CSV always has 1 sheet)
- Unchecking a sheet removes its mapping from `sheetMappings` (or just ignores it in logic)
- At least 1 sheet must remain enabled to proceed (disable "Continuar" otherwise)

