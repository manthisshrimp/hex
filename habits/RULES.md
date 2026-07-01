# Habits — Game Rules

This document defines the game rules independent of any implementation.
The implementation must be validatable against these rules.

---

## Design Intent

Your character's health reflects how consistently you maintain your real-life
habits. The more consistent habits you have, the more resilient you are to
individual failures — like in life.

A player with no habits is fragile. A player with many well-maintained habits
can absorb occasional slip-ups. A player who overcommits and fails consistently
will deteriorate.

---

## Habits

A habit is a recurring commitment the player makes to themselves.

### Importance

Every habit has an importance level that multiplies both its rewards and its
consequences:

| Level | Multiplier |
|-------|-----------|
| Low | 1× |
| Medium | 1.5× |
| High | 2× |

### Frequency types

**Daily** — must be completed at least once on each calendar day.

**Windowed** — must be completed at least once within a rolling window of N days
(e.g. every 7 days, every 30 days). The exact timing within the window is
flexible; only the deadline matters.

### States

**Active** — the habit is in play. Missed deadlines deal damage; completions
award gold; consistency contributes to regen and passive income.

**Paused** — the player has voluntarily suspended the habit. While paused:
no damage is dealt, no regen is contributed, no gold is earned, and the
deadline does not advance. Pausing is how a player avoids being punished for
commitments they genuinely cannot keep right now.

---

## Scheduling

### First deadline

- **Daily:** end of the day the habit was created.
- **Windowed:** `created_at + window_days`.

### After a completion

The next deadline is set to `completion_date + window_days`. Completing early
creates a buffer; completing late still resets the full window from that date.

### After a miss

The next deadline is set to `missed_deadline + window_days`. This caps
punishment at once per cycle regardless of how late the player eventually
completes — or whether they complete at all that cycle.

### Multiple completions per window (windowed habits)

Only the first completion within a cycle (between the previous deadline and
the next) counts for consistency and gold. Additional completions in the same
window are logged but award nothing.

### Pausing mid-cycle

The current deadline is frozen. When the habit is unpaused, the deadline
resumes from where it was left — it does not advance during the paused period.
No missed deadline events are generated while paused.

---

## Consistency

Consistency is a per-habit score from 0.0 to 1.0 representing recent
completion rate:

- **Daily habit:** fraction of days in the last 30 days on which the habit
  was completed at least once.
- **Windowed habit:** fraction of the last 10 cycles in which the habit was
  completed at least once.

A brand-new habit with no history has consistency 0.0.

---

## Maturity

Maturity equals consistency. This single value governs both how much a habit
hurts when broken and how large the active completion reward is.

- Low maturity (new/inconsistent habit): small damage on miss, large completion reward
- High maturity (established habit): significant damage on miss, smaller completion reward

---

## Health

The player has a health pool from 0 to 100 HP.

### Regen

Each calendar day, every active habit contributes regen:

```
daily_regen = BASE_REGEN × importance_multiplier × consistency
```

Total daily regen is the sum across all active habits.

### Damage

When a deadline is missed, damage is dealt once:

```
miss_damage = BASE_DAMAGE × importance_multiplier × maturity
```

### Burnout

Reaching 0 HP triggers a burnout visual state. The game continues — there is
no hard stop. The player can recover by improving consistency.

### Balance principle

The ratio `BASE_DAMAGE / BASE_REGEN` determines how many consistent habits
a player needs to absorb one daily miss without losing ground. The target
behaviour at the default constants:

| Scenario | Expected outcome |
|---|---|
| 2 medium habits (90% consistent) + 1 daily miss | Health dropping |
| 4 medium habits (90% consistent) + 1 daily miss | Slowly declining, survivable short-term |
| 10 medium habits (90% consistent) + 1 daily miss | Comfortably absorbing the miss |

---

## Gold

Gold is the economic resource. It is earned through habit activity and spent
to buy relief or future unlocks.

### Completion bonus

Awarded immediately each time the player logs a valid completion:

```
completion_gold = COMPLETION_GOLD_BASE × importance_multiplier × (2 − consistency)
```

At 0% consistency (new habit): 2× base. At 100% consistency: 1× base.
This rewards the habit-building phase — the player is compensated for the
effort of establishing something new.

### Passive daily income

Awarded once per calendar day per active habit:

```
passive_gold = PASSIVE_GOLD_BASE × importance_multiplier × consistency²
```

The squared curve makes passive income negligible at low consistency and
spikes sharply above ~80%. Once a habit is truly locked in, it becomes a
reliable income source without requiring active completion events.

**The crossover point** — where passive daily income exceeds the completion
bonus per day — is around 70% consistency. Below that, active completion is
the primary income source. Above it, passive income takes over.

**Breadth matters:** total passive income scales with the number of consistent
habits. A player maintaining ten high-consistency habits generates substantially
more gold than one maintaining two.

