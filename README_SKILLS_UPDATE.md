# Arkaiv Skills Update v4

This update builds on v3 and changes the Skills schedule panel from a repetitive weekly-progress list into session-level monitoring with editable actual time.

## Replace these files

```txt
App.tsx
components/views/LibraryView.tsx
hooks/useBrainDumpData.ts
services/spreadsheetReconciler.ts
services/spreadsheetService.ts
types.ts
utils/exportUtils.ts
utils/selectors/skillSelectors.ts
```

## What changed

- Schedule rows now show session status instead of repeating the same progress bar:
  - Past date: `Done`, `Partial`, or `Missed`.
  - Today: `Today`, `In progress`, or `Ready to log`.
  - Future date: `Upcoming` with no progress bar.
- Schedule row size is kept compact like the current card.
- `xm session` remains in the row, with the variance placed on its right, for example `+15m bonus` or `-5m`.
- Edited actual time displays two stacked times:
  - planned time in amber/orange,
  - actual time in the default muted color.
- If actual time is not edited, the row shows only one default-color time range; actual time follows the scheduled time.
- Clicking a schedule row opens an actual-time editor.
- Skill logs now persist planned and actual metadata to the `Skill Logs` spreadsheet tab.

## New Skill Logs columns

The `Skill Logs` sheet now exports/fetches these additional columns after `ID`:

```txt
Skill_Routine_ID
Skill_Scheduled_Date
Planned_Start
Planned_End
Actual_Start
Actual_End
Actual_Time_Edited
```

The fetch range for `Skill Logs` is now `A:P`.

## Notes

- Routine completion from Focus still creates a `SKILL_LOG` record.
- If the user does not edit actual time, that log is treated as following the scheduled time.
- Weekly skill progress now uses actual duration when `Actual_Start` and `Actual_End` exist.
