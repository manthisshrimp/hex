# Habits — Technical Specification

Game rules are defined in `RULES.md`. This document covers implementation only.

## Tech Stack

- **Backend:** Rust (Axum + Tokio), same pattern as expense-tracker and sheep-dashboard
- **Frontend:** React + Vite (SPA)
- **Storage:** JSONL files + JSON snapshots (no database)
- **Auth:** Single-password SHA256 token (same pattern as all other apps)
- **Deployment:** Docker + Ansible

## Ports

| Service | Port |
|---------|------|
| Backend | 3010 |
| Frontend | 5180 |

---

## Tunable Constants

All game constants live in `backend/game.js`. Business logic imports them from
there so balance changes never touch formulas.

```js
const GAME = {
  MAX_HP: 100,
  BASE_REGEN: 3,                   // HP/day per habit at 100% consistency, low importance
  BASE_DAMAGE: 15,                  // HP per miss at 100% maturity, low importance
  IMPORTANCE: { low: 1, medium: 1.5, high: 2 },
  COMPLETION_GOLD_BASE: 10,
  PASSIVE_GOLD_BASE: 5,
  RESCHEDULE_COST_BASE: 50,
  RESCHEDULE_EXTENSION_FRACTION: 0.5,
  CONSISTENCY_WINDOW_DAYS: 30,
  CONSISTENCY_WINDOW_CYCLES: 10,   // for windowed habits
};
```

---

## Data Model

### habits.jsonl

One JSON object per line. Append-only; pausing sets `active: false`.
Hard-delete is only permitted when the habit has no completions and `system` is false.

```ts
interface Habit {
  id: string;
  name: string;
  importance: 'low' | 'medium' | 'high';
  frequency: 'daily' | 'windowed';
  window_days: number;   // 1 for daily; 7 / 14 / 30 / etc for windowed
  active: boolean;
  system: boolean;       // true = built-in, cannot be paused/edited/deleted
  created_at: string;    // ISO datetime
}
```

#### System habit

On first run (empty `habits.jsonl`), the backend seeds one system habit:

```json
{
  "id": "system-open-app",
  "name": "Open the app",
  "importance": "low",
  "frequency": "daily",
  "window_days": 1,
  "active": true,
  "system": true,
  "created_at": "<server start time>"
}
```

This habit is auto-completed for the current day at the start of
`GET /api/character` (before the tick runs), if not already completed today.

### completions.jsonl

```ts
interface Completion {
  id: string;
  habit_id: string;
  completed_at: string;  // ISO datetime
}
```

All completions are stored. Only the first per cycle is considered valid for
game purposes (consistency, gold). The storage layer does not enforce this —
the tick engine does.

### health_events.jsonl

Append-only. Used for HP history chart and audit.

```ts
interface HealthEvent {
  id: string;
  type: 'damage' | 'regen';
  amount: number;         // always positive
  reason: string;         // e.g. "missed: Morning Run", "daily regen"
  habit_id: string | null;
  tick_date: string;      // YYYY-MM-DD of the tick that generated it
}
```

### gold_events.jsonl

```ts
interface GoldEvent {
  id: string;
  type: 'completion_bonus' | 'passive_income' | 'reschedule_cost';
  amount: number;         // positive = earn, negative = spend
  reason: string;
  habit_id: string | null;
  timestamp: string;      // ISO datetime
}
```

### deadlines.json

Keyed by habit_id. Updated atomically on each tick or completion/reschedule.

```ts
// { [habit_id: string]: string }  — value is ISO date YYYY-MM-DD
```

Initial values set on habit creation:
- Daily: end of creation day (`created_at` date)
- Windowed: `created_at_date + window_days`

### character.json

Snapshot updated at the end of each tick. Source of truth for current HP
and gold displayed in the UI.

```ts
interface Character {
  hp: number;              // 0–100, always an integer
  gold: number;            // non-negative integer
  last_tick_date: string;  // YYYY-MM-DD
}
```

---

## Tick Engine (`backend/tick.js`)

The tick engine is the only place that writes to `character.json`,
`health_events.jsonl`, `gold_events.jsonl`, and `deadlines.json` during
normal play.

### Trigger

Called at the start of `GET /api/character`. If `last_tick_date < today (UTC)`,
run one tick per elapsed day in chronological order.

### Per-day algorithm

