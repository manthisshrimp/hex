# Week-First Calendar — Specification

## Overview

A personal calendar/planning application that visualises time in a week-first way. The primary navigation is a vertical infinite-scroll list of day squares. Weeks are the natural unit of time — month boundaries are secondary markers within the day list.

## Philosophy

Traditional calendars prioritise months. This interface treats the day-scroll as primary, weeks as natural groupings, and months as secondary boundaries. The result is a continuous timeline where you scroll through time rather than flipping between month pages.

---

## Layout

### Desktop (>768px) — 3-Column

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌───────────┬──────────────────────────┬───────────────────────────┐ │
│  │           │                          │                           │ │
│  │ YEAR MAP  │  DAYS LIST               │  DETAIL PANEL             │ │
│  │ (heatmap) │  (vertical infinite      │  (events for              │ │
│  │  ~80px    │   scroll of squares)     │   selected day)           │ │
│  │           │  ~200px                  │  fills remaining width    │ │
│  │           │                          │                           │ │
│  │ JAN-1 🟦  │  ┌─────────┐             │  Fri, 14 Mar 2026         │ │
│  │       🟨  │  │ Mon     │             │  ─────────────────────    │ │
│  │       🟩  │  │  23     │ ← selected  │  🟦 09:00  Team Standup   │ │
│  │           │  │  Feb    │             │  🟨 14:00  Dentist        │ │
│  │ FEB-1 🟦  │  ├─────────┤             │  🟩 19:00  Gym            │ │
│  │           │  │ Tue     │             │                           │ │
│  │           │  │  24     │             │  [ + Add Event ]          │ │
│  │           │  │  Feb    │             │                           │ │
│  │           │  ├─────────┤             │                           │ │
│  │           │  │ Wed     │             │                           │ │
│  │           │  │  25     │             │                           │ │
│  │           │  │  Feb    │             │                           │ │
│  └───────────┴──────────────────────────┴───────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Mobile (≤768px) — 2-Screen

```
Screen 1: List View              Screen 2: Detail View
┌──────────────────────┐         ┌──────────────────────┐
│  Week-First Calendar  │         │  ← Fri, 14 Mar        │
├──────────────────────┤         ├──────────────────────┤
│ ┌────┬─────────────┐ │         │  Events:              │
│ │🟦  │ Mon 23 Feb  │ │  tap  → │  🟦 09:00  Standup    │
│ │🟨  │             │ │         │  🟨 14:00  Dentist    │
│ ├────┼─────────────┤ │         │  🟩 19:00  Gym        │
│ │    │ Tue 24 Feb  │ │         │                       │
│ │🟦  │             │ │         │  [ + Add Event ]      │
│ └────┴─────────────┘ │         │                       │
│   (scroll for more)  │         │                       │
└──────────────────────┘         └──────────────────────┘
```

- Screen 1: YearMiniMap (compact, ~40px) + DaysList side-by-side
- Tapping a day navigates to Screen 2 (detail page with back button)

---

## Components

### YearMiniMap (Left Panel)

Vertical heatmap of the entire current year — like a GitHub contribution graph.

- 365 (or 366) small squares stacked top-to-bottom, one per day
- Fixed width ~80px total including labels
- Each square ~12px, ~2px gap
- **Colors:** gray = no events; event color = first/primary event color for that day
- **Month labels** on the left: `JAN-1`, `FEB-1`, etc., aligned to the first day of each month
- **Hover:** tooltip showing date, event count, and event titles
- **Click:** scrolls DaysList to that day and selects it

### DaysList (Centre Panel)

Vertical infinite-scroll list of square day tiles.

- Vertical scroll container, fixed width ~200px
- Each day is a **square tile** — equal width and height
- Tile content: day name (Mon), date number (23), month abbreviation (Feb)
- States: default, today (ring highlight), selected (border), weekend (accent), has-events (colored dots), month-boundary (label/border on 1st of month)
- Week groupings shown with a subtle separator every 7 days
- Initial load: 28 days centred on today
- Load 14 more days when approaching top or bottom edge
- Keep max ~60 days in DOM (remove far-off entries)
- Today is initially centred in view

### DetailPanel (Right Panel — Desktop Only)

Shows events for the selected day and allows CRUD.

- Fills remaining width on desktop
- Replaced by a full-screen Detail Page on mobile (with back button)
- Shows: formatted date header, sorted event list, Add Event button
- Events sorted: all-day first, then by start time
- Each event shows: color indicator, time range, title, description (collapsed), Edit + Delete actions
- Clicking Add or Edit opens the EventForm

### EventForm

Modal/inline form for creating and editing events.

