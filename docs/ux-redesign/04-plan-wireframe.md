# Tab 04 — Plan Wireframe

Reference influence:
- Primary behavioral reference comes from the minimal note-taking direction: calm hierarchy, compact capture, list-first reading
- Secondary influence from the finance reference applies to Savings only: one strong number, quiet progress, no dashboard pile-up

## Purpose
Plan should feel like the place where intentions become executable.

It needs to support three jobs clearly:
1. see what needs doing
2. see what needs buying
3. see what needs funding

It should **not** feel like three separate apps glued together.

## Core design principle
Plan is a **structured workbench**, not a lane carnival.

That means:
- each subtab gets one clear purpose
- hierarchy comes from sequence and urgency, not many competing summary cards
- list quality matters more than quantity of widgets

## Current issues to remove
- tasks, shopping, and savings all begin with heavy summary behavior
- too many section blocks can make scanning feel fragmented
- lane names like Today / Routine / Tomorrow / Later are useful, but can become visually noisy if all are equally loud
- savings can become too card-heavy and editing-heavy at first glance

## New role of Plan
Plan should do only this:
- expose one active planning mode at a time
- provide one strong contextual hero for that mode
- provide one main list below
- keep add/edit actions close to the list they affect

## Information architecture
Plan stays split into 3 modes:
1. Tasks
2. Shopping
3. Savings

But the visual priority is:
- one hero
- one mode switch
- one main feed

## Shared structure
```text
┌──────────────────────────────────────┐
│ [Month / context hero]          +    │
│ one sentence about current state     │
├──────────────────────────────────────┤
│ [Tasks] [Shopping] [Savings]         │
├──────────────────────────────────────┤
│ mode-specific list content           │
└──────────────────────────────────────┘
```

## A. Tasks mode

### Purpose
Help the user decide what to do next without reading five equal-priority sections.

### Hero content
- title: month label or "Today in focus"
- support: pending count + one urgency note
- primary CTA: "+ Add Task"
- secondary action: "+ Routine" or filter chip

### Core UX decision
Tasks should default to a **priority-first feed**, not a many-lane overview.

Instead of always showing all sections equally, the default read order should be:
1. overdue
2. today
3. routines
4. tomorrow/later only when relevant

### Mobile wireframe — Tasks
```text
┌──────────────────────────────────────┐
│ Today in focus                 +Task │
│ 5 pending • 1 overdue                │
├──────────────────────────────────────┤
│ [Tasks] [Shopping] [Savings]         │
│ [All] [Today] [Overdue] [Routine]    │
├──────────────────────────────────────┤
│ Overdue                              │
│ Finish invoice follow-up             │
│ Task • missed yesterday              │
│ ───────────────────────────────────  │
│ Today                                │
│ Prepare monthly report               │
│ Task • due today                     │
│ ───────────────────────────────────  │
│ Routines                             │
│ Stretch / Inbox zero                 │
│ Routine                              │
└──────────────────────────────────────┘
```

### Tasks rules
- Use only the sections that contain meaningful items.
- Empty sections should not take permanent visual space.
- If Overdue exists, it appears first and gets the strongest emphasis.
- If the day is quiet, Tomorrow can replace Today as the visible preview.
- Completed items do not belong in the main feed by default.
- Completed is a filter state, not a permanent section.

### What to remove from current Tasks UX
- all lanes always shouting at the same level
- multiple summary chips that restate the same counts
- empty sections consuming vertical space

## B. Shopping mode

### Purpose
Turn shopping into a practical acquisition queue, not a second task board.

### Hero content
- title: "Shopping"
- support: urgent count + estimated total if useful
- primary CTA: "+ Add Item"

### Core UX decision
Shopping stays grouped by urgency, but only into **three quiet sections**:
- urgent
- routine
- later

These are enough.
No extra stat cards beyond one optional estimated total line.