```
for each day D from (last_tick_date + 1) to today:
  for each active habit H:
    consistency = computeConsistency(H, D)
    maturity    = consistency

    if deadline[H] < D:
      damage = BASE_DAMAGE × IMPORTANCE[H.importance] × maturity
      hp -= damage
      append health_event(type=damage, ...)
      deadline[H] = deadline[H] + H.window_days   // reset from missed date

    regen = BASE_REGEN × IMPORTANCE[H.importance] × consistency
    hp += regen
    append health_event(type=regen, ...)

    passive = PASSIVE_GOLD_BASE × IMPORTANCE[H.importance] × consistency²
    gold += passive
    append gold_event(type=passive_income, ...)

  hp   = clamp(floor(hp), 0, MAX_HP)
  gold = floor(gold)
  write character.json { hp, gold, last_tick_date: D }
  write deadlines.json
```

Order within a day: damage first, then regen. This means a player who misses
and has regen cannot recover the same day's damage in a single tick.

### Consistency calculation

```
computeConsistency(habit, asOfDate):
  if habit.frequency == 'daily':
    window_start = asOfDate - CONSISTENCY_WINDOW_DAYS
    days_in_window = CONSISTENCY_WINDOW_DAYS
    completed_days = count distinct calendar days in completions
                     where habit_id=H.id and date in [window_start, asOfDate)
    return completed_days / days_in_window

  if habit.frequency == 'windowed':
    find the last CONSISTENCY_WINDOW_CYCLES deadline boundaries before asOfDate
    count how many of those cycles had at least one valid completion
    return completed_cycles / CONSISTENCY_WINDOW_CYCLES
```

A habit created fewer than `CONSISTENCY_WINDOW_DAYS` days ago uses the actual
days elapsed as the denominator (not the full 30), so a habit completed every
day since creation shows 100% consistency.

---

## Completion Flow (`POST /api/habits/:id/complete`)

1. Write completion record to `completions.jsonl`.
2. Determine if this is the first valid completion in the current cycle:
   - Current cycle = between `last_deadline - window_days` and `next_deadline`
   - If another completion already exists in this window, stop (return 200, no gold).
3. Award completion gold: `COMPLETION_GOLD_BASE × importance × (2 − consistency)`.
4. Append gold event.
5. Advance deadline: `completion_date + window_days`.
6. Update `deadlines.json` and `character.json`.

---

## Reschedule Flow (`POST /api/habits/:id/reschedule`)

1. Reject if habit is daily.
2. Count reschedules since last completion (`reschedule_count_this_cycle`).
3. Compute cost: `RESCHEDULE_COST_BASE × importance × (1 + reschedule_count_this_cycle)`.
4. Reject if `character.gold < cost`.
5. Extend deadline: `current_deadline + floor(window_days × RESCHEDULE_EXTENSION_FRACTION)`.
6. Deduct gold, append gold event, update `deadlines.json` and `character.json`.

---

## API Routes

All routes except `/health` and `/api/auth` require `X-Admin-Token` header.

```
GET    /health
POST   /api/auth                        { password } → { token }

GET    /api/character                   → { hp, gold } + triggers tick
GET    /api/habits                      → Habit[] each with { consistency, next_deadline, reschedule_cost }
POST   /api/habits                      → create habit, set initial deadline
PUT    /api/habits/:id                  → update { name, importance, active } (reject if system=true)
DELETE /api/habits/:id                  → hard delete (reject if any completions exist or system=true)

POST   /api/habits/:id/complete         → log completion, award gold if first in cycle
POST   /api/habits/:id/reschedule       → spend gold to extend deadline

GET    /api/history/hp                  → HealthEvent[] last 30 days
GET    /api/history/gold                → GoldEvent[] last 30 days
GET    /api/history/completions         → Completion[] last 30 days
```

---

## Frontend Pages

### Dashboard (`/`)

- HP bar: green >70, yellow 30–70, red <30, burnout state at 0
- Gold balance
- **Due today / overdue:** all active habits with `next_deadline <= today`, each with a Complete button
- **Upcoming:** windowed habits due in the next 7 days

### Habits (`/habits`)

- Active habits list, then paused habits list
- Per row: name, importance badge, frequency label, consistency %, next deadline, maturity bar
- Add habit button → modal (name, importance, frequency, window_days if windowed)
- Edit / pause / delete per habit (delete requires confirmation; disabled if completions exist)
- Reschedule button on windowed habits showing cost; disabled if insufficient gold

### History (`/history`)

- HP line chart — last 30 days, one data point per day
- Per-habit heatmap — GitHub-style, last 30 days, one cell per day
- Gold balance line chart — last 30 days

---

## File Inventory

