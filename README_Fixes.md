# Notes Dump Fixes v2

Files included:

- `components/views/SummaryView.tsx`
- `components/ShoppingItem.tsx`
- `hooks/useBrainDumpData.ts`
- `changes.patch`

## SummaryView changes

- The date card now uses the month/year above the clock for today's real calendar date.
- The `Theme` slider control now shows the active theme slider month/year inside the Theme button.
- The hero and date card are stretched to the same height on desktop.
- Goals Progress toggles (`Savings`, `Skills`) are moved into the header, directly to the left of the chart icon.
- Completed saving goals are hidden from Goals Progress. Investment goals remain visible.
- Summary Routine still only shows routines whose due date matches today's calendar date.

## Routine / shopping changes

- Done shopping routines remain locked/disabled until their next due date.
- The reset button for a locked done shopping routine is disabled until the next due date.
- Shopping item edit panel now includes `Hide from Calendar`.
- Saving an edited routine schedule recalculates the routine due date from the newly selected schedule for both routine tasks and routine shopping.
- If a done routine is rescheduled to a future due date, it remains marked done and unlocks when that next due date arrives.

## Validation note

I ran TypeScript parsing/checking with the available global `tsc`. It reaches dependency/type-definition errors because this extracted workspace does not include `node_modules` and is missing local modules/type definitions such as `@types/node`, `vite-plugin-pwa/client`, React, and other app files. No syntax errors were reported in the edited files before those dependency errors.
