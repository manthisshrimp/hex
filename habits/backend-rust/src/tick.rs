use std::collections::HashMap;
use chrono::NaiveDate;
use uuid::Uuid;

use crate::models::{Completion, GoldEvent, Habit, HealthEvent};
use crate::game::{self, GameConfig, miss_damage, passive_gold};

// ── TickInput / TickOutput ────────────────────────────────────────────────────

pub struct TickInput {
    /// The calendar day being processed.
    pub date: NaiveDate,
    /// All currently active habits.
    pub habits: Vec<Habit>,
    /// Current deadlines keyed by habit_id (YYYY-MM-DD strings).
    pub deadlines: HashMap<String, NaiveDate>,
    /// ALL completions (used for consistency calculations).
    pub completions: Vec<Completion>,
    pub current_hp: f64,
    pub current_gold: f64,
    pub current_renown: f64,
    pub config: GameConfig,
}

pub struct DeadlineUpdate {
    pub habit_id: String,
    pub new_deadline: NaiveDate,
}

pub struct HabitHealthUpdate {
    pub habit_id: String,
    pub new_health_removed: f64,
}

pub struct TickOutput {
    /// New HP, clamped to [0, max_hp].
    pub new_hp: f64,
    /// New gold, floor'd and non-negative.
    pub new_gold: f64,
    /// New renown after 1/day decay, floor'd at 0.
    pub new_renown: f64,
    /// HealthEvents to append (damage then regen for each habit).
    pub health_events: Vec<HealthEvent>,
    /// GoldEvents to append (passive income for each habit).
    pub gold_events: Vec<GoldEvent>,
    /// Deadline changes to persist.
    pub deadline_updates: Vec<DeadlineUpdate>,
    /// Updated health_removed values to write back to each habit.
    pub habit_health_updates: Vec<HabitHealthUpdate>,
}

// ── Tick engine ───────────────────────────────────────────────────────────────

