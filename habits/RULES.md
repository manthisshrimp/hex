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

Each day, every participant's **daily completion** `p(d)` is reported to the
host, which subtracts it from `hp_remaining`:

- `p(d) = done(d) / due(d)`, clamped to [0, 1].
- `due(d)` = active non-inscribed habits (all habits count every day).
- `done(d)` = habits with a completion on day `d`.
- Days with no habits due: `p(d) = 1.0` (full credit).

A solo player can deal at most `duration_days × 1.0` over the whole quest, so a
boss with `base_hp > duration_days` **cannot be soloed** and needs a party.
Only **lesser** bosses are tuned below that line; everything tougher is balanced
around a multi-member party (see the table).

### Extra damage

While a boss is active, **every miss penalty is multiplied** by the boss's
`damage_multiplier`. No new damage source — existing misses bite harder.

### Gear degradation

Equipped gear **wears** each boss-day (`8` durability per item). When an
item's durability reaches `0` it **breaks**: removed from equipped and
inventory, logged as a casualty in the end-of-quest summary. Gear is
consumable — no repair; the shop is the re-buy sink.

Random encounters (resolved outside a boss) also wear gear (`5` per item).

### Victory rewards

On victory, every participant receives:
- **Always:** `reward_gold` gold.
- **Sometimes:** a unique item (per-boss probability).
- **Sometimes:** `reward_heal` HP (per-boss probability, capped at max HP).

Defeat grants nothing. Ended quests are visible for 30 days, then pruned.

### Bosses

Reveal weight rises as difficulty falls, so players meet easy bosses first and
the hardest only occasionally.

Boss HP is **fixed** (shown ×100, matching the UI). "Min party" is the smallest
roster that can win with *perfect* daily play (`ceil(HP / duration)`); realistic
completion rates need more. Only lesser bosses are soloable.

| Boss | Tier | Reveal weight | Duration | Boss HP | Min party | Damage × | Reward gold |
|---|---|---|---|---|---|---|---|
| Gloomfang *(starter)* | lesser | 50 | 5 days | 250 | 1 (solo) | 1.25× | 300 |
| The Mirefen Lurker | lesser | 50 | 6 days | 300 | 1 (solo) | 1.3× | 450 |
| The Ashwarden | greater | 22 | 7 days | 900 | 2 | 1.5× | 600 |
| The Stormcaller | greater | 22 | 8 days | 1000 | 2 | 1.6× | 850 |
| Dreadtide | greater | 22 | 10 days | 1400 | 2 | 1.75× | 1000 |
| The Hollow King | ancient | 8 | 12 days | 2600 | 3 | 1.9× | 1500 |
| The Undying Vigil | ancient | 8 | 14 days | 3500 | 3 | 2.0× | 2000 |
| The Sundering | mythic | 2 | 18 days | 6300 | 4 | 2.5× | 3500 |
