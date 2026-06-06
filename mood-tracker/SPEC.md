# Mood Tracker — Specification

## Overview

A minimal mobile-first app for recording mood and energy/motivation levels throughout the day. The defining principle is **zero friction** — a single tap records an event with no forms, no confirmations, no loading spinners in the way.

---

## Philosophy

Recording how you feel should be as fast as tapping a notification. If the UI adds friction, the user won't bother. Therefore:

- Tapping a circle is the complete recording action — no submit button, no modal
- Visual feedback is immediate and satisfying
- The app opens directly on the recording screen

---

## Screens

### Screen 1 — Record (default / home)

The only screen needed for day-to-day use.

```
┌──────────────────────────────┐
│         how are you?         │
│                              │
│  MOOD                        │
│  ○ irritable  ○ angry        │
│  ○ anxious    ○ depressed    │
│  ○ stressed                  │
│                              │
│  ENERGY                      │
│  ● ● ● ● ● ● ●               │
│  1   2   3   4   5   6   7   │
│  can't            do all     │
│  get up           the stuff  │
│                              │
│  [  History  ]               │
└──────────────────────────────┘
```

**Mood circles** — 5 circles in a 2-column wrap layout, each showing a large emoji icon with a text label below:

| Mood | Icon |
|------|------|
| irritable | 😤 |
| angry | 😡 |
| anxious | 😰 |
| depressed | 😞 |
| stressed | 😫 |

Each circle: ~90px, emoji icon inside, named label below, color-coded border/fill (see palette). Tap → ripple animation + circle briefly fills solid → POST to backend.

**Energy circles** — 7 circles in a single horizontal row, each with an emoji icon. Short label anchors at each end: "can't get up" and "do all the stuff". Each circle uses the gradient color scale. Tap → same ripple + fill animation → POST to backend.

| Level | Icon |
|-------|------|
| 1 | 🛌 |
| 2 | 🐌 |
| 3 | 🥱 |
| 4 | 😐 |
| 5 | 🙂 |
| 6 | ⚡ |
| 7 | 🚀 |

**History link** — a subtle text button at the bottom navigates to Screen 2.

---

### Screen 2 — History

A reverse-chronological list of all recorded events, lazy-loaded on scroll.

```
┌──────────────────────────────┐
│  ←  History                  │
├──────────────────────────────┤
│  Today                       │
│  ┌──────────────────────┐    │
│  │ 14:32  😤 irritable  │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 11:05  ⚡ energy 6   │    │
│  └──────────────────────┘    │
│                              │
│  Yesterday                   │
│  ┌──────────────────────┐    │
│  │ 22:14  😞 depressed  │    │
│  └──────────────────────┘    │
│  ...                         │
│  (scroll loads more)         │
└──────────────────────────────┘
```

- Entries grouped by day with a sticky date header
- Each entry shows: time (HH:MM), emoji icon, label (mood name or "energy N"), and a delete button (trash icon)
- Tapping delete removes the entry immediately (optimistic) and calls `DELETE /api/entries/:id`
- Initial load: 30 entries
- Scroll-triggered load: 20 more entries per page
- No pagination controls — scroll is the only mechanism

---

## Data Model

```typescript
interface Entry {
  id: string;           // UUID
  type: 'mood' | 'energy';
  value: string;        // mood name (e.g. "irritable") or energy level (e.g. "4")
  recordedAt: string;   // ISO 8601 timestamp
}
```

Storage: `data/entries.jsonl` — one JSON object per line, append-only.

```jsonl
{"id":"e-001","type":"mood","value":"anxious","recordedAt":"2026-04-11T14:32:00Z"}
{"id":"e-002","type":"energy","value":"6","recordedAt":"2026-04-11T11:05:00Z"}
```

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ status: "ok" }` |
| `POST` | `/api/auth` | `{ password }` → `{ token }` |
| `POST` | `/api/entries` | Record an entry → `Entry` |
| `GET` | `/api/entries?limit=N&before=<ISO>` | Paginated history, newest-first → `{ entries: Entry[], hasMore: boolean }` |
| `DELETE` | `/api/entries/:id` | Delete an entry → `{ success: true }` |

### POST /api/entries

Request body:
```json
{ "type": "mood", "value": "anxious" }
```
or
```json
{ "type": "energy", "value": "4" }
```

Server sets `id` (UUID) and `recordedAt` (current UTC timestamp). Returns the full `Entry`.

### GET /api/entries

- `limit` — number of entries to return (default 30, max 100)
- `before` — ISO timestamp; return entries recorded before this time (for pagination)

Returns entries sorted newest-first. `hasMore: true` if more entries exist before the oldest one returned.

---

## Moods — Labels and Colors

| Mood | Color | Hex |
|------|-------|-----|
| irritable | Orange | `#f97316` |
| angry | Red | `#ef4444` |
| anxious | Sky blue | `#38bdf8` |
| depressed | Slate | `#64748b` |
| stressed | Purple | `#8b5cf6` |

---

## Energy Levels — Labels and Colors

Level 4 is neutral (gray). Levels above 4 are positive (green → blue). Levels below 4 are negative (yellow → red).

| Level | Short label | Color | Hex |
|-------|-------------|-------|-----|
| 1 | can't get up | Red | `#ef4444` |
| 2 | very low | Orange | `#f97316` |
| 3 | low | Yellow | `#eab308` |
| 4 | neutral | Gray | `#94a3b8` |
| 5 | good | Green | `#22c55e` |
| 6 | energised | Teal | `#14b8a6` |
| 7 | do all the stuff | Blue | `#3b82f6` |

---

## UX Details

### Tap feedback

On tap:
1. Circle scales up briefly (transform: scale 1.15, ~100ms)
2. Circle fills with its solid color (was outline-only at rest)
3. A ripple radiates outward from the tap point (~300ms)
4. Circle returns to rest state

The POST fires immediately on tap — feedback is optimistic; no spinner is shown. If the request fails, a brief shake animation plays on the circle and a small toast appears at the bottom ("not saved — tap to retry").

### Resting state

Circles are rendered as outlined rings (border only, transparent fill) with the label below. This keeps the screen visually light and makes the fill-on-tap more satisfying.

### No double-tap prevention

The same mood/energy level can be recorded multiple times in quick succession. The history will show each tap as a separate entry. There is no cooldown or deduplication.

---

## Tech Stack

- **Backend:** Node.js + Express, JSONL storage, `uuid`
- **Frontend:** React 18, Vite, React Router (2 screens)
- **Auth:** single-password SHA256 token (same pattern as other apps)
- **Deployment:** Docker Compose (dev + prod), Ansible

---

## Ports

| Role | Port |
|------|------|
| Backend (host) | 3004 |
| Frontend (host) | 5178 |

---

## Infrastructure

- **Host:** `vault_108`
- **Public URL:** `mood.dijibringabeeralong.co.za`
- **Password file:** `/root/.mood-admin.pwd` on vault_108
- **Data volume:** `/home/aldus/app_data/mood` on vault_108 → `/data` in container

---

## Out of Scope (v2)

- Charts / trend visualisation
- Combined mood + energy entry in one tap session
- Notes / free text attached to an entry
- Reminders / push notifications
- Export
- ~~Delete individual entries~~ (included)
