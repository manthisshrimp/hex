# Task 7: DaysList Component

## Objective
Build the DaysList component - vertical infinite scroll of square day tiles with week boundary indicators.

## Output Location
`octiron/calendar-site/frontend/src/components/DaysList.jsx`
(and DaySquare.jsx if separate)

## Deliverables

### 1. DaySquare.jsx component (can be inline or separate)
```jsx
function DaySquare({ 
  date,           // '2026-03-21'
  dayOfMonth,     // 21
  monthName,      // 'Mar'
  dayName,        // 'Sat'
  isWeekend,      // boolean
  isMonthBoundary, // boolean
  isToday,        // boolean
  isSelected,     // boolean
  hasEvents,      // boolean
  eventCount,     // number
  eventColors,    // ['#3b82f6', '#f59e0b']
  onClick 
}) {
  // Renders square tile with:
  // - Day name at top (Mon, Tue...)
  // - Date number in center
  // - Month name at bottom
  // - Event dots/bars if hasEvents
  // - Weekend marker
  // - Month boundary visual
}
```

### 2. DaysList.jsx component
```jsx
function DaysList({ 
  initialDate,
  selectedDate,
  onDaySelect,
  events 
}) {
  // Renders:
  // - Vertical scrollable container
  // - Infinite scroll (load more when near bottom/top)
  // - Array of DaySquare components
  // - Week boundary indicators every 7 days
}
```

### 3. Infinite scroll implementation:
- Use Intersection Observer (from useScroll hook or inline)
- Load 14 more days when approaching edge
- Keep ~60 days in DOM, virtualize the rest
- Smooth scrolling behavior
- Loading indicator when fetching

### 4. Week grouping visual:
- Subtle horizontal separator every 7 days
- Or: alternating background colors for weeks
- Week number label (optional, small text)

### 5. Styling:
- Fixed width container (~120-150px)
- Square tiles (~100-120px each)
- Scrollable height (100% of parent)
- Smooth scroll behavior

## Mock Data for Testing
```javascript
const mockDays = [
  { date: '2026-03-21', dayOfMonth: 21, monthName: 'Mar', dayName: 'Sat', isWeekend: true, isMonthBoundary: false, isToday: true, hasEvents: true, eventCount: 2 },
  { date: '2026-03-22', dayOfMonth: 22, monthName: 'Mar', dayName: 'Sun', isWeekend: true, isMonthBoundary: false, isToday: false, hasEvents: false, eventCount: 0 },
  // ... more days
];
```

## Success Criteria
- [ ] Component renders vertical list of day squares
- [ ] Squares show day name, date, month name
- [ ] Weekend days (Sat/Sun) have distinct styling
- [ ] Month boundaries have visual indicator
- [ ] Today is highlighted
- [ ] Days with events show dots/colors
- [ ] Clicking a day calls `onDaySelect(date)`
- [ ] Infinite scroll loads more days at top/bottom
- [ ] Scrolls smoothly, no jank

## Visual Reference
```
┌──────────────┐
│ Sat        │  │
│    21      │  │
│ Mar        │  │
│ ● ●        │  │ ← events
├──────────────┤
│ Sun        │  │ ← weekend
│    22      │  │
│ Mar        │  │
│            │  │
├──────────────┤
│ Mon        │  │
│    23      │  │
│ Mar        │  │
│ ●          │  │
│ ...        │  │
└──────────────┘
```

## Context from Spec
- Days list: vertical infinite scroll
- Square tiles: equal width/height
- Week boundaries: visual separators every 7 days
- Click selects day, triggers detail view

## Dependencies
- Task 4 (Frontend Setup) - needs React
- Task 5 (API Client) - needs useDays hook for infinite scroll

## Independent From
- YearMiniMap (just needs to sync scroll position)
- DetailPanel (just emits select event)
- Mobile responsive (handled separately)

## Blocks
- Task 9 (Responsive Layout) - needs both YearMiniMap + DaysList
