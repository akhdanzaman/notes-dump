# Arkaiv Savings UI Update v1

Replace the files in this package into the same paths in your project.

## Files changed

- `components/views/PlanView.tsx`
- `components/AddShoppingModal.tsx`
- `hooks/useBrainDumpData.ts`
- `services/spreadsheetReconciler.ts`
- `services/spreadsheetService.ts`
- `utils/exportUtils.ts`
- `types.ts`

## What changed

- Redesigned Plan > Savings to match the mockup structure:
  - Saving Goals and Investments in the main column.
  - Goal Milestones in the right column.
  - No quick tips card and no lightbulb card.
- Saving goal cards no longer expand when clicked.
- Saving goal editing now opens a modal through the edit button, matching the Skills subtab behavior.
- Saving goal modal now supports a thumbnail image URL.
- Saving goal thumbnails are displayed above the saving information.
- Saving goal thumbnail padding is consistent, with edit and plus actions aligned together in the thumbnail area.
- Investment cards now use a left thumbnail on desktop/tablet and a top thumbnail on mobile.
- Investment add/edit actions now use modal controls instead of inline expansion.
- Investment modal also supports a thumbnail image URL.
- Saving/Investment image URLs are saved and fetched through the `Saving Goals & Investments` spreadsheet sheet using the new `Image_URL` column.
- Spreadsheet fetch range for `Saving Goals & Investments` is expanded from `A:R` to `A:S`.

## Validation

Ran successfully:

```bash
npm run lint
npm run build
```

Build completed with only the existing Vite chunk-size warning.