```
habits/
├── backend-rust/
│   ├── Cargo.toml
│   └── src/main.rs
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── pages/
│   │       ├── DashboardPage.jsx
│   │       ├── HabitsPage.jsx
│   │       └── HistoryPage.jsx
│   ├── nginx.conf            ← SPA routing + sw.js no-cache (if PWA)
│   ├── vite.config.js
│   └── package.json
├── Dockerfile.backend        ← multi-stage Rust build (same pattern as expense-tracker)
├── Dockerfile.frontend       ← node builder → nginx:alpine
├── docker-compose.yml        ← dev (hot-reload volumes)
├── docker-compose.prod.yml   ← prod (bind-mounts for /data and password file)
└── ansible/
    ├── ansible.cfg
    ├── inventory
    ├── playbooks/deploy-habits.yml
    └── roles/habits/
        ├── tasks/main.yml
        ├── templates/habits.service.j2
        └── handlers/main.yml
```

---

## Infrastructure

| Property | Value |
|---|---|
| Host | vault_108 (10.227.6.227) |
| Public URL | habits.dijibringabeeralong.co.za |
| Password file | `/root/.habits-admin.pwd` on vault_108 |
| Data volume (host) | `/home/aldus/app_data/habits` |
| Data volume (container) | `/data` |
| Ansible playbook | `habits/ansible/playbooks/deploy-habits.yml` |

### Deployment steps

1. Run Ansible playbook (rsync → Docker rebuild → systemd restart → health check)
2. Add `habits.dijibringabeeralong.co.za` vhost to cori_celesti nginx config and redeploy cori_celesti

---

## V1 Exclusions

- PWA (add `vite-plugin-pwa`, icons, sw.js nginx header when ready)
- Character avatar and name
- Party / federation endpoint (`GET /api/character/public`)
- Unlock and achievement system
- Gold shop beyond reschedules

---

## Boss Quests API

### Peer endpoints (no auth — server-to-server)

#### GET /api/boss/active
Returns the host's canonical quest state, or `null` when no active quest or
after `ended_at + 30 days`.

```json
{
  "questId": "uuid",
  "bossId": "gloomfang",
  "hostUrl": "https://...",
  "startedAt": "YYYY-MM-DD",
  "durationDays": 7,
  "endsAt": "YYYY-MM-DD",
  "hpPool": 4.2,
  "hpRemaining": 3.1,
  "status": "active",
  "endedAt": null,
  "contributions": {
    "https://member": { "lastDate": "YYYY-MM-DD", "total": 1.1 }
  }
}
```

#### POST /api/boss/participants
Body: `{ "url": "https://..." }`
Idempotent. Grows `hpPool` and `hpRemaining` by `durationDays × threshold` per new joiner.
Response: `{ "ok": true }`

#### POST /api/boss/contribute
Body: `{ "url": "https://...", "date": "YYYY-MM-DD", "p": 0.8 }`
Idempotent per `(url, date)`. Subtracts `p` from `hpRemaining`. Flips
`status = "ended"` when `hpRemaining ≤ 0` or window closes.
Response: `{ "hpRemaining": 2.3, "status": "active" }`

### Owner endpoints (auth: X-Admin-Token)

#### POST /api/boss/launch
Body: `{ "bossId": "gloomfang" }`
Boss must be in `revealed`. No quest must be active.
Response: `{ "ok": true }`

#### POST /api/boss/join
Body: `{ "hostUrl": "https://..." }`
Fetches host `/api/boss/active`, snapshots, calls host `/api/boss/participants`.
Response: `{ "ok": true }`

#### POST /api/boss/abandon
Marks participation as abandoned.
Response: `{ "ok": true }`

#### GET /api/boss
Returns the full UI aggregate: active quest (with shared HP, leaderboard, gear
durability), revealed bosses, party invitations, recent quests (last 30 days).
Also polls party peers for invitations and flushes the contribution outbox.

```json
{
  "active": {
    "boss": { "...BossDef fields..." },
    "quest": { "...HostedQuest shape..." },
    "myContribution": 1.1,
    "myContributedToday": true,
    "gear": [{ "slot": "weapon", "name": "Iron Sword", "durability": 80, "max": 100 }],
    "leaderboard": [{ "url": "https://...", "total": 1.1 }]
  },
  "revealed": [{ "...BossDef..." }],
  "invitations": [{ "hostUrl": "...", "boss": { "...BossDef..." }, "participants": 3 }],
  "recent": [{ "boss": { "...BossDef..." }, "outcome": "victory", "brokenGear": ["Rusted Blade"], "resolvedAt": "YYYY-MM-DD" }]
}
```
