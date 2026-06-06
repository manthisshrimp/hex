# Task 8: DetailPanel and EventForm Components

## Objective
Build the DetailPanel (event display) and EventForm (add/edit) components for managing events.

## Output Location
`octiron/calendar-site/frontend/src/components/`

## Deliverables

### 1. EventItem.jsx component
```jsx
function EventItem({ event, onEdit, onDelete }) {
  // Renders single event:
  // - Color swatch/bar
  // - Time (if not all-day): "09:00 - 10:30"
  // - Title
  // - Description (if exists)
  // - Edit/Delete buttons
}
```

### 2. EventList.jsx component (can be inline in DetailPanel)
```jsx
function EventList({ events, onEdit, onDelete }) {
  // Renders list of EventItem components
  // Chronological order
  // Empty state if no events
}
```

### 3. EventForm.jsx component (modal or inline)
```jsx
function EventForm({ 
  event,           // null for create, event object for edit
  date,            // pre-filled date for new events
  onSave, 
  onCancel 
}) {
  // Form fields:
  // - Title (required, text input)
  // - Date (pre-filled, date picker)
  // - All Day (checkbox)
  // - Start Time (if not all-day)
  // - End Time (if not all-day)
  // - Color (preset palette + custom picker)
  // - Description (textarea)
  // 
  // Buttons: Save, Cancel
}
```

### 4. DetailPanel.jsx component
```jsx
function DetailPanel({ 
  date,            // '2026-03-21'
  events,          // array of events for this date
  loading,         // boolean
  onAdd,           // callback to open add form
  onEdit,          // callback with event
  onDelete         // callback with event id
}) {
  // Renders:
  // - Header: full date "Friday, March 21, 2026"
  // - EventList
  // - "+ Add Event" button
  // - Empty state: "No events for this day"
}
```

### 5. ColorPicker sub-component (inline or separate)
```jsx
function ColorPicker({ selectedColor, onChange }) {
  // 8 preset colors:
  // Blue #3b82f6, Amber #f59e0b, Green #22c55e, Red #ef4444
  // Purple #8b5cf6, Pink #ec4899, Cyan #06b6d4, Gray #6b7280
  // Plus custom hex input
}
```

### 6. Styling:
- DetailPanel: flexible width, clean card layout
- EventItem: compact row with color indicator
- EventForm: modal overlay or inline form
- Color swatches: small circles, selected has ring

## Mock Data for Testing
```javascript
const mockEvents = [
  {
    id: 'evt-1',
    date: '2026-03-21',
    title: 'Team Standup',
    description: 'Weekly sync meeting',
    color: '#3b82f6',
    startTime: '09:00',
    endTime: '10:30',
    allDay: false
  },
  {
    id: 'evt-2',
    date: '2026-03-21',
    title: 'Lunch with Sarah',
    color: '#f59e0b',
    allDay: false,
    startTime: '12:30',
    endTime: '13:30'
  }
];
```

## Success Criteria
- [ ] DetailPanel shows full date header
- [ ] EventList displays events in time order
- [ ] EventItem shows color, time, title
- [ ] Clicking "Add" opens EventForm with date pre-filled
- [ ] Clicking "Edit" opens EventForm with event data
- [ ] ColorPicker shows 8 presets + custom
- [ ] Saving form calls onSave with form data
- [ ] Deleting shows confirmation (optional) and calls onDelete
- [ ] Empty state displays friendly message

## Visual Reference
```
Detail Panel:
┌────────────────────────────┐
│  Friday, March 21, 2026   │
├────────────────────────────┤
│                            │
│  🟦 09:00 - 10:30         │
│     Team Standup          │
│     [Edit] [Delete]       │
│                            │
│  🟨 12:30 - 13:30         │
│     Lunch with Sarah      │
│     [Edit] [Delete]       │
│                            │
│  [ + Add Event ]          │
│                            │
└────────────────────────────┘

Event Form:
┌────────────────────────────┐
│  Add Event            [×] │
├────────────────────────────┤
│ Title: [               ]  │
│ Date:  [2026-03-21    ]  │
│ All Day: [☐]              │
│ Start: [09:00] End:[10:30]│
│ Color: 🟦🟨🟩🟥🟪🟫⬛⬜  │
│ Desc: [                ]  │
│        [Cancel] [Save]    │
└────────────────────────────┘
```

## Context from Spec
- Detail panel: shows events for selected day
- Event form: title, date, all-day toggle, times, color, description
- Color palette: 8 presets (work, appointment, personal, urgent, etc.)

## Dependencies
- Task 4 (Frontend Setup) - needs React
- Task 5 (API Client) - can use mock data initially

## Independent From
- DaysList (just needs date prop)
- YearMiniMap (no dependency)
- Mobile responsive (works as-is)

## Blocks
- Task 9 (Responsive Layout) - needs these components to integrate
