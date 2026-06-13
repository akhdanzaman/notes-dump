# Notes Dump Fixes

This package contains the modified source files and a unified patch for the requested dashboard/routine updates.

## Changed files
- `components/views/SummaryView.tsx`
- `components/ShoppingItem.tsx`
- `hooks/useBrainDumpData.ts`

## What changed
- Removed the `System time` label from the summary date card and moved the clock below the month/year.
- Matched the main hero card height to the date card in the desktop summary layout.
- Added Goals Progress toggles for Savings/Investment and Skills, so not every goal group is shown at once.
- Filtered the Summary routine card so it only shows routines due on the same day as the date card/today.
- Kept completed shopping routine items disabled/marked done until their next scheduled due date.
- Added `Hide from Calendar` to shopping/routine item edit options and passes it through to item metadata.

## Apply
You can either copy the included files into the same paths in your project, or apply:

```bash
git apply changes.patch
```

## Verification note
A TypeScript check was attempted with `npx --no-install tsc --noEmit --pretty false`, but this extracted workspace does not include `node_modules` / local type packages, so it stopped on missing type definitions (`node`, `vite-plugin-pwa/client`) before checking project code.
