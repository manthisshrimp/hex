# Habits — Boss Quests Dev Plan (agent workflow)

Implements [`BOSS_QUESTS_SPEC.md`](./BOSS_QUESTS_SPEC.md) in **one phase**, with
**multi-node distribution built in from the start** (no solo-only stepping
stone). Designed to be executed by a workflow of agents.

## Principles for the workflow

1. **Single-owner files.** Every source file is edited by exactly one task. Tasks
   in the same wave never touch the same file, so they can run in parallel
   without merge conflicts. The file→task map is [§2](#2-file-ownership-map).
2. **Fixed API contract first.** [§3](#3-api-contract) is the frozen interface
   between backend and frontend tasks — both sides build against it without
   waiting on each other.
3. **Build gates.** Pure modules (`game.rs`, `tick.rs`, catalogue) carry
   `cargo test` units and must pass standalone. Handler/wiring tasks may not
   `cargo build` green until the **integration task** (`T-INT`) declares modules
   and routes; that task is the first point the whole crate compiles.
4. **No new dependencies.** Reuse `reqwest` (already in `party.rs`), `chrono`,
   `serde`, `uuid`. The boss store copies `PartyStore` verbatim in shape.
5. **Caveman/ponytail apply to code, not the contract.** Smallest change that
   satisfies the spec; mark deliberate shortcuts with `// ponytail:`.

## 1. Build order (waves)

```
Wave 0   T1 models ──────────────────────────────────────────┐ (blocks all BE)
                                                              │
Wave 1   T2 catalogue   T3 store   T4 game-math   T5 gear-init │ (parallel)
                                                              │
Wave 2   T6 tick   T7 boss-handlers   T9 reveal               │ (parallel)
                                                              │
Wave 3   T8 character-tick-wiring                             │ (serial; needs T6+T7)
                                                              │
Wave 4   T-INT main.rs (mods + routes + call-site defaults)   │ (crate compiles here)
                                                              │
Wave 5   T12 api.js ── T13 BossPage ── T14 banner ── T15 nav  │ (FE; T13/14 need T12)
                                                              │
Wave 6   T-TEST multi-node   T-DOCS rules/spec                │ (parallel)
Wave 7   T-REVIEW                                             ┘
```

Frontend (Wave 5) can start as soon as the contract (§3) is frozen — it does not
need the backend to compile, only the agreed JSON. Run it in parallel with
Waves 1–4 if desired; it only needs a live backend at `T-TEST`.

## 2. File ownership map

| File | Owner task | New? |
|---|---|---|
| `backend-rust/src/models.rs` | **T1** | edit |
| `backend-rust/src/bosses_catalogue.rs` | **T2** | new |
| `backend-rust/src/storage/boss.rs` | **T3** | new |
| `backend-rust/src/storage/mod.rs` | **T3** | edit |
| `backend-rust/src/game.rs` | **T4** | edit |
| `backend-rust/src/handlers/equipment.rs` | **T5** | edit |
| `backend-rust/src/handlers/shop.rs` | **T5** | edit |
| `backend-rust/src/tick.rs` | **T6** | edit |
| `backend-rust/src/handlers/boss.rs` | **T7** | new |
| `backend-rust/src/handlers/mod.rs` | **T7** | edit |
| `backend-rust/src/random_events_catalogue.rs` | **T9** | edit |
| `backend-rust/src/handlers/random_event.rs` | **T9** | edit |
| `backend-rust/src/handlers/character.rs` | **T8** | edit |
| `backend-rust/src/lib.rs` | **T-INT** | edit |
| `backend-rust/src/main.rs` | **T-INT** | edit |
| `frontend/src/api.js` | **T12** | edit |
| `frontend/src/pages/BossPage.jsx` (+ components) | **T13** | new |
| `frontend/src/pages/DashboardPage.jsx` | **T14** | edit |
| `frontend/src/App.jsx` (nav/routes) | **T15** | edit |
| `RULES.md`, `SPEC.md` | **T-DOCS** | edit |
| `BOSS_QUESTS_TEST.md` + test script | **T-TEST** | new |

> Top-level modules are declared in `lib.rs` (not `main.rs`). `T-INT` is the
> **sole** editor of both: it adds `pub mod bosses_catalogue;` to `lib.rs`, the
> boss route lines + any `TickInput{..}` call-site default fields to `main.rs`.
> No other task touches either, so module/route wiring never conflicts.

## 3. API contract (frozen)

All JSON camelCase (serde `rename_all = "camelCase"`). Auth = `X-Admin-Token`
unless marked **no-auth** (peer-to-peer, mirrors `/api/party/public`).

### Peer endpoints (no-auth)

- `GET /habits/api/boss/active` → the host's canonical quest, or `null`:
  ```json
  {
    "questId":"uuid","bossId":"gloomfang","hostUrl":"https://...",
    "startedAt":"2026-06-29","durationDays":7,"endsAt":"2026-07-06",
    "hpPool":4.2,"hpRemaining":3.1,"status":"active","endedAt":null,
    "contributions":{ "https://a":{"lastDate":"2026-06-30","total":1.1} }
  }
  ```
  Returns `null` once `endedAt + 30d` has passed.
- `POST /habits/api/boss/participants` `{ "url":"https://..." }` → `{ "ok":true }`.
  Host adds member: `contributions[url]={lastDate:"",total:0}`, grows `hpPool`
  and `hpRemaining` by `D×θ`. Idempotent.
- `POST /habits/api/boss/contribute` `{ "url":"...","date":"2026-06-30","p":0.8 }`
  → `{ "hpRemaining":2.3,"status":"active" }`. Applies only if
  `date > contributions[url].lastDate` and `status=="active"` and `url` is a
  participant; else no-op with current state. Flips `status="ended"`,
  `endedAt=today` when `hpRemaining<=0`.

### Owner endpoints (auth)

- `POST /habits/api/boss/launch` `{ "bossId":"gloomfang" }` → `{ "ok":true }`.
  Requires the boss be in `revealed`, no active quest. Creates `hosted` (self as
  first participant, `hpPool=1×D×θ`) and local `participating`; drops it from
  `revealed`.
- `POST /habits/api/boss/join` `{ "hostUrl":"https://..." }` → `{ "ok":true }`.
  No active quest. GET host `/active`, snapshot into `participating`, then POST
  host `/participants`.
- `POST /habits/api/boss/abandon` → `{ "ok":true }`. Clears `participating`
  (`outcome="abandoned"` kept in recent); best-effort host notify.
- `GET /habits/api/boss` → UI aggregate:
  ```json
  {
    "active": {
      "boss": { /* BossDef */ },
      "quest": { /* /active shape, host-polled */ },
      "myContribution": 1.1, "myContributedToday": true,
      "gear": [ {"slot":"weapon","name":"...","durability":62,"max":100} ],
      "leaderboard": [ {"url":"...","total":1.1} ]
    },
    "revealed":  [ { /* BossDef */ } ],
    "invitations":[ {"hostUrl":"...","boss":{/*BossDef*/},"participants":3} ],
    "recent":    [ {"boss":{/*BossDef*/},"outcome":"victory",
                    "brokenGear":["Rusted Blade"],"resolvedAt":"2026-07-06"} ]
  }
  ```

### BossDef (serialized)

`id,name,lore,tier,durationDays,threshold,damageMultiplier,rewardGold,rewardItem,rewardItemChance,rewardHeal,rewardHealChance`.

---

## 4. Task briefs

Each brief is self-contained: an agent gets the spec link, this plan, its file(s),
and its acceptance check. **Suggested agent type** in parentheses.

### T1 — Models & state structs (cavecrew-builder)
**File:** `models.rs`.
Add, per [spec §6](./BOSS_QUESTS_SPEC.md#6-data-model--shared-hp-host-owned-canonical-state):
`BossState`, `HostedQuest`, `MemberContribution`, `Participation`,
`DailyContribution`, `RevealedBoss` (all `#[serde(rename_all="camelCase")]`,
`Default` where a store needs it). Add `max_durability: u32`
(`#[serde(default = ...)]` → 100) to `Item`. Add
`durability: HashMap<String,u32>` (`#[serde(default)]`) to `EquipmentState`.
Add request bodies: `LaunchBossRequest{boss_id}`, `JoinBossRequest{host_url}`,
`ParticipantRequest{url}`, `ContributeRequest{url,date,p}`.
**Accept:** `cargo build` of the crate may still fail elsewhere, but
`cargo test --lib models` passes; a round-trip serde test on `HostedQuest`
asserts camelCase keys (`hpRemaining`, `bossId`).

### T2 — Boss catalogue (cavecrew-builder)
**File:** `bosses_catalogue.rs` (new). Mirror `random_events_catalogue.rs`
shape: `pub struct BossDef{...}`, `pub fn catalogue() -> Vec<BossDef>` with 3–4
bosses spanning `threshold` 0.5–0.9, `durationDays` 5–14,
`damageMultiplier` 1.25–2.0, reward fields filled (item ids must exist in
`items.json`). `pub fn find(id:&str)->Option<BossDef>`.
**Accept:** `cargo test --lib bosses_catalogue` — a test asserts every
`reward_item` id is `Some`→nonempty and `threshold ∈ (0,1]`. (Module is declared
by `T-INT`; until then test via `#[cfg(test)]` in-file is fine.)

### T3 — Boss store (cavecrew-builder)
**Files:** `storage/boss.rs` (new), `storage/mod.rs` (edit).
Copy `storage/party.rs` exactly, swap `PartyState`→`BossState`, file
`boss.json`. In `mod.rs`: `pub mod boss; pub use boss::BossStore;`, add
`pub boss: BossStore` to `AppStore`, init in `new()` and the constructor.
**Accept:** `cargo test --lib storage::boss` round-trips an empty + populated
`BossState` to a temp dir.

### T4 — Fight math & gear-wear helpers (cavecrew-builder)
**File:** `game.rs`.
Pure, unit-tested helpers per [spec §3](./BOSS_QUESTS_SPEC.md#3-difficulty--fight-math)/§4:
- `daily_completion(due:u32, done:u32)->f64` — `done/due` clamped `[0,1]`;
  `due==0 ⇒ 1.0`.
- `hp_pool(participants:u32, duration_days:u32, threshold:f64)->f64`.
- `apply_wear(equipment:&EquipmentState, wear:u32)->(EquipmentState, Vec<String>)`
  — subtract `wear` from each equipped item's durability (missing = max via a
  passed `max_for(id)` closure or default), return updated state + broken item
  ids (≤0 → removed from `equipped`+`inventory`+`durability`).
**Accept:** `cargo test` — `daily_completion(0,0)==1.0`, `(3,4)==0.75`,
`hp_pool(3,7,0.6)≈12.6`, and a wear test that breaks an item at exactly 0.

### T5 — Durability init on acquire (cavecrew-builder)
**Files:** `handlers/equipment.rs`, `handlers/shop.rs`.
When an item enters inventory (shop buy) or is first equipped, ensure
`equipment.durability[id]` exists, initialised to the item's `max_durability`.
**Accept:** `cargo build` of these handlers; a `curl` note in the brief: buying
an item then `GET /api/equipment` shows full durability. (Behavioural check
deferred to `T-TEST`.)

### T6 — Tick integration (cavecrew-builder)
**File:** `tick.rs`.
Extend `TickInput` with `boss_damage_multiplier: f64` (default 1.0) and the boss
window (`boss_active_days: Vec<NaiveDate>` or start/end). Multiply each
`miss_damage(...)` by `boss_damage_multiplier`. Extend `TickOutput` with
`boss_contributions: Vec<DailyContribution>` (one `{date,p}` per boss-day in the
catch-up span, computing `due/done` from the habits+deadlines+completions it
already iterates) and `gear_wear: u32` (`wear_boss_day × boss_days`).
Keep `process_tick` **pure**.
**Accept:** `cargo test` — new units: multiplier scales damage; a 2-day catch-up
over an active window yields 2 `boss_contributions` with correct `p`; no boss →
empty contributions, multiplier 1.0, zero wear (regression: existing tick tests
still pass).

### T7 — Boss handlers + reveal store hook (general-purpose)
**Files:** `handlers/boss.rs` (new), `handlers/mod.rs` (edit: `pub mod boss;`).
Implement every endpoint in [§3](#3-api-contract): `get_active`, `participants`,
`contribute` (no-auth) and `launch`, `join`, `abandon`, `get_boss` (auth).
Reuse `party.rs`'s `make_client()`/`habits_url()` pattern for `join`'s outbound
calls. Host applies contributions idempotently; flips `ended` on `hp<=0` or
window close. `get_boss` polls party peers' `/active` for invitations (5 s
client) and assembles the aggregate. Local self-resolution + reward grant
(gold always; item/heal by chance via an `rng` roll like `gold_roll_bonus`)
guarded by `participating.reward_claimed`.
**Accept:** `cargo build` (pending `T-INT` for routes/mod of catalogue —
note in brief). Provide a `#[cfg(test)]` unit for the pure idempotency rule
(`contribute` twice same date chips once) by factoring it into a testable fn.

### T8 — Character tick wiring (general-purpose)
**File:** `handlers/character.rs`.
Where the day-tick catch-up runs `process_tick`: pass
`boss_damage_multiplier`/window from the active `participating` boss. After the
tick, apply `gear_wear` via `game::apply_wear`, persist durability + append
broken ids to `participating.broken_gear`; for each new `boss_contributions`
entry, **POST to host** `/api/boss/contribute` (or apply to own `hosted`
in-process when host==self), advancing `last_contributed_date`; on failure queue
in `outbox` and retry the outbox here too. Then run the end-resolution check
(host ended / local `ends_at` passed → resolve + reward once).
**Accept:** compiles after `T-INT`; the multi-node behaviour is proven in
`T-TEST`. Brief must call out: idempotency (no double contribution across
repeated ticks) and reward-once.

### T9 — Encounter → boss reveal (cavecrew-builder)
**Files:** `random_events_catalogue.rs`, `handlers/random_event.rs`.
Add `reveals_boss: Option<&'static str>` to `EventDef` (default `None`) and ≥1
new event whose resolution reveals a boss. In `resolve`/`choose`, when
`reveals_boss` is set, push `RevealedBoss{boss_id,revealed_at}` into
`store.boss` (dedup by `boss_id`), alongside the normal outcome.
**Accept:** `cargo build`; in-file test that an event with `reveals_boss=Some`
produces a dedup'd `revealed` entry.

### T-INT — Integration: modules & routes (cavecrew-builder)
**Files:** `lib.rs`, `main.rs`.
Add `pub mod bosses_catalogue;` to `lib.rs`. In `main.rs`, register the 7 boss
routes (peer + owner) in the `Router`, ordered so `/api/boss/active` etc.
precede any `/:id` catch-alls. Fill new `TickInput { .. }` fields at the call
site if not already defaulted.
**Accept:** **`cargo build` and `cargo test` of the whole crate pass green.**
This is the backend's compile gate.

### T12 — Frontend API client (cavecrew-builder)
**File:** `frontend/src/api.js`.
Add: `getBoss`, `launchBoss(bossId)`, `joinBoss(hostUrl)`, `abandonBoss()`
against the auth endpoints in [§3](#3-api-contract). (Peer endpoints are
server-to-server; the UI never calls them directly.)
**Accept:** `npm run build` succeeds; exports present.

### T13 — Boss tab (general-purpose)
**Files:** `frontend/src/pages/BossPage.jsx` (+ small components).
Render per [spec §9](./BOSS_QUESTS_SPEC.md#9-ui): shared HP bar
(`1 − hpRemaining/hpPool`), days left, my-contribution-today, damage-multiplier
warning, gear durability strip, **leaderboard** from `contributions`, revealed
bosses with a **Launch** button, **invitations** with **Join**, recent quests,
and the end-summary modal (reuse `checkin-overlay`/`checkin-panel` classes).
**Accept:** `npm run build`; verified against a live backend in `T-TEST` with
`dev-browser` screenshots.

### T14 — Dashboard banner (cavecrew-builder)
**File:** `frontend/src/pages/DashboardPage.jsx`.
When `getBoss().active` exists, render a top strip (boss name, % felled, days
left, advanced-today) using existing `SectionHeader`/overlay styling. Link to
the Boss tab.
**Accept:** `npm run build`; banner shows/hides on active state.

### T15 — Nav / route wiring (cavecrew-builder)
**File:** `frontend/src/App.jsx`.
Add the Boss tab to nav and its route to `BossPage`.
**Accept:** `npm run build`; tab navigates client-side (no full reload).

### T-DOCS — Rules & API docs (cavecrew-builder)
**Files:** `RULES.md`, `SPEC.md`.
Document the boss mechanic in `RULES.md` (math, gear, rewards) and the 7
endpoints in `SPEC.md`.
**Accept:** docs match the shipped contract.

### T-TEST — Multi-node integration test (general-purpose)
**Files:** `BOSS_QUESTS_TEST.md` + a script.
Spin **two backend instances** (two ports, two data dirs; reuse the dev docker
setup or `cargo run` twice). Script the flow:
1. node A `launch`; `GET A/active` shows `hpPool = 1×D×θ`.
2. node B `join A`; `GET A/active` shows 2 participants, pool grown to `2×D×θ`.
3. both `contribute` for a date; shared `hpRemaining` drops by the sum; a
   **repeat** contribute for the same date is a **no-op** (idempotency).
4. drive contributions until `hpRemaining<=0`; `status` flips `ended`; both
   nodes' `GET /api/boss` report **victory** and grant the reward **once**.
5. a defeat run (window closes with HP left) → both report defeat + gear wear.
**Accept:** the script asserts each step; gear that broke appears in `recent`.

### T-REVIEW — Final review (cavecrew-reviewer)
Review the full diff: idempotency of `contribute`, reward-once, pool growth on
join, `null` after 30-day expiry, no panics on unreachable host (outbox path),
serde camelCase parity with the contract, and that no file was edited by two
tasks. Output severity-tagged findings; block on Highs.

---

## 5. Dispatch recipe

1. Freeze [§3](#3-api-contract). Hand each agent: the spec, this plan, its brief,
   its file(s), its accept check.
2. **Wave 0:** run `T1` alone.
3. **Wave 1:** `T2 T3 T4 T5` in parallel.
4. **Wave 2:** `T6 T7 T9` in parallel.
5. **Wave 3:** `T8`.
6. **Wave 4:** `T-INT` → confirm `cargo test` green. **Backend done.**
7. **Wave 5 (may overlap Waves 1–4):** `T12`, then `T13 T14 T15` in parallel;
   `npm run build` green.
8. **Wave 6:** `T-TEST` + `T-DOCS`.
9. **Wave 7:** `T-REVIEW`; fix Highs; re-run `cargo test` + `T-TEST`.

Deploy via the normal bundle path (`octiron: bash apps/hex/deploy.sh`) only after
`T-REVIEW` passes.
