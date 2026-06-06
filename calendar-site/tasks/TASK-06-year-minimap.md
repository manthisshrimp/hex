# Task 6: YearMiniMap Component

## Objective
Build the YearMiniMap component - vertical heatmap with month labels (JAN-1, FEB-1, etc.) showing all days as colored squares.

## Output Location
`octiron/calendar-site/frontend/src/components/YearMiniMap.jsx`

## Deliverables

### 1. YearMiniMap.jsx component
```jsx
function YearMiniMap({ year, events, selectedDate, onDayClick }) {
  // Renders:
  // - Vertical column of 365/366 small squares
  // - Month labels on left: "JAN-1", "FEB-1", etc.
  // - Each square colored by event (or gray if empty)
  // - Selected day highlighted
  // - Click handler to jump to that day
}
```

### 2. Component features:
- **Layout**: Fixed width container (~60-80px)
- **Day squares**: ~10-12px each, ~2px gap
- **Month labels**: Text on left side aligned with day 1 of each month
- **Colors**: 
  - Gray (#e5e7eb) for no events
  - Event color for days with events
  - Multiple events: use first event color or blend
- **Selected state**: Border or ring around current day
- **Hover**: Tooltip with date and event count

### 3. Helper functions in component or utils:
```javascript
// Generate 365 days for a year with metadata
function generateYearDays(year) { }

// Get color for a day based on events
function getDayColor(date, events) { }
```

### 4. CSS styling (inline or separate YearMiniMap.css):
- Container: flex column
- Month labels: small text, left-aligned
- Day squares: small fixed size, border-radius
- Hover effect: scale up slightly, show tooltip

### 5. Tooltip component (inline or minimal):
- Shows: "March 15 - 3 events" on hover
- Positioned near cursor

## Mock Data for Testing
```javascript
const mockEvents = [
  { date: '2026-03-15', title: 'Meeting', color: '#3b82f6' },
  { date: '2026-03-15', title: 'Lunch', color: '#f59e0b' },
  { date: '2026-03-21', title: 'Gym', color: '#22c55e' }
];
```

## Success Criteria
- [ ] Component renders 365 squares for 2026
- [ ] Month labels (JAN-1, FEB-1, etc.) visible and aligned
- [ ] Days with events show their color
- [ ] Clicking a day calls `onDayClick(date)`
- [ ] Selected day has distinct visual highlight
- [ ] Hover shows tooltip with date
- [ ] Responsive: works at narrow width

## Visual Reference
```
┌────────────────┐
│ JAN-1  ■■■■    │
│        ■■■■    │
│        ■■■■    │
│ FEB-1  ■■■■    │
│        ■■■■    │
│ MAR-1  ■■■■    │
│ ...            │
└────────────────┘
```

## Context from Spec
- Year mini-map: vertical heatmap like GitHub contribution graph
- Month labels: "JAN-1", "FEB-1", etc. on left side
- Click jumps to that day in DaysList
- Colors indicate events

## Dependencies
- Task 4 (Frontend Setup) - needs React project
- Task 5 (API Client) - can use mock events initially

## Independent From
- DaysList (this is self-contained)
- DetailPanel (just emits click event)
- Backend (can use mock data)

## Blocks
- Task 9 (Responsive Layout) - needs this component to integrate