### Reschedule

A player may spend gold to push the next deadline of a windowed habit forward
by a fixed extension. Daily habits cannot be rescheduled.

```
extension = window_days × RESCHEDULE_EXTENSION_FRACTION

cost = RESCHEDULE_COST_BASE × importance_multiplier × (1 + reschedules_this_cycle)
```

`reschedules_this_cycle` counts how many times this habit has been rescheduled
since its last completion. Cost increases with each reschedule in the same
cycle to discourage repeated use as a free pass.

---

## Daily Tick

The game advances in calendar-day increments. Each tick represents one day:

1. For each active habit, check whether its deadline was missed on that day.
2. For each miss: deal damage, advance the deadline by `window_days` from the
   missed date.
3. For each active habit: award regen and passive gold.
4. HP is clamped to 0–100. Gold is always a non-negative integer.

If the player has been absent for multiple days, ticks are processed one day
at a time in order, so the correct accumulated damage is applied.

---

## The System Habit: Open the App

Every character has one fixed, permanent daily habit: **open the app**.

- It is automatically completed when the player opens the app each day.
- It cannot be paused, edited, or deleted.
- It obeys all the same rules as any other daily habit — it contributes to
  regen, earns completion gold, and its consistency contributes to passive income.
- It is the first habit every player owns, ensuring no one starts from zero.

The intent is to give new players an immediate win and a baseline consistency
score before they add any other commitments. It also means a player who is in
burnout but still opening the app is slowly building a foundation to recover from.

---

## Design Invariants

These are the "why" behind key rule choices. Changing a rule should consider
whether it violates an invariant.

1. **Once-per-cycle punishment.** Deadline resets from the missed date so a
   player is never punished more than once per cycle for a single habit,
   regardless of how long they stay absent.

2. **New habits are safe to try.** Damage scales with maturity (= consistency),
   so a habit with no history deals negligible damage. Players can add a habit
   without immediate risk — they must build it up before it has teeth.

3. **Overcommitment is self-correcting.** Taking on more habits than you can
   maintain will cause net health decline. The system teaches the player to
   pause habits they cannot handle consistently.

4. **Consistency is the core currency.** Almost every mechanical output —
   regen, passive gold, damage — is a function of consistency. There are no
   shortcuts: you cannot buy your way to regen or fake your way to passive income.

5. **Reschedule is a pressure valve, not a free pass.** Escalating cost per
   cycle prevents reschedules from neutralising the consequence of a habit
   entirely.

---

## Boss Quests

A **boss quest** is a multi-day party challenge that runs on top of the normal
habit loop.

### Discovery

A new account starts with the **starter boss** (Gloomfang) already revealed,
so there is always something to fight.

Beyond that, a special random encounter — *A Threat Stirs* — reveals one more
boss each time it resolves. Which boss is **difficulty-weighted**: lesser
bosses surface often, mythic ones rarely (weights 50 / 22 / 8 / 2 for
lesser / greater / ancient / mythic). A boss you have already revealed,
already host, or are currently fighting is skipped, so reveals always bring
something new.

Revealed bosses are **collected** in the Boss tab and persist there until you
choose to launch them — there is no expiry on a revealed boss.

### Launching & joining

Any party member can **launch** a revealed boss (free). Other party members
can **join** the host's active quest (free, one active quest at a time per
player). Launch and join are no-ops if a quest is already active.

### Shared HP

The party fights a **single boss with one shared, fixed HP bar**, owned by the
host:

- `hp_pool = base_hp` — a **fixed value per boss, independent of party size**.
- Joining does **not** raise the pool; it only adds a contributor. So every
  member, even a late joiner, only speeds the kill — partying up is always an
  advantage.
- Victory when `hp_remaining ≤ 0` before `ends_at`.

Each participant's **total damage** is *derived*: the sum of their daily damage
`p(d)` over every boss-day from the start through today (today's in-progress
completions included). Each member publishes this absolute total to the host,
which sets it and recomputes `hp_remaining = hp_pool − Σ member totals`. Because
it is recomputed and set (not accumulated), scoring is idempotent — it updates
live as you complete today's habits and self-heals if a completion is undone.
Daily damage combines **consistency** and **effort** so both matter:

```
consistency = done(d) / due(d)        (clamped to 1)
effort      = tanh(done(d) / 5)        (concave ramp, saturates near 5)
p(d)        = effort × consistency     ∈ [0, 1)
```

- `due(d)` = habits actually **scheduled** on day `d` (daily habits every day;
  windowed habits only on their `show_on_days` weekdays), plus any flexible
  windowed habit you completed that day. Excludes the automatic "open the app"
  system habit. A weekly habit never counts as "due" on a day it isn't
  scheduled, so it only ever helps — it can't drag consistency down.