### Mobile wireframe — Shopping
```text
┌──────────────────────────────────────┐
│ Shopping                      +Item  │
│ 7 items • Est. total Rp 430rb        │
├──────────────────────────────────────┤
│ [Tasks] [Shopping] [Savings]         │
├──────────────────────────────────────┤
│ Urgent                               │
│ Printer ink                    85rb  │
│ Need this week                        │
│ ───────────────────────────────────  │
│ Routine                              │
│ Coffee beans                   120rb │
│ Monthly restock                        │
│ ───────────────────────────────────  │
│ Later                                │
│ Desk mat                       225rb │
│ Not urgent                             │
└──────────────────────────────────────┘
```

### Shopping rules
- Use row-based list items, not oversized cards by default.
- Show amount only if available.
- Routine items should feel stable and muted, not urgent.
- If the list is empty, the empty state should offer only one clear action.

### What to remove from current Shopping UX
- large blocks for each section when a simpler list will do
- repeated count summaries once the hero already explains state

## C. Savings mode

### Purpose
Help the user understand progress toward goals without overloading the screen.

### Hero content
- title: "Savings"
- support: total saved + next milestone
- primary CTA: "+ Create Goal"

### Core UX decision
Savings should behave like a **progress list**, not like a set of interactive finance cards.

Each goal row should show only:
- goal name
- saved / target
- progress line
- one action affordance

Expanded editing should be secondary, not the first thing the UI communicates.

### Mobile wireframe — Savings
```text
┌──────────────────────────────────────┐
│ Savings                       +Goal  │
│ Rp 3.4jt saved • 1 near target       │
├──────────────────────────────────────┤
│ [Tasks] [Shopping] [Savings]         │
├──────────────────────────────────────┤
│ Japan Trip                     72%   │
│ Rp 7.2jt / Rp 10jt                   │
│ ───────── progress line ───────────  │
│ [Add funds]                          │
│                                      │
│ Emergency Fund                 41%   │
│ Rp 2.1jt / Rp 5jt                    │
│ ───────── progress line ───────────  │
│ [Add funds]                          │
└──────────────────────────────────────┘
```

### Savings rules
- The most complete or nearest goal may appear first.
- One row = one decision.
- "Add funds" is the main inline action.
- Edit/delete/advanced details should live behind expansion or secondary actions.
- Do not show multiple financial summaries above the goal list.

### What to remove from current Savings UX
- chunky card feeling as default
- too much action chrome visible before the user even reads the goal
- edit mode competing with progress reading

## Cross-mode behavior

### Mode switch
- stays directly under the hero
- should feel like a simple segmented control
- no extra descriptive cards before content

### Month switching
- only matters for Tasks mode
- should live in the Tasks hero area quietly
- should not create a separate bulky block

### Add actions
- there should be only one dominant add action per mode
- mode-specific, not global clutter

## Content priority rules
### Tasks
priority > due time > completion history

### Shopping
urgency > amount > category nuance

### Savings
progress > next action > editability

## Relationship to Summary
Summary points to Plan for action.
Plan itself should not try to be Summary again.
So Plan must avoid:
- general life overview language
- too many insights
- too many dashboard summaries

It should feel more operational and concrete.

## What to remove from current Plan overall
- too many equal-weight surface areas before the real list begins
- summary widgets that repeat counts already obvious from the feed
- heavy card treatment where rows would read faster
- editing controls always competing with reading

## Implementation checklist
- simplify shared top shell into contextual hero per mode
- keep segmented mode switch directly below hero
- rebuild Tasks into priority-first feed with conditional sections
- rebuild Shopping into lighter row-based grouped list
- rebuild Savings into progress rows with one main action
- demote completed items to filter state
- reduce repeated stat summaries across modes

## Success test
If a user opens Plan for 2 seconds, they should know:
- which planning mode they are in
- what the next most important item is
- how to add something new in this mode

If they have to decode several summary blocks before seeing the actual list, the redesign failed.
