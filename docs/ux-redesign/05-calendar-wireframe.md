# Tab 05 — Calendar Wireframe

Reference influence:
- Primary influence from the minimal note-taking direction: calm structure, readable spacing, content-first flow
- Supporting influence from the planner direction: one clear context area, then agenda

## Purpose
Calendar should help the user answer:
1. what is happening on a day
2. what is coming soon
3. whether a date is overloaded or free

It should not force the user to parse a dense grid before understanding their schedule.

## Core design principle
Calendar is **agenda-first, grid-supported**.

The month grid still matters, but it is a navigation surface.
The real reading surface is the day agenda below it.

## Current issues to remove
- the grid currently carries too much responsibility
- every day cell can become visually dense and hard to scan
- item detail is only available after tapping a tiny block
- the main understanding of a selected day comes too late
- the screen feels more like a packed calendar widget than a planning surface

## New role of Calendar
Calendar should do only this:
- provide one month context header
- provide one compact month grid
- provide one strong selected-day agenda below
- provide a lightweight detail action from agenda items

## Key UX decision
**The selected day agenda becomes the main content area.**

Meaning:
- the grid is there to choose a day
- the agenda explains the day
- detail modal is secondary, not the primary reading surface

## Screen hierarchy
1. Month hero / header
2. Compact month grid
3. Selected day agenda
4. Detail sheet only when needed

## Month header
### Content
- title: current month and year
- support: one line summary like total scheduled items or upcoming count
- utility action: Today

### Example
- "April 2026"
- "12 scheduled • 3 upcoming this week"

Do not add extra analytics cards unless they clearly change behavior.

## Mobile wireframe
```text
┌──────────────────────────────────────┐
│ April 2026                    Today  │
│ 12 scheduled • 3 upcoming            │
├──────────────────────────────────────┤
│ Su Mo Tu We Th Fr Sa                 │
│ 30 31  1  2  3  4  5                 │
│  6  7  8  9 10 11 12                 │
│ 13 14 15 16 17 18 19                 │
│ 20 21 22 23 24 25 26                 │
│ 27 28 29 30  1  2  3                 │
│        ^ selected day                │
├──────────────────────────────────────┤
│ Tue, 30 April                        │
│ 3 items                              │
│                                      │
│ Finish client deck                   │
│ Task • due today                     │
│ ───────────────────────────────────  │
│ Dentist appointment                  │
│ Event • 15:00                        │
│ ───────────────────────────────────  │
│ Buy printer ink                      │
│ Shopping • urgent                    │
└──────────────────────────────────────┘
```

## Month grid rules
- Keep the grid visually light.
- Day cells should prioritize:
  1. day number
  2. selection state
  3. tiny event indicators or count
- Avoid rendering full text labels inside every dense day cell by default.
- Use dots, counts, or one subtle marker instead of many miniature blocks.

### Day cell behavior
Recommended:
- empty day: just number
- day with 1–2 items: small dots
- day with many items: count badge like "+3"
- selected day: strong outline/fill state
- today: subtle accent ring

This makes the grid scannable again.

## Selected day agenda
This is the primary reading surface.

### Rules
- show selected date as heading
- show item count or empty state subtitle
- render items in chronological or logical order
- each row shows:
  - title
  - one metadata line
- rows should be list items, not heavy cards by default

### Ordering rule
1. timed events
2. due-today tasks
3. urgent shopping
4. routines

If the product logic prefers urgency first, keep it consistent — but use one stable ordering rule.

## Empty day behavior
If a selected day has nothing:
- do not leave a blank panel
- show a calm empty state such as:
  - "Nothing scheduled"
  - "Good day for planning or deep work"

Optional action:
- "+ Add task" or "Go to Plan"

## Detail view
The detail sheet should remain secondary.

### Rules
- open from agenda item tap
- keep modal compact
- show:
  - title
  - type
  - status
  - date/time
  - one or two actions max

Do not make the detail sheet the only readable place for event context.
The agenda row should already carry enough meaning.

## Content model guidance
### Tasks
- show due date/day relation clearly
- overdue status should be visible without opening detail

### Events
- prioritize time display
- if span is multi-day, indicate it in metadata

### Shopping
- only show shopping items if they are intentionally calendar-relevant
- urgent shopping can appear, but routine shopping should not overload the calendar

### Routines
- routines should appear as lightweight recurring markers
- do not let recurring items dominate the whole month grid visually

## What to remove from current Calendar
- text-heavy day cells by default
- too much reliance on tiny in-cell labels
- using the grid as both selector and full reading surface
- detail understanding that only happens in modal

## Interaction rules
- tap day = update agenda below immediately
- tap Today = jump month + select today
- swipe month can remain, but tap target clarity matters more
- tap agenda row = open detail

## Relationship to Plan
Calendar should complement Plan, not duplicate it.

Plan = workbench
Calendar = time map

So Calendar should emphasize:
- date-based visibility
- day load
- upcoming schedule

It should avoid:
- task management controls everywhere
- too much edit-first chrome

## Optional enhancement later
If needed later:
- add toggle between Month and Agenda
- but only if the month + day agenda model proves insufficient

Do not add this now by default.

## Implementation checklist
- simplify header into month title + one support line + Today action
- reduce day cells to dots/counts instead of tiny text blocks
- make selected day state much clearer
- promote day agenda below the grid into the main reading surface
- simplify agenda rows into clean list items
- keep detail modal as secondary

## Success test
If a user opens Calendar for 2 seconds, they should know:
- which month they are looking at
- which day is selected
- what is happening on that selected day

If they must inspect small cell text across the whole grid to understand their schedule, the redesign failed.