- `done(d)` = habits with a completion on day `d`.
- **Rest day** (nothing due) → `p = 0`: no work, no damage. A perfect 9/10 must
  out-damage an idle day.
- Inconsistency is punished (the ratio gates effort): 4/10 ≈ 0.27, vs a perfect
  5/5 ≈ 0.76.
- Volume is rewarded but with diminishing returns: perfect 2/2 ≈ 0.38, 3/3 ≈
  0.54, 5/5 ≈ 0.76, 10/10 ≈ 0.96 (never quite 1.0).

Because the best possible day is ≈0.96, a solo run tops out around
`duration_days × 0.96`. Lesser bosses are tuned so a casual **3/3-per-day** solo
finishes in time; every tougher tier survives even a maxed 10/10 solo and needs
a party (see the table).

### Extra damage (mitigated by your own armor)

While a boss is active, **every miss penalty is multiplied** by the boss's
`damage_multiplier`. No new damage source — existing misses bite harder.

Your equipped **armor** shaves that bonus down (diminishing returns, floored at
1.0× — armor never makes a boss miss cheaper than a normal miss):

```
effective_multiplier = 1 + (damage_multiplier − 1) × 100/(armor + 100)
```

Armor only protects **the player wearing it** — it never reduces damage to other
party members. So a high-tier boss (×2.5) hits an ungeared player brutally but a
tank in heavy plate weathers it, enabling a "tank" role for the party.

### Boosting damage dealt with gear

Equipped **damage** gear amplifies the damage you deal to the boss (diminishing
returns, capped at +40%). It multiplies your effort — it never deals damage on
its own, so a zero-completion day still deals nothing:

```
gear_bonus = 1 + 0.4 × damage/(damage + 100)
p_final    = p(d) × gear_bonus
```

Armor and damage compete for the same equipment slots, so players choose a
**glass-cannon** (fast kills, fragile), a **tank** (soaks the multiplier, slow),
or a balance — and a party wants a mix. Tuned so even a maxed-damage solo still
can't crack a greater+ boss.

### Gear degradation

Equipped gear **wears** by a small, tier-scaled amount (`wear_per_day`): **1**
for lesser, **2** for greater/ancient, **3** for mythic — but **only on a
boss-day where you actually took a hit** (missed a habit). A flawless day costs
no durability, so a confident player never wears gear and has no reason to strip
it. Wear is tied to failure. When an item's durability reaches `0` it **breaks**:
removed from equipped and inventory, logged as a casualty in the end-of-quest
summary. Gear is consumable — no repair; the shop is the re-buy sink.

**Loadout lock:** while you are in an active boss quest, equip/unequip is
blocked. You commit your gear up front and pay the (light) wear — no stripping
it day-to-day to dodge the cost.

Wear is a **tax, not the point** — the real payoff is the gold and the chance at
a **unique (`rnw-`) item**, the strongest gear in the game and otherwise only
available one-per-week through the renown shop. The intended loop: grind habits
→ buy gear → gear makes a boss survivable → boss drops unique loot → tackle a
harder tier. Wear only happens during boss fights; normal habit life never
wears gear.

### Victory rewards

On victory, every participant receives:
- **Always:** `reward_gold` gold.
- **Sometimes:** a unique item (per-boss probability).
- **Sometimes:** `reward_heal` HP (per-boss probability, capped at max HP).

Defeat grants nothing. Ended quests are visible for 30 days, then pruned.

### Bosses

Reveal weight rises as difficulty falls, so players meet easy bosses first and
the hardest only occasionally.

Boss HP is **fixed** (shown ×100, matching the UI). "Party @ 5/5" is the roster
needed if everyone sustains a good 5-completion day (≈0.76 dmg each); casual
3/3 play needs more. Only lesser bosses are soloable.

| Boss | Tier | Reveal weight | Duration | Boss HP | Party @ 5/5 | Damage × | Wear/day | Reward gold |
|---|---|---|---|---|---|---|---|---|
| Gloomfang *(starter)* | lesser | 50 | 5 days | 230 | 1 (solo) | 1.25× | 1 | 600 |
| The Mirefen Lurker | lesser | 50 | 6 days | 270 | 1 (solo) | 1.3× | 1 | 900 |
| The Ashwarden | greater | 22 | 7 days | 900 | 2 | 1.5× | 2 | 1200 |
| The Stormcaller | greater | 22 | 8 days | 1000 | 2 | 1.6× | 2 | 1700 |
| Dreadtide | greater | 22 | 10 days | 1400 | 2 | 1.75× | 2 | 2000 |
| The Hollow King | ancient | 8 | 12 days | 2600 | 3 | 1.9× | 2 | 3000 |
| The Undying Vigil | ancient | 8 | 14 days | 3500 | 4 | 2.0× | 2 | 4000 |
| The Sundering | mythic | 2 | 18 days | 6300 | 5 | 2.5× | 3 | 7000 |
