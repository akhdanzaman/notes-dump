# Tab 01 — Library / Notes Wireframe

Reference anchor:
- https://dribbble.com/shots/26259906-Modern-Note-Taking-App-UI-Clean-Minimal-Mobile-Design

## Purpose
Make Library feel like the product's mental home:
- capture notes fast
- browse notes calmly
- switch between general notes, journal, and skills without friction
- reduce visual noise from the current large top shell + repeated section emphasis

## User jobs
1. Open notes and continue reading quickly
2. Find a specific note by search/tag/date
3. Add a new note or journal entry fast
4. Switch to Skills without feeling like entering a separate app

## Current issues to remove
- top container is visually heavy for a content-first tab
- general / journal / skills feel like separate screens instead of one system
- notes rely too much on container treatment instead of hierarchy
- empty states are okay, but normal states still feel too card-heavy

## New screen hierarchy
1. Hero
2. Subtab switch
3. Optional active filters row
4. Primary content feed
5. Floating create action remains secondary, not dominant over content

## Hero content
### General notes
- Title: "Library"
- Supporting line: note count + current search/filter state
- Primary CTA: "+ New Note"

### Journal
- Title: "Journal"
- Supporting line: most recent entry date or streak if meaningful
- Primary CTA: "+ New Entry"

### Skills
- Title: "Skills"
- Supporting line: total tracked skills + current weekly progress summary
- Primary CTA: "+ Track Skill"

## Mobile wireframe

### A. General notes
```text
┌──────────────────────────────────────┐
│ Library                         +New │
│ 128 notes • All notes                │
├──────────────────────────────────────┤
│ [General] [Journal] [Skills]         │
│ [tag: work] [date: Apr]        Clear │  <- only if active
├──────────────────────────────────────┤
│ Search result / recent notes feed    │
│                                      │
│ Note title                           │
│ 2 lines preview…                     │
│ 29 Apr • 2 tags                      │
│ ───────────────────────────────────  │
│ Note title                           │
│ 2 lines preview…                     │
│ 28 Apr • no tags                     │
│ ───────────────────────────────────  │
│ ...                                  │
└──────────────────────────────────────┘
```

### B. Journal
```text
┌──────────────────────────────────────┐
│ Journal                        +Entry│
│ 18 entries • Last written today      │
├──────────────────────────────────────┤
│ [General] [Journal] [Skills]         │
├──────────────────────────────────────┤
│ Tue, 30 Apr                          │
│ Journal card / text preview          │
│                                      │
│ Mon, 29 Apr                          │
│ Journal card / text preview          │
│                                      │
│ Sun, 28 Apr                          │
│ Journal card / text preview          │
└──────────────────────────────────────┘
```

### C. Skills
```text
┌──────────────────────────────────────┐
│ Skills                         +Track│
│ 6 skills • 3 on track this week      │
├──────────────────────────────────────┤
│ [General] [Journal] [Skills]         │
├──────────────────────────────────────┤
│ UI Design                 68%        │
│ 4.2h this week • target 6h           │
│ ───────── progress line ───────────  │
│                                      │
│ Writing                    42%       │
│ 2.1h this week • target 5h           │
│ ───────── progress line ───────────  │
└──────────────────────────────────────┘
```

## Interaction rules
- Subtabs stay directly below hero; no second decorative header.
- Search/filter UI lives outside the screen content shell (existing floating search can stay), but active filters must render as a single compact row above the list.
- General notes should prefer a **single-column list by default**.
- Masonry becomes optional later, not default.
- Journal should feel chronological and editorial.
- Skills should use simple rows with one progress line, not oversized stat cards.

## Content model decisions
### General
- Default sort: newest first
- Preview length: max 2 lines
- Show metadata only if it helps scan: date, tag count, maybe one tag

### Journal
- Group by date
- Strong date separators, quiet body cards
- No extra summary widgets unless they change behavior

### Skills
- Show only 3 things in collapsed row:
  - skill name
  - weekly progress
  - total/target support text
- Edit/delete actions hidden until row action or long-press/menu

## What to remove from current implementation
- oversized decorative top shell for Library
- default masonry emphasis for all general notes
- repeated visual emphasis between headings and cards
- always-visible action chrome on skill cards

## Implementation checklist
- simplify top header into compact hero block
- reduce container depth
- convert general notes to clean list-first layout
- keep journal grouped by date, but calmer
- compress skill cards into minimal progress rows
- add one active-filter strip only when needed
- keep add actions tab-specific and singular

## Success test
If a user opens Library, they should understand in under 2 seconds:
- where they are
- what content they are looking at
- how to add a new note
- how to switch note type

If they need to interpret multiple cards before reading notes, the design is still too noisy.