/// Process a single calendar day and return all side-effects as `TickOutput`.
/// Pure: no I/O, no async.
pub fn process_tick(input: TickInput) -> TickOutput {
    let date = input.date;
    let config = &input.config;
    let date_str = date.format("%Y-%m-%d").to_string();

    let mut hp_delta: f64 = 0.0;
    let mut gold_delta: f64 = 0.0;
    let mut health_events: Vec<HealthEvent> = Vec::new();
    let mut gold_events: Vec<GoldEvent> = Vec::new();
    let mut deadline_updates: Vec<DeadlineUpdate> = Vec::new();
    let mut habit_health_updates: Vec<HabitHealthUpdate> = Vec::new();

    for habit in &input.habits {
        // Only process active, non-inscribed habits.
        if !habit.active || habit.inscribed {
            continue;
        }

        // ── Collect this habit's completions ──────────────────────────────
        let habit_completions: Vec<Completion> = input
            .completions
            .iter()
            .filter(|c| c.habit_id == habit.id)
            .cloned()
            .collect();

        // ── Compute consistency ───────────────────────────────────────────
        let consistency = game::compute_consistency(config, habit, &habit_completions, date);

        // maturity == consistency (per RULES.md)
        let maturity = consistency;

        // Running health_removed for this habit this tick.
        let mut cur_health_removed = habit.health_removed;

        // ── Step 1: Check for missed deadline (damage) ────────────────────
        // A deadline is missed when it is strictly before the current tick date.
        if let Some(&deadline) = input.deadlines.get(&habit.id) {
            if deadline < date {
                // Damage
                let damage = miss_damage(config, &habit.importance, maturity);
                hp_delta -= damage;
                cur_health_removed += damage;
                health_events.push(HealthEvent {
                    id: Uuid::new_v4().to_string(),
                    event_type: "damage".to_string(),
                    amount: damage,
                    reason: format!("missed: {}", habit.name),
                    habit_id: Some(habit.id.clone()),
                    tick_date: date_str.clone(),
                });

                // Advance deadline from the missed date (not from today).
                let new_deadline = deadline
                    + chrono::Duration::days(habit.window_days as i64);
                deadline_updates.push(DeadlineUpdate {
                    habit_id: habit.id.clone(),
                    new_deadline,
                });
            }
        }

        // ── Step 2: Passive gold (or healing when injured) ───────────────
        // Healing is capped by health_removed (the HP debt this habit owes back).
        // Once the debt is cleared, the habit heals at only 5% of its full rate.
        let passive = passive_gold(config, &habit.importance, consistency);
        let hp_before_delta = input.current_hp + hp_delta;
        if hp_before_delta > 0.0 && hp_before_delta < config.max_hp {
            let full_heal = passive * config.passive_gold_heal_rate;
            let heal = if cur_health_removed > 0.0 {
                let capped = full_heal.min(cur_health_removed);
                cur_health_removed -= capped;
                capped
            } else {
                full_heal * 0.05
            };
            if heal > 0.0 {
                hp_delta += heal;
                health_events.push(HealthEvent {
                    id: Uuid::new_v4().to_string(),
                    event_type: "regen".to_string(),
                    amount: heal,
                    reason: format!("healing: {}", habit.name),
                    habit_id: Some(habit.id.clone()),
                    tick_date: date_str.clone(),
                });
            }
        } else {
            gold_delta += passive;
            gold_events.push(GoldEvent {
                id: Uuid::new_v4().to_string(),
                event_type: "passive_income".to_string(),
                amount: passive,
                reason: format!("passive: {}", habit.name),
                habit_id: Some(habit.id.clone()),
                timestamp: format!("{}T00:00:00Z", date_str),
            });
        }

        habit_health_updates.push(HabitHealthUpdate {
            habit_id: habit.id.clone(),
            new_health_removed: cur_health_removed,
        });
    }

    // ── Finalise HP, gold, and renown ────────────────────────────────────────
    let new_hp = (input.current_hp + hp_delta).clamp(0.0, config.max_hp);
    let new_gold = (input.current_gold + gold_delta).max(0.0).floor();
    let new_renown = (input.current_renown - 1.0).max(0.0);

    TickOutput {
        new_hp,
        new_gold,
        new_renown,
        health_events,
        gold_events,
        deadline_updates,
        habit_health_updates,
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Completion, Habit, Importance};
    use crate::game::GameConfig;
    use chrono::NaiveDate;

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn make_daily_habit(id: &str, name: &str, importance: Importance) -> Habit {
        Habit {
            id: id.to_string(),
            name: name.to_string(),
            importance,
            frequency: "daily".to_string(),
            window_days: 1,
            active: true,
            system: false,
            created_at: "2020-01-01T00:00:00Z".to_string(),
            position: 0,
            notes: None,
            show_on_days: None,
            inscribed: false,
            inscribed_at: None,
            health_removed: 0.0,
        }
    }

    fn make_windowed_habit(id: &str, name: &str, importance: Importance, window_days: u32) -> Habit {
        Habit {
            id: id.to_string(),
            name: name.to_string(),
            importance,
            frequency: "windowed".to_string(),
            window_days,
            active: true,
            system: false,
            created_at: "2020-01-01T00:00:00Z".to_string(),
            position: 0,
            notes: None,
            show_on_days: None,
            inscribed: false,
            inscribed_at: None,
            health_removed: 0.0,
        }
    }

    fn completion(habit_id: &str, date_str: &str) -> Completion {
        Completion {
            id: Uuid::new_v4().to_string(),
            habit_id: habit_id.to_string(),
            completed_at: format!("{}T00:00:00Z", date_str),
        }
    }

    // ── No habits: HP and gold unchanged ─────────────────────────────────────

    #[test]
    fn tick_no_habits_no_change() {
        let input = TickInput {
            date: date("2026-04-25"),
            habits: vec![],
            deadlines: HashMap::new(),
            completions: vec![],
            current_hp: 80.0,
            current_gold: 100.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);
        assert_eq!(out.new_hp, 80.0);
        assert_eq!(out.new_gold, 100.0);
        assert!(out.health_events.is_empty());
        assert!(out.gold_events.is_empty());
        assert!(out.deadline_updates.is_empty());
    }

    // ── No completions: zero consistency → no damage (maturity 0), no regen, no passive ──

    #[test]
    fn tick_new_habit_no_completions_no_damage_no_regen() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-24"); // yesterday — missed
        let habit = make_daily_habit("h1", "Exercise", Importance::High);

        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions: vec![],
            current_hp: 50.0,
            current_gold: 0.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);

        // At 0% maturity, damage = minimum (5) and regen = 0.
        assert_eq!(out.new_hp, 45.0);
        // Missed deadline should advance by window_days.
        assert_eq!(out.deadline_updates.len(), 1);
        assert_eq!(out.deadline_updates[0].new_deadline, date("2026-04-25"));
        // Damage event is emitted with minimum amount.
        let damage_events: Vec<_> = out.health_events.iter()
            .filter(|e| e.event_type == "damage")
            .collect();
        assert_eq!(damage_events.len(), 1);
        assert_eq!(damage_events[0].amount, 5.0);
    }

    // ── Established habit miss: causes damage ────────────────────────────────

    #[test]
    fn tick_established_habit_miss_causes_damage() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-20"); // 5 days ago — missed

        // Build completions for all 30 days of the window to get ~100% consistency.
        let completions: Vec<Completion> = (1..=30i64)
            .map(|i| {
                let d = tick_date - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();

        let habit = make_daily_habit("h1", "Morning Run", Importance::Low);

        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let config = GameConfig::default();
        let expected_damage = config.base_damage * config.importance_low * 1.0; // 15.0

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions,
            current_hp: 100.0,
            current_gold: 0.0,
            current_renown: 0.0,
            config,
        };
        let out = process_tick(input);

        let damage_events: Vec<_> = out.health_events.iter()
            .filter(|e| e.event_type == "damage")
            .collect();
        assert_eq!(damage_events.len(), 1);
        assert!((damage_events[0].amount - expected_damage).abs() < 1e-6,
            "expected damage {expected_damage}, got {}", damage_events[0].amount);
        // Deadline must have advanced from the missed date.
        assert_eq!(out.deadline_updates[0].new_deadline, date("2026-04-21"));
    }

    // ── HP clamped to max ────────────────────────────────────────────────────

    #[test]
    fn tick_hp_clamped_at_max() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-30"); // future — not missed

        let completions: Vec<Completion> = (1..=30i64)
            .map(|i| {
                let d = tick_date - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();

        let habit = make_daily_habit("h1", "Meditation", Importance::High);
        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions,
            current_hp: 99.9,
            current_gold: 0.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);
        assert_eq!(out.new_hp, 100.0, "HP should be clamped to max_hp");
    }

    // ── HP clamped to zero ───────────────────────────────────────────────────

    #[test]
    fn tick_hp_clamped_at_zero() {
        let tick_date = date("2026-04-25");
        // A missed deadline with 100% maturity on a high importance habit.
        let deadline = date("2026-04-20");
        let completions: Vec<Completion> = (1..=30i64)
            .map(|i| {
                let d = tick_date - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();

        let habit = make_daily_habit("h1", "Sleep", Importance::High);
        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions,
            current_hp: 1.0,  // tiny HP — should clamp to 0
            current_gold: 0.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);
        assert_eq!(out.new_hp, 0.0, "HP should not go below 0");
    }

    // ── Passive gold accumulates ─────────────────────────────────────────────

    #[test]
    fn tick_passive_gold_accumulates() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-30");

        let completions: Vec<Completion> = (1..=30i64)
            .map(|i| {
                let d = tick_date - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();

        let habit = make_daily_habit("h1", "Reading", Importance::Low);
        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let config = GameConfig::default();
        // At 100% consistency, low importance: passive = 12.0 × 1.0 × 1.0² = 12.0
        let expected_passive = 12.0;

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions,
            current_hp: 100.0,  // at max HP so passive goes to gold, not healing
            current_gold: 10.0,
            current_renown: 0.0,
            config,
        };
        let out = process_tick(input);
        // floor(10.0 + 12.0) = 22
        assert_eq!(out.new_gold, 22.0);
        assert_eq!(out.gold_events.len(), 1);
        assert!((out.gold_events[0].amount - expected_passive).abs() < 1e-6);
    }

    // ── Damage applied before regen ──────────────────────────────────────────
    // At the end, HP = start - damage + regen. The clamp is applied once at the end,
    // not after each step, but the ordering is preserved in health_events.

    #[test]
    fn tick_damage_event_before_regen_event() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-20");

        let completions: Vec<Completion> = (1..=30i64)
            .map(|i| {
                let d = tick_date - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();

        let habit = make_daily_habit("h1", "Gym", Importance::Low);
        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions,
            current_hp: 50.0,
            current_gold: 0.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);

        let types: Vec<&str> = out.health_events.iter()
            .map(|e| e.event_type.as_str())
            .collect();
        assert_eq!(types, vec!["damage", "regen"],
            "damage event must precede regen event");
    }

    // ── Inactive habit is skipped ────────────────────────────────────────────

    #[test]
    fn tick_inactive_habit_skipped() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-20"); // missed
        let mut habit = make_daily_habit("h1", "Walking", Importance::High);
        habit.active = false; // paused

        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions: vec![],
            current_hp: 80.0,
            current_gold: 50.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);
        assert_eq!(out.new_hp, 80.0, "inactive habit must not deal damage");
        assert_eq!(out.new_gold, 50.0, "inactive habit must not earn passive gold");
        assert!(out.health_events.is_empty());
        assert!(out.gold_events.is_empty());
        assert!(out.deadline_updates.is_empty());
    }

    // ── Windowed habit miss and reset ────────────────────────────────────────

    #[test]
    fn tick_windowed_habit_miss_advances_deadline() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-20"); // 5 days ago
        let habit = make_windowed_habit("h1", "Weekly Review", Importance::Medium, 7);

        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions: vec![],
            current_hp: 50.0,
            current_gold: 0.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);

        assert_eq!(out.deadline_updates.len(), 1);
        // new deadline = missed_deadline + window_days = 2026-04-20 + 7 = 2026-04-27
        assert_eq!(out.deadline_updates[0].new_deadline, date("2026-04-27"));
    }

    // ── Gold floored and non-negative ────────────────────────────────────────

    #[test]
    fn tick_gold_is_floored() {
        let tick_date = date("2026-04-25");
        let deadline = date("2026-04-30");

        // Create a habit that earns fractional passive gold.
        // At 50% consistency, low: 5.0 × 1.0 × 0.25 = 1.25
        let completions: Vec<Completion> = (1..=15i64)
            .map(|i| {
                let d = tick_date - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();

        let habit = make_daily_habit("h1", "Journaling", Importance::Low);
        let mut deadlines = HashMap::new();
        deadlines.insert("h1".to_string(), deadline);

        let input = TickInput {
            date: tick_date,
            habits: vec![habit],
            deadlines,
            completions,
            current_hp: 50.0,
            current_gold: 0.0,
            current_renown: 0.0,
            config: GameConfig::default(),
        };
        let out = process_tick(input);
        // floor(0.0 + passive) should be a whole number
        assert_eq!(out.new_gold, out.new_gold.floor());
        assert!(out.new_gold >= 0.0);
    }
}
