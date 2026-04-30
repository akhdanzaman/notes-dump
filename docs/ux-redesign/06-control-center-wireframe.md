# Tab 06 — Control Center Wireframe

Reference influence:
- Follows the same minimal system as the main app
- Should feel more utilitarian than expressive
- Prioritizes clarity, status, and safe actions over visual richness

## Purpose
Control Center should help the user:
1. understand sync / connection state quickly
2. reach the right settings category fast
3. change settings safely without reading through clutter

It should not feel like a second dashboard app.

## Core design principle
Control Center is a **settings hub**, not a feature showcase.

That means:
- status first
- categories second
- settings lists third
- summary widgets only when they help a real decision

## Current issues to remove
- main screen can become too card-heavy
- too many sections try to summarize state before the user even enters settings
- status, sync actions, clock, settings menu, and system details can compete visually
- some settings pages inherit too much decorative structure rather than behaving like clean forms/lists

## New role of Control Center
Control Center should do only this:
- provide one system-status hero
- provide one category list
- inside each category, provide one clean settings list
- keep destructive or advanced actions isolated and obvious

## Information architecture
Main categories stay:
1. Appearance
2. Behavior
3. Notifications
4. Budget
5. Data
6. Connect
7. Changelog

But presentation changes:
- main page = status + category list
- category page = single-purpose settings page
- no extra visual summaries unless they reduce effort

## Main screen hierarchy
1. Status hero
2. Category list
3. Quiet footer/meta

## Main screen wireframe
```text
┌──────────────────────────────────────┐
│ Control Center                  Done │
│ Synced • 3 pending changes           │
│ Last refresh ok                      │
│ [Sync now]                     [Save]│
├──────────────────────────────────────┤
│ Appearance                    ›      │
│ Theme, density, privacy              │
│ ───────────────────────────────────  │
│ Behavior                      ›      │
│ Prompt flow, parsing, defaults       │
│ ───────────────────────────────────  │
│ Notifications                 ›      │
│ Alerts and reminders                 │
│ ───────────────────────────────────  │
│ Budget                        ›      │
│ Income and categories                │
│ ───────────────────────────────────  │
│ Data                          ›      │
│ Export, import, restore             │
│ ───────────────────────────────────  │
│ Connect                       ›      │
│ Google, GitHub, spreadsheet         │
│ ───────────────────────────────────  │
│ Changelog                     ›      │
│ Recent updates                       │
└──────────────────────────────────────┘
```

## Main screen rules
- Use one status hero only.
- Do not add multiple dashboard summary cards on the main page.
- The category list should read like a clean settings index.
- Each row needs only:
  - label
  - short description
  - chevron
- Save and Sync should be present, but not dominate the page unless something needs attention.

## Status hero
### Content
- primary status: synced / saving / failed / local only
- support line: pending count or error summary
- primary action: sync / retry when relevant
- secondary action: save when relevant

### Allowed states
#### Good state
- "Synced"
- "Everything up to date"

#### Warning state
- "3 pending changes"
- "Local changes not uploaded"

#### Error state
- "Sync failed"
- one-line reason only

### What not to put here
- clock widget
- data footprint counts
- connection counts
- multiple analytics cards
- changelog preview

Those are secondary and should not compete with the settings mission.

## Category page model
Every settings page should follow the same structure:
1. compact header
2. one-line purpose
3. clean grouped settings list
4. destructive section only at bottom if needed

```text
┌──────────────────────────────────────┐
│ ← Notifications                Save  │
│ Alerts and reminders                 │
├──────────────────────────────────────┤
│ Notification mode                    │
│ [Sound / Vibrate / Both / Silent]    │
│ ───────────────────────────────────  │
│ Browser notifications          [on]  │
│ Allow desktop/mobile alerts          │
│ ───────────────────────────────────  │
│ AI insights                    [off] │
│ Notify when insights are ready       │
│ ───────────────────────────────────  │
│ Reminders                      [on]  │
│ Notify for scheduled items           │
└──────────────────────────────────────┘
```

## Per-category guidance

### 1. Appearance
Purpose:
- theme, privacy, display density

Rules:
- list toggles and segmented choices only
- no summary cards needed
- put theme first, privacy second

Recommended groups:
- Theme
- Display
- Privacy

Avoid:
- decorative preview cards unless they directly help theme selection

### 2. Behavior
Purpose:
- parsing mode, review behavior, prompts, defaults

Rules:
- this page should read like system preferences
- advanced options can collapse under "Advanced"
- do not summarize the same behavior state in cards first

Recommended groups:
- Capture behavior
- Parsing flow
- Advanced

### 3. Notifications
Purpose:
- alert modes and reminder behavior

Rules:
- toggles should be the content
- permission request stays inline as one action row
- no separate stats tiles for notifications count

Recommended groups:
- Permission
- Mode
- Types

### 4. Budget
Purpose:
- manage monthly income and category allocations

Rules:
- one short summary line is enough: total allocation
- category rows should be editable list items
- income input stays at top

Recommended layout:
- Monthly income field
- Allocation status line
- Category rows
- Add category action

Avoid:
- multiple budget summary cards before the editable list

### 5. Data
Purpose:
- export, import, clear, history restore

Rules:
- safety and clarity matter more than polish
- group by action severity
- restore history must feel isolated and explicit

Recommended groups:
- Export / import
- History / backup
- Dangerous actions

### 6. Connect
Purpose:
- external services and identity state

Rules:
- each service becomes a clean account row or form block
- connected state should be obvious
- do not create a separate stats overview for number of connections

Recommended service order:
- Google
- Spreadsheet
- GitHub
- Gemini
- Calendar/API extras

Each service row should show only:
- name
- status
- primary action
- secondary disconnect only if connected

### 7. Changelog
Purpose:
- show product version history simply

Rules:
- newest version first
- each version = title + 2–4 bullets max
- no need for decorative release cards beyond readable grouping

## Interaction rules
- opening a category should feel instant and direct
- save should be visible only where relevant
- destructive actions require separation and confirmation
- sync retry should appear only when needed, not as permanent emphasis

## What to remove from current Control Center
- multiple dashboard-like summaries on the main screen
- extra cards that restate settings state before the actual settings list
- status widgets that compete with the category list
- category pages that begin with too much overview before the controls

## Implementation checklist
- simplify main page to one status hero + category index
- remove nonessential summary widgets from main page
- normalize every category page into grouped settings rows
- demote stats/counts unless they help a decision
- isolate destructive actions clearly in Data / Connect
- keep changelog readable and light

## Success test
If a user opens Control Center for 2 seconds, they should know:
- whether the system is healthy
- where to go for the setting they want
- whether anything needs saving or retrying

If they feel like they opened another analytics dashboard, the redesign failed.
