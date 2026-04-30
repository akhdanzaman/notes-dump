# Tab 02 — Money Wireframe

Reference anchor:
- https://dribbble.com/shots/25580105-Minimalist-Finance-Dashboard-UI

## Purpose
Make Money feel like a calm personal finance screen, not a multi-panel dashboard.

The user should be able to:
- understand current month health at a glance
- scan transactions quickly
- jump into wallets or budget only when needed
- add a transaction without fighting the UI

## Current issues to remove
- hero currently mixes too many stats at the same level
- month selector, expense card, assets/debt/savings strip, and tab switch all compete
- wallets / transactions / budget are structurally equal, but real usage is not equal
- repeated financial context appears in too many places
- budget screen is information-rich but visually heavy

## Design direction from the reference
Borrow these qualities from the Dribbble finance reference:
- one strong balance hero
- simple top summary with lots of breathing room
- clean transaction list under the hero
- secondary metrics are supportive, not dominant
- accent colors used sparingly for meaning

## Core UX decision
**Transactions becomes the default primary mode.**

Why:
- most users revisit Money to check what happened this month
- wallets are structural data
- budget is analytical data
- transactions are daily reality

So the tab order should become conceptually:
1. Transactions (default)
2. Wallets
3. Budget

If code-level order stays the same for now, visual emphasis should still favor Transactions.

## Screen hierarchy
1. Hero
2. Context switch (Transactions / Wallets / Budget)
3. Context-specific content
4. Secondary actions only when needed

## Shared hero block
The hero stays consistent across all Money subviews.

### Hero content
- primary line: current month label
- hero metric: net worth or total balance
- support row: income vs expense for current period
- primary CTA: "+ Add transaction"
- secondary utility: hide/show balance

### What not to include in the hero
- assets, debt, savings all at equal visual weight
- budget category count
- wallet count
- too many colored chips
- repeated summaries already visible below

## Mobile wireframe

### A. Transactions (default)
```text
┌──────────────────────────────────────┐
│ April 2026                    👁  +  │
│ Rp 12.450.000                       │  <- hero balance / net worth
│ Income Rp 8.2jt • Expense Rp 4.7jt  │
├──────────────────────────────────────┤
│ [Transactions] [Wallets] [Budget]   │
├──────────────────────────────────────┤
│ [All] [Expense] [Income] [Saving]   │  <- compact quick filters
│ [wallet: BCA] [tag: ops]      Clear │  <- only if active
├──────────────────────────────────────┤
│ Today / This month list              │
│                                      │
│ Grab Food                 -42.000    │
│ Food • BCA • 30 Apr                  │
│ ───────────────────────────────────  │
│ Salary                  +8.000.000   │
│ Income • BCA • 29 Apr                │
│ ───────────────────────────────────  │
│ Transfer Savings         -500.000    │
│ Saving • Jago • 28 Apr               │
└──────────────────────────────────────┘
```

### B. Wallets
```text
┌──────────────────────────────────────┐
│ April 2026                    👁  +  │
│ Rp 12.450.000                       │
│ Income Rp 8.2jt • Expense Rp 4.7jt  │
├──────────────────────────────────────┤
│ [Transactions] [Wallets] [Budget]   │
├──────────────────────────────────────┤
│ Wallets: 5 • 1 debt account          │
│                                      │
│ BCA                            5.2jt │
│ Bank account                           
│ ───────────────────────────────────  │
│ Cash                           350rb │
│ Manual wallet                            
│ ───────────────────────────────────  │
│ Mandiri CC                     1.8jt │
│ Debt account                            
│                                      │
│ + Add wallet                           │
└──────────────────────────────────────┘
```

### C. Budget
```text
┌──────────────────────────────────────┐
│ April 2026                    👁  +  │
│ Rp 12.450.000                       │
│ Income Rp 8.2jt • Expense Rp 4.7jt  │
├──────────────────────────────────────┤
│ [Transactions] [Wallets] [Budget]   │
├──────────────────────────────────────┤
│ Budget used: 58%                     │
│ Rp 4.7jt / Rp 8jt planned            │
├──────────────────────────────────────┤
│ Needs                         72%    │
│ Rp 2.9jt / Rp 4jt                    │
│ ───────── progress line ───────────  │
│ Wants                         41%    │
│ Rp 1.2jt / Rp 3jt                    │
│ ───────── progress line ───────────  │
│ Savings                       66%    │
│ Rp 600rb / Rp 900rb                  │
└──────────────────────────────────────┘
```

## Subview-specific UX rules

### Transactions
This is the main screen.

Rules:
- Use a **simple chronological list**.
- Each row shows only:
  - title
  - signed amount
  - one metadata line
- Keep filters compact and horizontal.
- Do not show multiple analytics blocks above the list.
- Search/filter chips appear only if active.

Metadata line priority:
1. category or finance type
2. wallet
3. date

### Wallets
Rules:
- Wallets should feel like account rows, not cards with many badges.
- Balance is the main right-aligned number.
- Type label stays muted.
- Edit/delete should be hidden behind row action or subtle icon button.
- Savings tied to a wallet should not become a second big stat block.

### Budget
Rules:
- One summary line only at top: used vs planned.
- Then category rows with progress bars.
- Avoid repeating total income in several places.
- Monthly/yearly toggle can stay, but it should be quiet.
- Uncategorized should appear only if it exists.

## Interaction model
- Swiping between money subviews can remain, but tap navigation must be clearer than swipe.
- Month switching should live in the hero header, not in a separate large card.
- Add transaction button should always be available in the hero.
- Opening a transaction should go to detail/edit, not a bigger card expansion war.

## Content priorities
### Must surface
- current period
- total/net worth
- income vs expense
- transaction list

### Secondary only
- assets/debt breakdown
- wallet type chips
- savings totals
- budget category analytics

## What to remove from current UI
- separate large month card inside the hero area
- separate large expense card beside the month card
- tertiary stat strip competing with the hero
- wallets rendered like chunky cards by default
- budget header repeating too much context before the actual categories

## Implementation checklist
- collapse current top shell into one clean hero
- move month nav into hero header row
- make Transactions the visually primary/default mode
- rebuild transaction rows into a cleaner, denser list format
- simplify wallet presentation into minimal rows
- simplify budget to summary + category rows
- show active filters only when active
- remove duplicate financial summaries

## Success test
If a user opens Money and sees the screen for 2 seconds, they should know:
- how much money they have this period
- whether spending is under control
- what happened recently
- where to tap to add a transaction

If they need to parse 4 separate summary zones before reaching transactions, the redesign failed.

## Implementation priority inside this tab
1. Transactions view
2. Hero simplification
3. Wallet list simplification
4. Budget simplification
5. Filter cleanup