Fields:
- Title (required)
- Date (pre-filled from selected day)
- All-day toggle (hides time inputs when on)
- Start time / End time (HH:MM, 24h)
- Color (preset palette — see Color Palette section)
- Description (optional textarea)

Behaviour:
- ESC cancels, Enter submits (when focus is not in textarea)
- Validation happens client-side before API call
- On success: form closes, event appears in list immediately

---

## Data Model

```typescript
interface Event {
  id: string;           // UUID
  date: string;         // YYYY-MM-DD
  title: string;
  description?: string;
  color?: string;       // hex e.g. "#3b82f6"
  startTime?: string;   // HH:MM (24h), omit if allDay
  endTime?: string;     // HH:MM (24h), omit if allDay
  allDay?: boolean;     // default: false
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
}
```

Recurrence is a v2 feature — not in scope for the current build.

---

## API

### Events

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events?start=YYYY-MM-DD&end=YYYY-MM-DD` | Events in date range → `{ events: Event[] }` |
| `GET` | `/api/events/:date` | Events for one day → `{ date: string, events: Event[] }` |
| `GET` | `/api/events/by-id/:id` | Single event → `Event` |
| `POST` | `/api/events` | Create → `Event` (body: Event without id/timestamps) |
| `PUT` | `/api/events/:id` | Update → `Event` (body: partial Event fields) |
| `DELETE` | `/api/events/:id` | Delete → `{ success: true }` |

### Days

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/days?start=YYYY-MM-DD&count=N` | Day metadata for N days from start → `{ days: DayCell[] }` |

`DayCell`:
```typescript
interface DayCell {
  date: string;
  dayOfMonth: number;
  monthName: string;    // "Jan", "Feb", etc.
  dayName: string;      // "Mon", "Tue", etc.
  isWeekend: boolean;
  isMonthBoundary: boolean;
  isToday: boolean;
  hasEvents: boolean;
  eventCount: number;
}
```

### Health

`GET /health` → `{ status: "ok" }`

---

## Storage

`data/events.jsonl` — one JSON object per line, append-on-create, rewrite-on-update/delete.

```jsonl
{"id":"evt-001","date":"2026-03-15","title":"Team Standup","color":"#3b82f6","startTime":"09:00","endTime":"10:30","allDay":false,"createdAt":"2026-03-14T10:00:00Z","updatedAt":"2026-03-14T10:00:00Z"}
{"id":"evt-002","date":"2026-03-15","title":"Dentist","color":"#f59e0b","startTime":"14:00","endTime":"15:00","allDay":false,"createdAt":"2026-03-14T11:00:00Z","updatedAt":"2026-03-14T11:00:00Z"}
```

---

## Color Palette

| Color | Hex |
|-------|-----|
| Blue | `#3b82f6` |
| Amber | `#f59e0b` |
| Green | `#22c55e` |
| Red | `#ef4444` |
| Purple | `#8b5cf6` |
| Pink | `#ec4899` |
| Cyan | `#06b6d4` |
| Gray | `#6b7280` |

---

## Implementation Status

### Done
- [x] Backend: Express server, events CRUD routes, JSONL storage, `/api/days` route
- [x] Frontend: 3-panel desktop layout, 2-screen mobile layout with React Router
- [x] YearMiniMap component (heatmap with month labels, hover tooltips, click-to-select)
- [x] DaysList component with DaySquare tiles, week separators, infinite scroll skeleton
- [x] DetailPanel with EventList and EventItem
- [x] EventForm with validation
- [x] Ansible deployment playbook (sync + Docker rebuild)

### Incomplete / Broken
- [ ] **CRUD not wired up** — layout components have stub handlers; `useEvents` hook in App.jsx is never connected to DesktopLayout or MobileLayout. Adding, editing, and deleting events does nothing.
- [ ] **DaysList uses mock data** — `useDays` generates random fake days instead of calling `/api/days`. Real event dots never appear in the day tiles.
- [ ] **Mobile has nested BrowserRouter** — MobileLayout creates its own router instead of sharing the top-level one.
- [ ] **Duplicate EventForm in MobileDetailView** — form is rendered twice when open.
- [ ] **YearMiniMap not scrolled from DaysList** — clicking minimap selects day but DaysList scroll-to is not fully implemented.

### Out of Scope (v2)
- Recurrence rules
- Drag and drop
- Search
- Import/Export
- Dark mode

---

## Tech Stack

- **Backend:** Node.js + Express, JSONL storage, `date-fns`, `uuid`
- **Frontend:** React 18, Vite, React Router
- **Deployment:** Docker Compose (dev + prod), Ansible (sync via rsync + rebuild)
- **Hosts:** `umbrel` (app server), `cori_celesti` (nginx reverse proxy + SSL)
