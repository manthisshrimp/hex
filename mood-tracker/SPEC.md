# Mood Tracker — Specification

## Overview

A minimal mobile-first app for recording feelings, mood and drive throughout the day. The defining principle is **zero friction** — a single tap records an event with no forms, no confirmations, no loading spinners in the way.

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
│  FEELING       MOOD   DRIVE  │
│  ○ angry        ●       ●    │
│  ○ irritable    ●       ●    │
│  ○ stressed     ●       ●    │
│  ○ anxious      ●       ●    │
│  ○ …            ●       ●    │
│                 ●       ●    │
│                 ●       ●    │
│                              │
│  [  History  ]               │
└──────────────────────────────┘
```

**Feeling circles** — a vertical list, each showing an emoji icon with its name alongside:

See the palette below for the full list. Tap → ripple animation + circle briefly
fills solid → POST to backend.

**Mood and drive circles** — two columns of 7 circles each, headed `MOOD` and `DRIVE`. Each circle uses the gradient color scale. Tap → same ripple + fill animation → POST to backend.

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
│  │ 11:05  😁 mood — upbeat│  │
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
- Each entry shows: time (HH:MM), emoji icon, label (feeling name, or "mood — upbeat" / "drive — empty"), and a delete button (trash icon)
- Tapping delete removes the entry immediately (optimistic) and calls `DELETE /api/entries/:id`
- Initial load: 30 entries
- Scroll-triggered load: 20 more entries per page
- No pagination controls — scroll is the only mechanism

---

## Data Model

```typescript
interface Entry {
  id: string;           // UUID
  type: 'feeling' | 'mood' | 'drive';
  value: string;        // feeling name (e.g. "irritable") or scale level "1"-"7"
  recordedAt: string;   // ISO 8601 timestamp
}
```

Storage: `data/entries.jsonl` — one JSON object per line, append-only.

```jsonl
{"id":"e-001","type":"feeling","value":"anxious","recordedAt":"2026-04-11T14:32:00Z"}
{"id":"e-002","type":"mood","value":"6","recordedAt":"2026-04-11T11:05:00Z"}
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
{ "type": "feeling", "value": "anxious" }
```
or
```json
{ "type": "drive", "value": "4" }
```

Server sets `id` (UUID) and `recordedAt` (current UTC timestamp). Returns the full `Entry`.

### GET /api/entries

- `limit` — number of entries to return (default 30, max 100)
- `before` — ISO timestamp; return entries recorded before this time (for pagination)

Returns entries sorted newest-first. `hasMore: true` if more entries exist before the oldest one returned.

---

## Feelings — Labels and Colors

| Feeling | Icon | Color | Hex |
|---------|------|-------|-----|
| angry | 😡 | Red | `#ef4444` |
| irritable | 😤 | Orange | `#f97316` |
| stressed | 😫 | Purple | `#8b5cf6` |
| anxious | 😰 | Sky blue | `#38bdf8` |
| over-stimulated | 🤯 | Amber | `#f59e0b` |
| under-stimulated | 😑 | Stone | `#78716c` |
| tired | 😴 | Slate | `#64748b` |
| sad | 😢 | Indigo | `#6366f1` |
| lonely | 🫂 | Gray | `#94a3b8` |

---

## The Two Scales

Two independent 7-point scales, recorded as separate taps.

**Mood** — how good or bad you feel (valence).
**Drive** — how much you want to do things (motivation), independent of mood.

The pair is what makes the record useful: *flat mood + no drive* (depleted after a
busy day) looks nothing like *low mood + no drive* (depressed), and the old
single scale could not tell them apart.

Level 4 is neutral (gray) on both. Above 4 is positive (green → blue), below is
negative (yellow → red). Colors are shared between the scales.

| Level | Mood | Drive | Color | Hex |
|-------|------|-------|-------|-----|
| 7 | 🚀 to the moon | 🔥 unstoppable | Blue | `#3b82f6` |
| 6 | 😁 upbeat | 💪 keen | Teal | `#14b8a6` |
| 5 | 🙂 breezy | 👍 willing | Green | `#22c55e` |
| 4 | 😐 flat | 😐 coasting | Gray | `#94a3b8` |
| 3 | 😔 weary | 😪 dragging | Yellow | `#eab308` |
| 2 | 😞 shadowed | 🪫 empty | Orange | `#f97316` |
| 1 | 🛌 buried | 🧱 immovable | Red | `#ef4444` |

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

The same feeling/mood/drive level can be recorded multiple times in quick succession. The history will show each tap as a separate entry. There is no cooldown or deduplication.

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
- Combined feeling + mood + drive entry in one tap session
- Notes / free text attached to an entry
- Reminders / push notifications
- Export
- ~~Delete individual entries~~ (included)
