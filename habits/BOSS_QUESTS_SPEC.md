# Habits — Boss Quests Spec (draft)

Status: **draft for review**. Sibling of `RULES.md` (game rules) and `SPEC.md`
(API). Defines the boss-quest feature: random-encounter reveals, gear
durability, multi-day co-op bosses, gear degradation, and the host/peer
distribution protocol over the existing party mesh.

Nothing here is built yet. Open decisions are collected in
[§11](#11-open-decisions). The recommended build order is in
[§10](#10-phasing).

---

## 1. The loop, in one paragraph

A **random encounter** can, instead of giving HP/gold, **reveal a boss**. A
revealed boss can be **launched** as a multi-day **quest**; the launcher is the
**host** and owns the **canonical boss state** — one **shared HP bar** the whole
party chips at together. Party members **opt in** by polling each other and
joining (free). For the quest's duration each participant, on their daily tick,
**reports the % of that day's due habits they completed** to the host, which
**subtracts it from the shared HP**. Everyone simultaneously **takes extra
damage** from every normal damage source (multiplier set by the boss), and
across the fight **equipped gear degrades**; gear that hits zero durability
**breaks**. If the party drops the shared HP to zero before the deadline,
**everyone wins** the reward (always gold, sometimes an item, sometimes
healing); otherwise the party **fails** — and either way the degraded/broken
gear is tallied in each member's end-of-quest **story summary**.

---

## 2. Core model — shared HP, host-coordinated

**Decided: shared / coordinated.** The party fights **one boss with one HP
bar**, and that bar is the **canonical state owned by the host**. Every
participant's daily completion chips the *same* shared HP. This is the model the
mechanic needs: each member's effort visibly influences the common boss.

How it coordinates:

- The **host** holds the authoritative `BossState`: shared `hp_remaining`, the
  pool, the roster, per-member contributions, and the lifecycle window.
- The host **publishes the full boss state** on a no-auth endpoint
  (`GET /api/boss/active`); all members poll it to render the fight.
- Each member, on their **daily tick**, computes their `p(d)` (% of that day's
  due habits completed) and **POSTs it to the host**
  (`POST /api/boss/contribute`). The host subtracts it from `hp_remaining`,
  **idempotently per member per date** (a re-tick / multi-device catch-up cannot
  double-count).
- The host decides the outcome: `hp_remaining ≤ 0` before `ends_at` →
  **victory for the whole party**; window closes with HP left → **defeat**. Host
  flips `status = ended` and the resolution is then visible to everyone polling.

**"Check against their version" under shared HP:** each member also keeps a
**local snapshot** (`ends_at`, last known state, their own reward-claimed flag).
When a poll shows the host **ended** — or the host is unreachable but the
member's snapshot says `today ≥ ends_at` — the member resolves its **own** view:
grant the reward once (guarded by a local `reward_claimed` flag so polling can't
re-grant), record broken gear, show victory/defeat. The host is the source of
truth for HP; the member's local copy is what lets it resolve and self-heal the
UI when the host is offline.

> **Host single point of failure (ponytail ceiling):** if the host is down
> during the fight, contributions can't be delivered and stall in a local outbox
> (retry next tick / on next `GET /api/boss`). Members still *see* the last
> polled HP. A fully host-independent CRDT tally is the upgrade path if host
> downtime turns out to matter; not worth it for a small trusted party.

---

## 3. Difficulty & fight math

A boss is calibrated so that **sustaining a target average completion rate over
the duration just defeats it**. That target *is* the difficulty knob.

Definitions, evaluated **per participant, per boss-day** `d`:

- `due(d)` = number of the participant's habits **due** on day `d` (daily habits
  are due every day; a windowed habit is due on the day its window closes).
- `done(d)` = how many of those due habits were completed on/by day `d`.
- **daily completion** `p(d) = done(d) / due(d)`, clamped to `[0, 1]`.
  If `due(d) == 0`, **`p(d) = 1.0`** (full credit — a day with nothing due is a
  full day of damage; rest days help the party). *Decided.*

Boss definition carries a difficulty **threshold** `θ ∈ (0, 1]` — the average
completion the party must sustain to win — and a **duration** `D` days.

**Shared HP scales with the roster** so difficulty (avg θ needed) is invariant
to party size — five people don't trivially fell a solo-tuned boss:

- The pool grows by `D × θ` **each time a member joins**:
  `hp_pool = participants × D × θ`. (`hp_remaining` starts at `hp_pool` and a
  late join adds `D × θ` to both.)
- Each boss-day, **each member** sends `p(d)`; the host subtracts it from
  `hp_remaining`. A member contributing perfectly delivers up to `D` over the
  fight — their own share (`D × θ`) **plus slack** that carries laggards. Strong
  members can cover weak ones; that *is* the co-op.
- **Victory** when `hp_remaining ≤ 0` before `ends_at` — equivalently when total
  party contribution `Σ_members Σ_days p ≥ participants × D × θ`, i.e. when the
  **party-average completion reaches θ**.

So an "avg 60%" boss is `θ = 0.6`; a brutal one `θ = 0.9`. UI shows
`1 − hp_remaining / hp_pool` as % felled.

> **Late-join ceiling (ponytail):** a member joining mid-fight raises the bar by
> a full `D × θ` while having fewer days left to contribute — slightly
> unfavourable to the party. Acceptable; a pro-rated `(remaining_days) × θ` join
> cost is the upgrade path if it bites.

### Extra damage taken (the boss hitting back)

While a participant has an active boss, **every normal damage source is
multiplied** by the boss's `damage_multiplier` (e.g. `1.5×`). This is a single
hook in `tick.rs` (see [§7](#7-where-it-plugs-into-the-engine)) — miss damage
becomes `miss_damage(...) × damage_multiplier`. No new damage *source* is
invented; existing misses simply bite harder during a boss.

### Victory rewards

On victory **every participant** is rewarded the same way (resolved locally when
the member sees `status = ended`, guarded by a `reward_claimed` flag):

- **Always:** `reward_gold` (a `GoldEvent`, type `boss_reward`).
- **Sometimes an item:** with probability `reward_item_chance`, grant
  `reward_item` (a catalogue id) into inventory — full durability. Reuse the
  existing RNG approach (`gold_roll_bonus`-style roll).
- **Sometimes healing:** with probability `reward_heal_chance`, restore
  `reward_heal` HP (a `HealthEvent`, type `regen`, clamped to `max_hp`).

Defeat grants nothing and applies the `wear_boss_fail` gear penalty
([§4](#4-gear-durability--degradation)).

---

## 4. Gear durability & degradation

Gear has **no durability today** — this feature introduces it.

### Data

- `Item` (catalogue) gains `max_durability: u32` with a serde default (e.g.
  `100`) so the existing `items.json` needs no edits.
- `EquipmentState` gains `durability: HashMap<String, u32>` (item id → current
  durability). An item's entry is initialised to its `max_durability` when first
  acquired/equipped; missing entry is treated as full.

> **Ceiling (ponytail):** durability is keyed by **item id**, so two copies of
> the same catalogue id would share a counter. Items are catalogue singletons in
> practice; per-instance durability (UUID per owned item) is the upgrade path if
> duplicates ever matter.

### Degradation triggers

Each event subtracts a flat amount from **every equipped** item's durability:

| Trigger | Per-item loss (tunable) |
|---|---|
| Resolving a random encounter | `wear_event` (e.g. 5) |
| Each boss-day survived | `wear_boss_day` (e.g. 8) |
| Losing a boss (failure penalty) | `wear_boss_fail` extra (e.g. 20) |

### Breaking

When an item's durability reaches `≤ 0` it **breaks**: removed from `equipped`
and `inventory`, its durability entry dropped, and the break recorded.

- A break **during a boss** is appended to that participant's
  `boss.participating.broken_gear` so it appears in the end-of-quest summary.
- A break **outside a boss** (from a random encounter) breaks immediately and is
  logged as a one-line encounter-history entry (reuse the existing
  `ResolvedRandomEvent` history injection used by party cheer).

**Gear is consumable — no repair (decided).** Broken gear is gone; the shop is
the gold sink for re-buying. This makes degradation a real stake in every boss.

---

## 5. Random encounter → boss reveal

`random_events_catalogue::EventDef` gains an optional
`reveals_boss: Option<&'static str>` (a boss catalogue id), plus at least one new
catalogue entry whose flavour is "a scout/rumour reveals a great beast."

On resolving such an event, in addition to its normal (possibly zero) hp/gold
outcome, push a `RevealedBoss { boss_id, revealed_at }` into the boss store's
`revealed` list (dedup by `boss_id`). Revealed bosses appear in the Boss tab as
**launchable**. Reveal does **not** auto-start anything — the player chooses to
rally the party.

Optionally a reveal can be **random among bosses** rather than fixed per event
(weight by tier). Default to fixed-per-event for predictability; note as minor
open decision.

---

## 6. Data model — shared HP, host-owned canonical state

New single-JSON store `boss.json` (mirrors `PartyStore`: cached, pretty-printed,
whole-file rewrite). **One active quest at a time** per node (decided). The node
plays **both roles**: it is the canonical `host` for a quest it launched, and a
`participant` (with a local mirror) for whatever quest it is in — its own or
someone else's.

```rust
struct BossState {
    /// Canonical state — present only on the node that HOSTS the active quest.
    /// This is the source of truth for shared HP. Served via /api/boss/active.
    hosted: Option<HostedQuest>,
    /// The quest THIS node is fighting in (its own or a peer's). Local mirror +
    /// per-node bookkeeping the host doesn't track. None when not in a quest.
    participating: Option<Participation>,
    /// Bosses surfaced by encounters, available to launch.
    revealed: Vec<RevealedBoss>,
}

struct HostedQuest {
    quest_id: String,       // uuid
    boss_id: String,        // catalogue id
    host_url: String,
    started_at: String,     // YYYY-MM-DD
    duration_days: u32,
    ends_at: String,        // started_at + duration_days
    // ── shared, authoritative ──
    hp_pool: f64,           // participants × D × θ  (grows as members join)
    hp_remaining: f64,      // chipped by every member's daily contribution
    /// url → last accepted contribution date + their running total.
    /// Enforces idempotency (one p per member per date) and feeds the leaderboard.
    contributions: HashMap<String, MemberContribution>,
    status: String,         // "active" | "ended" — flipped when hp<=0 or window closes
    ended_at: Option<String>, // for the 30-day reporting cutoff
}

struct MemberContribution { last_date: String, total: f64 }

struct Participation {
    quest_id: String,
    boss_id: String,        // snapshot — survives host going away
    host_url: String,
    started_at: String,
    ends_at: String,        // snapshot — lets us self-resolve if host is down
    // ── local bookkeeping ──
    last_contributed_date: String, // last boss-day we sent (prevents double send)
    outbox: Vec<DailyContribution>, // p(d) queued when host unreachable; retried
    broken_gear: Vec<String>,       // item ids broken during this quest
    outcome: Option<String>,        // "victory" | "defeat" | "abandoned"
    reward_claimed: bool,           // guards local one-time reward grant
    resolved_at: Option<String>,
    cached_state: Option<HostedQuest>, // last poll of host, for rendering
}

struct DailyContribution { date: String, p: f64 }
struct RevealedBoss { boss_id: String, revealed_at: String }
```

Boss **catalogue** (`bosses_catalogue.rs`, static like the events catalogue):

```rust
struct BossDef {
    id: &str,
    name: &str,
    lore: &str,
    tier: &str,             // "lesser" | "greater" | "ancient" (flavour)
    duration_days: u32,     // D
    threshold: f64,         // θ — avg party completion to defeat
    damage_multiplier: f64, // extra-damage knob
    // ── rewards (see §3) ──
    reward_gold: f64,           // always granted on victory
    reward_item: Option<&str>,  // catalogue id, granted with reward_item_chance
    reward_item_chance: f64,    // 0..1
    reward_heal: f64,           // HP, granted with reward_heal_chance
    reward_heal_chance: f64,    // 0..1
}
```

---

## 7. Where it plugs into the engine

The daily fight folds into the existing per-day catch-up tick
(`tick.rs::process_tick`, driven from the character handler when
`last_tick_date < today`). The pure tick computes the numbers; the async handler
does the I/O (durability writes **and** the network contribution to the host).

`TickInput` gains:

- `boss_damage_multiplier: f64` (default `1.0`) — applied to every `miss_damage`.
- the tick already iterates each habit per day with deadlines + completions, so
  it computes `due(d)`/`done(d)` → `p(d)` for each boss-day in the catch-up span.

`TickOutput` gains:

- `boss_contributions: Vec<DailyContribution>` — one `{ date, p(d) }` per
  boss-day in the catch-up span (so multi-day catch-up sends each day once).
- `gear_wear: u32` — total boss-day wear to subtract from equipped gear.

The handler then, for the active `Participation`:

1. applies `gear_wear` to equipped durability, breaking items ≤ 0 into
   `broken_gear` ([§4](#4-gear-durability--degradation));
2. for each new `DailyContribution` (date > `last_contributed_date`), **POSTs it
   to the host** `POST {host_url}/api/boss/contribute { url, date, p }`. On
   success, advance `last_contributed_date`; on failure, queue in `outbox` and
   retry next tick / next `GET /api/boss`.

When the node **is** the host, the contribution is applied to its own
`hosted.hp_remaining` directly (no network). The host applies every contribution
**idempotently** via `contributions[url].last_date` — a replayed `outbox` entry
or a double tick is ignored.

`process_tick` stays pure (returns deltas only); the boss store, durability map,
and outbound HTTP all live in the handler — matching the current design.

---

## 8. Distribution protocol (Phase 2)

Built on the party mesh. Host endpoints that peers call are **no-auth**, like
`/api/party/public` and `/api/party/add-me`.

| Endpoint | Auth | Who calls | Effect |
|---|---|---|---|
| `GET  /api/boss/active` | none | party peers polling | Host returns its **full** `HostedQuest` — `boss_id`, window, `hp_pool`, `hp_remaining`, `status`, and the `contributions` map (the leaderboard) — or `null`. Returns `null` once `ended_at + 30d` has passed (the **month expiry**). |
| `POST /api/boss/participants` | none | a joining member | `{ url }` → host adds the member: appends to `contributions` (zeroed) and **grows `hp_pool` and `hp_remaining` by `D × θ`**. Idempotent (re-join is a no-op), like `add-me`. |
| `POST /api/boss/contribute` | none | a member, on tick | `{ url, date, p }` → host applies the daily contribution: if `date > contributions[url].last_date`, subtract `p` from `hp_remaining`, add to that member's `total`, set `last_date`. Idempotent per member per date. Rejects if `url` isn't a participant or the quest has ended. |
| `POST /api/boss/launch` | admin | host UI | `{ bossId }` → create `HostedQuest` (host as first participant, `hp_pool = 1 × D × θ`), set local `participating`, remove from `revealed`. |
| `POST /api/boss/join` | admin | joining UI | `{ hostUrl }` → fetch host's `/api/boss/active`, snapshot into `participating`, then call host `POST /api/boss/participants`. |
| `GET  /api/boss` | admin | own UI | Aggregated payload: current `participating` (with host-polled HP %, leaderboard, my gear durability), `revealed`, and **invitations** = active hosted bosses found by polling party peers when not already in a quest. Also flushes any `outbox`. |
| `POST /api/boss/abandon` | admin | own UI | drop out of the current quest (`outcome = "abandoned"`); best-effort tells the host to zero/remove our contribution slot. |

**Discovery** is pull-based: `GET /api/boss` polls each party member's
`/api/boss/active` (5 s client timeout, like `get_party`) and surfaces an active
hosted boss as an **invitation** when this node isn't already in a quest (one at
a time, decided).

**Resolution under shared HP.** The **host** is authoritative: it flips
`status = ended` and stamps `ended_at` the moment `hp_remaining ≤ 0` (victory) or
`today ≥ ends_at` with HP left (defeat). Members learn the outcome by polling.

**"Check against their version":** a member also holds a local snapshot
(`ends_at`, `cached_state`, `reward_claimed`). On seeing the host **ended** — or
the host **unreachable** but the local `ends_at` has passed — the member resolves
its **own** view exactly once: a **victory** state grants the reward
([§3 rewards](#victory-rewards)) guarded by `reward_claimed`; a **defeat** applies
`wear_boss_fail` and finalizes broken gear. So the canonical HP lives on the
host, but each member can still close out its UI and rewards when the host is
offline.

**Month expiry:** ended quests stay visible (for the summary) until
`ended_at + 30 d`, then are pruned from `participating`/`hosted`; the host stops
reporting them from `/api/boss/active` at the same boundary.

---

## 9. UI

### New Boss tab (nav entry)

- **Active boss:** boss name/lore, the **shared HP bar**
  (`1 − hp_remaining/hp_pool` felled), days remaining, my today's contribution
  (did I advance it?), the `damage_multiplier` warning, a compact equipped-gear
  durability strip, and a **party leaderboard** — each member's `total`
  contribution from the host's `contributions` map (who's carrying, who's
  slacking). The leaderboard is core to a shared-HP fight, not deferred.
- **Revealed bosses:** launchable cards with stats (duration, θ as "avg X%
  needed", multiplier, rewards) and a **Rally the party / Launch** button.
- **Invitations:** party members hosting a boss you can **Join** (shown only when
  you're not already in a quest).
- **Recent quests** (last 30 d): victory/defeat summaries with broken-gear lists.

### Dashboard banner

When a boss is active, a top-level strip on the dashboard: boss name, shared HP %
felled, days left, and whether today's habits have advanced it. Reuse the
existing dashboard `SectionHeader`/overlay styling (same family as the weekly
bounty CLAIM and the check-in dialog).

### End-of-quest summary modal

Reuse the `checkin-overlay` / `checkin-panel` styling. Shows: story text
(victory or defeat narrative), reward gained (gold + item) or the loss, and
**casualties** — the gear that broke during the fight, framed as part of the
story.

---

## 10. Phasing

The shared-HP loop works even **solo** — a party of one hosts its own boss and
contributes to itself with **no network call** (host == self). So the phases
split on *reach*, not on the mechanic:

**Phase 1 — single node, full loop (most value, least risk):**
gear durability + breaking; boss catalogue; reveal-from-encounter; launch a boss
(party of 1, host = self); daily contribution + extra damage + gear wear folded
into the tick (applied locally to own `hosted.hp_remaining`); shared HP bar; end
resolution (rewards / failure) with broken-gear summary; Boss tab + dashboard
banner + end modal. Delivers the **entire loop** for one player with zero
distributed code paths.

**Phase 2 — party / distributed:**
no-auth `/api/boss/active` (full state), `/api/boss/participants`,
`/api/boss/contribute`; join/opt-in; pull-based discovery & invitations;
`outbox` retry when the host is unreachable; leaderboard; 30-day expiry.
Phase 1's local contribution becomes "POST to host" with the same payload — a
small swap, not a rewrite.

---

## 11. Resolved decisions & remaining knobs

**Resolved (this review):**

1. **Core model** — **shared / coordinated HP**, host-authoritative. Members
   report daily `p(d)` to the host, which chips one shared bar ([§2](#2-core-model--shared-hp-host-coordinated)).
2. **`p(d)` counts habits only** — not todos/deeds.
3. **Days with nothing due → `p = 1.0`** (full credit).
4. **Gear is consumable** (no repair). **Victory always grants gold**, plus an
   item *sometimes* and healing *sometimes* (per-boss chances, [§3](#victory-rewards)).
5. **One active boss at a time** per node.
6. **Launch/join is free.**

**Remaining knobs (don't block the build — tune in playtest):**

- Numeric tuning: `θ` per boss, `D`, `damage_multiplier`, `wear_*`,
  `max_durability`, reward amounts/chances.
- **Reveal mapping** — fixed boss per encounter (default) vs random-weighted by
  tier.
- **Late-join cost** — flat `D × θ` (default) vs pro-rated by remaining days
  ([§3 ceiling](#3-difficulty--fight-math)).
- **Host-down resilience** — local `outbox` retry (default) is enough for a
  small trusted party; a host-independent tally is the upgrade path if not.
