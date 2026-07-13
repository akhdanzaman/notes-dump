# Receipt and Transaction Line Items

## Flow

- Receipt/invoice images are attached from the global chat/input bar.
- The text typed beside the image is sent as trusted context for wallet, date, and other corrections.
- Submitting an image extracts one parent expense transaction with multiple line items.
- The Add Expense modal remains for manual transaction entry and no longer contains the receipt scanner.

## Transaction amount

- When a transaction has line items, its parent amount is always the sum of the sanitized line-item amounts.
- The amount is recalculated during receipt extraction, manual creation, spreadsheet reconciliation, item updates, and card display.
- The amount field is read-only whenever transaction line items exist.

## Budget categories

- Every transaction line item can store its own `budgetCategory`.
- A receipt may therefore stay as one transaction while its spending is allocated across multiple budget categories.
- The parent category is only used as a fallback for line items without their own category.

## Transaction cards

- Transaction cards show a line-item count and preview rows similar to shopping cards.
- Line items remain visible in both collapsed and expanded card states.
- The displayed transaction total comes from the line-item sum, not a separately editable parent value.
