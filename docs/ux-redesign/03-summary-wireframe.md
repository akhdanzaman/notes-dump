# Tab 03 — Summary Wireframe

Reference anchors:
- Notes: https://dribbble.com/shots/26259906-Modern-Note-Taking-App-UI-Clean-Minimal-Mobile-Design
- Finance: https://dribbble.com/shots/25580105-Minimalist-Finance-Dashboard-UI

## Purpose
Summary should become the app's calm landing screen.

It is **not** a mega dashboard.
It should answer only three things fast:
1. what deserves attention now
2. what I might want to capture now
3. whether my day/month is generally okay

## Core design principle
Summary is a **bridge screen**, not a storage screen.

That means:
- show only the most important slice from each system
- never duplicate what a deeper tab already explains better
- every block should point somewhere meaningful

## Current issues to remove
- too many competing concepts in one screen: quick actions, focus list, rituals, finance summary, theme, AI insights, notifications, parsing review
- multiple zones all trying to be important at once
- summary sometimes behaves like mini-Plan + mini-Money + mini-Library all stacked together
- high risk of repeated context and repeated metrics

## New role of Summary
Summary should do only this:
- provide one **Today hero**
- provide one **quick capture rail**
- provide one **focus feed**
- optionally show one **secondary signal block** if it changes action

## What Summary should NOT do
- not a full finance dashboard
- not a full task dashboard
- not a full insights center
- not a duplicate navigation menu made of large cards

## Screen hierarchy
1. Today hero
2. Quick capture strip
3. Focus feed
4. Secondary signal block (only one)

## Today hero
The hero should feel like the top of a minimal personal operating system.

### Hero content
- title: dynamic day state
- one supporting line
- one supporting metric line (optional)
- one primary action
- one small secondary action

### Hero state examples
#### A. Busy day
- Title: "3 things need you today"
- Support: "2 tasks and 1 urgent purchase"
- Metric: "Spend today Rp 145rb"
- Primary action: "Open Today"
- Secondary action: "+ Capture"

#### B. Calm day
- Title: "You’re mostly clear today"
- Support: "Only 1 routine left"
- Metric: "Month spend is on track"
- Primary action: "See routine"
- Secondary action: "+ Capture"

#### C. All clear
- Title: "Nothing urgent right now"
- Support: "Good time to plan or capture ideas"
- Metric: optional only if useful
- Primary action: "+ New Note"
- Secondary action: "View Plan"

## Mobile wireframe
```text
┌──────────────────────────────────────┐
│ Good evening                         │
│ 3 things need you today              │
│ 2 tasks • 1 urgent buy • Spend ok    │
│ [Open Today]                  [+Cap] │
├──────────────────────────────────────┤
│ [Note] [Task] [Expense] [Journal]    │  <- quick capture strip
├──────────────────────────────────────┤
│ Today                                │
│                                      │
│ Finish client deck                   │
│ Task • due today                     │
│ ───────────────────────────────────  │
│ Buy printer ink                      │
│ Shopping • urgent                     │
│ ───────────────────────────────────  │
│ Stretch routine                      │
│ Routine                               │
├──────────────────────────────────────┤
│ Signal                               │
│ April spend is at 58% of budget      │
│ [Open Money]                         │
└──────────────────────────────────────┘
```

## Block-by-block rules

### 1. Today hero
Rules:
- one dominant state only
- do not show net worth here as a giant number
- do not show monthly theme here unless it actively matters today
- supporting line must be plain-language, not widget language

This hero should summarize **attention**, not data abundance.

### 2. Quick capture strip
Inspired more by the note-taking reference.

Rules:
- use compact pill or icon buttons
- max 4 actions visible
- actions should reflect actual frequent capture behaviors:
  - Note
  - Task
  - Expense
  - Journal
- no large square action cards on Summary

### 3. Focus feed
This is the main content stream.

Rules:
- max 3 items visible before "View all"
- item order:
  1. urgent shopping
  2. due-today tasks/events
  3. pending routines
  4. tomorrow preview only if today is clear
- each row uses only:
  - title
  - one metadata line
- no heavy cards unless the item content is long

### 4. Secondary signal block
Only one secondary block should appear at a time.

Priority order:
1. pending review / parser issue
2. budget warning
3. recent AI insight
4. monthly theme

This rule matters a lot.
**Do not stack all four.**
Choose one based on urgency.

## Secondary block behavior
### If parser/review exists
Show:
- "2 items need review"
- CTA: "Open review"

### If budget risk exists
Show:
- "April spend is at 82%"
- CTA: "Open Money"

### If insight matters
Show:
- one insight title + one-line explanation
- CTA: "Read insight"

### If nothing urgent exists
Show monthly theme quietly:
- "April theme"
- one short line of theme content
- CTA: "Edit"

## Finance on Summary
Finance should be present only as a signal, not a dashboard.

Allowed:
- one line: "Spend today / month"
- one warning: "Budget almost full"
- one CTA to Money

Not allowed:
- net worth hero duplication from Money
- assets/debt/savings breakdown
- multiple finance stat cards

## Notes influence from the note-taking reference
Borrow these qualities:
- calm spacing
- fast capture affordance
- content-first flow
- fewer boxes, more readable structure

Apply to Summary like this:
- quick capture stays light
- focus feed is list-first
- less ornamental chrome
- fewer oversized action zones

## Finance influence from the finance reference
Borrow these qualities:
- one clear headline number or state
- supportive secondary data only
- strong CTA placement
- quiet structure under the hero

Apply to Summary like this:
- hero is strong but singular
- one signal block only
- no summary-card pileups

## What to remove from current Summary
- big clusters of quick-action cards
- multiple important-looking sections in a row
- duplicated task state in several blocks
- duplicated finance state outside Money
- multiple side systems (theme, AI, review, notifications) shown together with equal weight

## Interaction rules
- tapping hero primary action opens Plan with proper sub-context
- tapping quick capture opens respective add flow immediately
- tapping focus row opens item detail/edit
- tapping secondary signal opens the relevant destination tab or modal

## Empty state philosophy
If there is nothing urgent:
- do not manufacture fake dashboard content
- do not fill the screen with extra stats
- instead show:
  - calm hero
  - capture strip
  - monthly theme or recent note prompt

## Implementation checklist
- reduce Summary to 4 structural zones max
- replace large quick-action cards with compact capture strip
- build one dynamic hero around current-day state
- limit focus feed to top 3 items
- create priority resolver for the single secondary block
- remove redundant finance/task summaries
- keep monthly theme as fallback, not permanent headline content

## Success test
If a user opens Summary for 2 seconds, they should know:
- what needs attention now
- what they can capture quickly
- whether anything unusual needs escalation

If they feel like they opened three tabs at once, the redesign failed.
