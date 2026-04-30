# Minimal UX System for Notes Dump

## 1. Visual intent
The app should feel:
- calm
- focused
- quiet
- quick to scan
- personal, not enterprise

This is **not** a dashboard-heavy product.
It is a capture-and-review product with finance and planning layers.

## 2. Layout principles
- Use a single dominant top section per tab.
- Follow with one main content stream.
- Avoid stacked summary cards unless each card leads to a distinct action.
- Prefer plain surfaces over nested containers.
- Use bottom space for breathing room, not more widgets.

## 3. Information density rules
### Allowed
- 1 hero metric or hero title
- 1 supporting line
- 1 main CTA
- 1 filter row when necessary
- 1 content list/grid below

### Avoid
- repeating the same total in header, cards, and section labels
- multiple summary clusters on the same screen
- too many colored badges fighting for attention
- cards inside cards unless editing/detail mode

## 4. Hierarchy model per tab
1. Hero
2. Context switch (subtabs/filter chips)
3. Primary list/content area
4. Empty state or detail drawer

## 5. Typography rules
- Large type only for hero number/title
- Section labels should be quiet and compact
- Metadata stays muted and single-line where possible
- Use bold sparingly; if everything is bold, nothing is

## 6. Component rules
### Hero block
Use for:
- total balance
- notes count + search state
- month focus
- today state

Must contain only:
- title or metric
- one supporting sentence
- one primary action

### Filter chips
- Max 4 visible before overflow
- Only show active chips when a filter is actually applied
- Chips should narrow the list, not restate the screen title

### Cards
Cards are allowed when content varies in length.
But default should be a clean list with strong spacing.
Use masonry only if note lengths vary significantly and readability stays high.

## 7. Color usage
- Neutral base first
- Indigo: primary system accent
- Green: positive finance state only
- Red/amber: warnings or urgency only
- Avoid turning every category into a strong color block

## 8. Animation rules
- Short and functional
- Use motion for transitions, not decoration
- Avoid multiple animated zones competing at once

## 9. What 'minimal' means here
Minimal is not empty.
Minimal means:
- fewer decisions per screen
- clearer next action
- less repeated context
- faster scanning
