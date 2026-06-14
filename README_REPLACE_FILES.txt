# Fixed tasks routine subtasks files

Replace the matching files in your project with the files in this zip, keeping the same folder paths.

## What changed in this version

- Fixes the subtasks panel so it no longer stays stuck in edit mode after saving steps.
- Splits subtasks into two separate panels:
  - `Subtasks` shows the actual TODO child cards.
  - `Edit subtasks` shows the editable step textarea list.
- Updates button states:
  - When there are no subtask cards: `Show edit` + `Add subtasks`.
  - When subtask cards already exist: `Show edit` + `Subtasks` + `Edit subtasks` + `Remove subtasks`.
- After pressing `Save as todo subtasks`, `Update subtasks`, or `Use these steps`, the temporary draft is cleared and the UI switches to the TODO card view.
- Keeps the previous fixes for:
  - skill routine subtasks generation,
  - skills metadata merge (`description`, `imageUrl`, `schedule`),
  - savings/theme image URL parsing.

## Files included

- `components/views/PlanView.tsx`
- `components/views/SummaryView.tsx`
- `hooks/useDeepWork.ts`
- `services/deepWorkTransformer.ts`
- `services/spreadsheetReconciler.ts`
- `services/spreadsheetService.ts`
- `services/__tests__/deepWorkTransformer.test.ts`
- `utils/deepWorkTodoModel.ts`
- `utils/mergeUtils.ts`
- `utils/__tests__/deepWorkTodoModel.test.ts`
- `utils/__tests__/mergeUtils.test.ts`

## After replacing

Run:

```bash
npm install
npm test
npm run build
```

Then redeploy the app.
