use chrono::{Datelike, NaiveDate, Utc};
use crate::models::{Completion, Habit, Importance};

// ── GameConfig ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct GameConfig {
    pub max_hp: f64,
    pub base_regen: f64,
    pub base_damage: f64,
    pub importance_low: f64,
    pub importance_medium: f64,
    pub importance_high: f64,
    pub completion_gold_base: f64,
    pub passive_gold_base: f64,
    pub passive_gold_heal_rate: f64,
    pub reschedule_cost_base: f64,
    pub reschedule_extension_fraction: f64,
    pub consistency_window_days: u32,
    pub consistency_window_cycles: u32,
}

impl Default for GameConfig {
    fn default() -> Self {
        Self {
            max_hp: 100.0,
            base_regen: 3.0,
            base_damage: 15.0,
            importance_low: 1.0,
            importance_medium: 1.5,
            importance_high: 2.0,
            completion_gold_base: 6.0,
            passive_gold_base: 12.0,
            passive_gold_heal_rate: 0.25,
            reschedule_cost_base: 50.0,
            reschedule_extension_fraction: 0.5,
            consistency_window_days: 30,
            consistency_window_cycles: 10,
        }
    }
}

// ── Application-level constants ───────────────────────────────────────────────

pub const SYSTEM_HABIT_ID: &str = "system-open-app";

/// Gold awarded when a habit is inscribed (100% mastery achieved).
/// Low: 200 ⚜, Medium: 300 ⚜, High: 400 ⚜
pub fn inscribe_gold_reward(config: &GameConfig, importance: &Importance) -> f64 {
    200.0 * importance_weight(config, importance)
}

// ── Date helpers ──────────────────────────────────────────────────────────────

pub fn today() -> NaiveDate {
    Utc::now().date_naive()
}

pub fn today_str() -> String {
    today().format("%Y-%m-%d").to_string()
}

/// Parse the leading YYYY-MM-DD portion of an ISO datetime string.
pub fn parse_iso_date(iso: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(iso.get(..10)?, "%Y-%m-%d").ok()
}

/// The Monday on or before `d` (week starts Monday).
pub fn most_recent_monday(d: NaiveDate) -> NaiveDate {
    d - chrono::Duration::days(d.weekday().num_days_from_monday() as i64)
}

// ── Gold helpers ──────────────────────────────────────────────────────────────

/// Apply a signed gold delta, clamp to ≥ 0, and floor to a whole number.
pub fn apply_gold_delta(current: f64, delta: f64) -> f64 {
    (current + delta).max(0.0).floor()
}

// ── Formula functions ─────────────────────────────────────────────────────────

pub fn importance_weight(config: &GameConfig, importance: &Importance) -> f64 {
    match importance {
        Importance::Low => config.importance_low,
        Importance::Medium => config.importance_medium,
        Importance::High => config.importance_high,
    }
}

/// HP regen per day: BASE_REGEN × importance_weight × consistency
pub fn daily_regen(config: &GameConfig, importance: &Importance, consistency: f64) -> f64 {
    config.base_regen * importance_weight(config, importance) * consistency
}

/// HP damage on miss: BASE_DAMAGE × importance_weight × maturity, minimum 5
/// maturity == consistency per RULES.md
pub fn miss_damage(config: &GameConfig, importance: &Importance, maturity: f64) -> f64 {
    (config.base_damage * importance_weight(config, importance) * maturity).max(5.0)
}

/// Gold awarded on completion: 2× base while the habit has < 7 distinct completed days
/// in the last 7 calendar days (newbie bonus), then drops to 1× base.
/// `as_of_date` should be today+1 when awarding after a fresh completion so that
/// today's completion is included in the 7-day count.
pub fn completion_gold(
    config: &GameConfig,
    importance: &Importance,
    completions: &[Completion],
    as_of_date: NaiveDate,
) -> f64 {
    let seven_ago = as_of_date - chrono::Duration::days(7);
    let recent_days: std::collections::HashSet<NaiveDate> = completions
        .iter()
        .filter_map(|c| parse_iso_date(&c.completed_at))
        .filter(|d| *d >= seven_ago && *d < as_of_date)
        .collect();
    let multiplier = if recent_days.len() >= 7 { 1.0 } else { 2.0 };
    config.completion_gold_base * importance_weight(config, importance) * multiplier
}

/// Apply a random gold bonus of 0–20% to `base`, skewed toward lower values.
/// `roll` is a uniform f64 in [0, 1) — squaring it makes high bonuses rarer.
/// Returns the result floored to a whole number.
pub fn gold_roll_bonus(base: f64, roll: f64) -> f64 {
    let bonus_frac = roll * roll * 0.20;
    (base * (1.0 + bonus_frac)).floor()
}

/// Passive gold per day: PASSIVE_GOLD_BASE × importance_weight × consistency²
pub fn passive_gold(config: &GameConfig, importance: &Importance, consistency: f64) -> f64 {
    config.passive_gold_base * importance_weight(config, importance) * consistency * consistency
}

/// Reschedule cost (gold): ceil(RESCHEDULE_COST_BASE × importance_weight × (1 + reschedules_this_cycle))
pub fn reschedule_cost(
    config: &GameConfig,
    importance: &Importance,
    reschedules_this_cycle: u32,
) -> u64 {
    let raw = config.reschedule_cost_base
        * importance_weight(config, importance)
        * (1.0 + reschedules_this_cycle as f64);
    raw.ceil() as u64
}

/// How many days to extend the deadline: floor(window_days × reschedule_extension_fraction), minimum 1
pub fn reschedule_extension_days(config: &GameConfig, window_days: u32) -> u32 {
    let days = (window_days as f64 * config.reschedule_extension_fraction).floor() as u32;
    days.max(1)
}

// ── Consistency helpers ───────────────────────────────────────────────────────

/// Dispatch consistency calculation based on habit frequency.
pub fn compute_consistency(config: &GameConfig, habit: &Habit, completions: &[Completion], as_of: NaiveDate) -> f64 {
    if habit.frequency == "windowed" {
        compute_consistency_windowed(config, completions, as_of, habit.window_days)
    } else {
        let created = parse_iso_date(&habit.created_at).unwrap_or(as_of);
        compute_consistency_daily_with_created(config, completions, as_of, created)
    }
}

/// Consistency for a daily habit: fraction of days in the last
/// `consistency_window_days` (30) days on which the habit was completed.
/// Always uses the full 30-day window so mastery builds slowly regardless
/// of how new the habit is — 100% requires a full month of consistent work.
/// The `_created_at` parameter is retained for call-site compatibility but ignored.
pub fn compute_consistency_daily_with_created(
    config: &GameConfig,
    completions: &[Completion],
    as_of_date: NaiveDate,
    _created_at: NaiveDate,
) -> f64 {
    compute_consistency_daily(config, completions, as_of_date)
}

/// Convenience wrapper that uses the full window without a creation date cap.
pub fn compute_consistency_daily(
    config: &GameConfig,
    completions: &[Completion],
    as_of_date: NaiveDate,
) -> f64 {
    let window = config.consistency_window_days as i64;
    let window_start = as_of_date - chrono::Duration::days(window);

    let denominator = window;
    if denominator <= 0 {
        return 0.0;
    }

    let mut completed_days = std::collections::HashSet::new();
    for c in completions {
        if let Some(d) = parse_iso_date(&c.completed_at) {
            if d >= window_start && d < as_of_date {
                completed_days.insert(d);
            }
        }
    }

    (completed_days.len() as f64 / denominator as f64).min(1.0)
}

/// Consistency for a windowed habit: fraction of the last
/// `consistency_window_cycles` cycles (each of `window_days` length, ending
/// before `as_of_date`) in which the habit was completed at least once.
pub fn compute_consistency_windowed(
    config: &GameConfig,
    completions: &[Completion],
    as_of_date: NaiveDate,
    window_days: u32,
) -> f64 {
    let max_cycles = config.consistency_window_cycles as i64;
    let cycle_len = window_days as i64;
    if cycle_len == 0 || max_cycles == 0 {
        return 0.0;
    }

    // Walk backwards from as_of_date in `cycle_len`-day chunks.
    let mut cycle_end = as_of_date;
    let mut total_cycles: i64 = 0;
    let mut completed_cycles: i64 = 0;

    while total_cycles < max_cycles {
        let cycle_start = cycle_end - chrono::Duration::days(cycle_len);

        // Check if this cycle had at least one completion.
        let had_completion = completions.iter().any(|c| {
            if let Some(d) = parse_iso_date(&c.completed_at) {
                d >= cycle_start && d < cycle_end
            } else {
                false
            }
        });

        if had_completion {
            completed_cycles += 1;
        }

        total_cycles += 1;
        cycle_end = cycle_start;
    }

    if total_cycles == 0 {
        return 0.0;
    }

    (completed_cycles as f64 / total_cycles as f64).min(1.0)
}

// ── Boss fight helpers ────────────────────────────────────────────────────────

/// Per-day boss damage from a member's habit completions, in [0, 1).
///
/// Two factors, multiplied so both matter:
/// - **consistency** = `done / due` (clamped to 1) — punishes inconsistency.
/// - **effort** = `tanh(done / 5)` — rewards raw volume on a concave ramp that
///   saturates near 5 completions and never quite reaches 1.0.
///
/// A rest day (`due == 0`) yields 0 — nothing was done toward the boss, so it
/// deals no damage (a perfect 9/10 must out-damage an empty day).
pub fn daily_completion(due: u32, done: u32) -> f64 {
    if due == 0 { return 0.0; }
    let consistency = (done as f64 / due as f64).min(1.0);
    let effort = (done as f64 / 5.0).tanh();
    effort * consistency
}

/// Whether a habit is *scheduled* on `day` by its regular cadence — used as the
/// boss's `due` signal so a weekly habit doesn't count as "due" every day.
///
/// - Daily habits: every day.
/// - Windowed habits with `show_on_days`: only on those weekdays (JS `getDay()`
///   convention, 0=Sun … 6=Sat).
/// - Flexible windowed habits (no `show_on_days`): not tied to a weekday, so
///   they're never "scheduled" on a particular day. The boss counts them only
///   on days they're actually completed (bonus effort, no idle-day penalty).
pub fn boss_scheduled_on(habit: &crate::models::Habit, day: NaiveDate) -> bool {
    if habit.frequency == "daily" { return true; }
    match &habit.show_on_days {
        Some(days) if !days.is_empty() => {
            let dow = day.weekday().num_days_from_sunday() as u8;
            days.contains(&dow)
        }
        _ => false,
    }
}

/// Effective boss miss multiplier after the wearer's own armor mitigates the
/// bonus. Diminishing returns (K=100), floored at 1.0 — armor shaves the boss
/// *bonus* only, never the base miss, and only helps the player wearing it.
pub fn boss_effective_multiplier(multiplier: f64, armor: u32) -> f64 {
    const K: f64 = 100.0;
    let reduction = K / (armor as f64 + K); // 1.0 at 0 armor → 0 as armor → ∞
    1.0 + (multiplier - 1.0).max(0.0) * reduction
}

/// Damage-dealt multiplier from equipped weapon/damage gear. Diminishing
/// returns (K=100), capped at +40%. 1.0 at 0 damage, so gear amplifies effort
/// but never deals damage on its own.
pub fn boss_damage_gear_bonus(damage: u32) -> f64 {
    const DMG_MAX: f64 = 0.4;
    const K: f64 = 100.0;
    1.0 + DMG_MAX * (damage as f64 / (damage as f64 + K))
}


/// Subtract `wear` from each equipped item's current durability.
/// Missing durability entry is treated as full (`max_durability` from the item).
/// Returns the updated EquipmentState and the ids of items that broke (durability ≤ 0).
/// Broken items are removed from `equipped`, `inventory`, and `durability`.
pub fn apply_wear(
    equipment: &crate::models::EquipmentState,
    wear: u32,
    catalogue: &[crate::models::Item],
) -> (crate::models::EquipmentState, Vec<String>) {
    let mut eq = equipment.clone();
    let mut broken: Vec<String> = Vec::new();

    // Collect all item ids that are either equipped or in inventory.
    let all_equipped: Vec<String> = eq.equipped.values().cloned().collect();
    for item_id in &all_equipped {
        let max = catalogue.iter()
            .find(|i| &i.id == item_id)
            .map(|i| i.max_durability)
            .unwrap_or(100);
        let current = eq.durability.entry(item_id.clone()).or_insert(max);
        *current = current.saturating_sub(wear);
        if *current == 0 {
            broken.push(item_id.clone());
        }
    }

    // Remove broken items from equipped, inventory, and durability.
    for id in &broken {
        eq.equipped.retain(|_, v| v != id);
        eq.inventory.retain(|v| v != id);
        eq.durability.remove(id);
    }

    (eq, broken)
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn cfg() -> GameConfig {
        GameConfig::default()
    }

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn sched_habit(frequency: &str, show_on_days: Option<Vec<u8>>) -> Habit {
        Habit {
            id: "h".to_string(), name: "h".to_string(), importance: Importance::Low,
            frequency: frequency.to_string(), window_days: 7, active: true, system: false,
            created_at: "2020-01-01T00:00:00Z".to_string(), position: 0, notes: None,
            show_on_days, inscribed: false, inscribed_at: None, health_removed: 0.0,
        }
    }

    #[test]
    fn boss_scheduled_on_cadence() {
        let day = date("2026-06-30");
        let dow = day.weekday().num_days_from_sunday() as u8; // JS getDay for this day
        let other = (dow + 1) % 7;

        // Daily habits are scheduled every day.
        assert!(boss_scheduled_on(&sched_habit("daily", None), day));
        // Windowed + show_on_days: only on matching weekday.
        assert!(boss_scheduled_on(&sched_habit("windowed", Some(vec![dow])), day));
        assert!(!boss_scheduled_on(&sched_habit("windowed", Some(vec![other])), day));
        // Flexible windowed (no show_on_days): never scheduled on a given day.
        assert!(!boss_scheduled_on(&sched_habit("windowed", None), day));
    }

    fn completion(habit_id: &str, date_str: &str) -> Completion {
        Completion {
            id: uuid::Uuid::new_v4().to_string(),
            habit_id: habit_id.to_string(),
            completed_at: format!("{}T00:00:00Z", date_str),
        }
    }

    // ── most_recent_monday ───────────────────────────────────────────────────

    #[test]
    fn most_recent_monday_resolves_week_start() {
        // 2026-06-29 is a Monday → returns itself.
        assert_eq!(most_recent_monday(date("2026-06-29")), date("2026-06-29"));
        // Wednesday 2026-07-01 → previous Monday 2026-06-29.
        assert_eq!(most_recent_monday(date("2026-07-01")), date("2026-06-29"));
        // Sunday 2026-06-28 → Monday 2026-06-22.
        assert_eq!(most_recent_monday(date("2026-06-28")), date("2026-06-22"));
    }

    // ── importance_weight ────────────────────────────────────────────────────

    #[test]
    fn importance_weight_values() {
        let c = cfg();
        assert_eq!(importance_weight(&c, &Importance::Low), 1.0);
        assert_eq!(importance_weight(&c, &Importance::Medium), 1.5);
        assert_eq!(importance_weight(&c, &Importance::High), 2.0);
    }

    // ── daily_regen ──────────────────────────────────────────────────────────

    #[test]
    fn regen_at_zero_consistency() {
        assert_eq!(daily_regen(&cfg(), &Importance::High, 0.0), 0.0);
    }

    #[test]
    fn regen_at_full_consistency_low_importance() {
        // 3.0 × 1.0 × 1.0
        assert!((daily_regen(&cfg(), &Importance::Low, 1.0) - 3.0).abs() < 1e-9);
    }

    #[test]
    fn regen_at_half_consistency_medium_importance() {
        // 3.0 × 1.5 × 0.5 = 2.25
        assert!((daily_regen(&cfg(), &Importance::Medium, 0.5) - 2.25).abs() < 1e-9);
    }

    // ── miss_damage ──────────────────────────────────────────────────────────

    #[test]
    fn damage_at_zero_maturity_is_minimum() {
        assert_eq!(miss_damage(&cfg(), &Importance::High, 0.0), 5.0);
    }

    #[test]
    fn damage_at_full_maturity_low_importance() {
        // 15.0 × 1.0 × 1.0
        assert!((miss_damage(&cfg(), &Importance::Low, 1.0) - 15.0).abs() < 1e-9);
    }

    #[test]
    fn damage_at_half_maturity_high_importance() {
        // 15.0 × 2.0 × 0.5 = 15.0
        assert!((miss_damage(&cfg(), &Importance::High, 0.5) - 15.0).abs() < 1e-9);
    }

    // ── completion_gold ──────────────────────────────────────────────────────

    #[test]
    fn completion_gold_no_history_is_double_base() {
        // No completions → newbie bonus → 6.0 × 1.0 × 2.0 = 12.0
        let as_of = date("2026-04-26");
        let g = completion_gold(&cfg(), &Importance::Low, &[], as_of);
        assert!((g - 12.0).abs() < 1e-9, "expected 12.0, got {g}");
    }

    #[test]
    fn completion_gold_six_days_still_bonus() {
        // 6 out of 7 days completed → still in bonus period → 12.0
        let as_of = date("2026-04-26");
        let completions: Vec<Completion> = (1..=6i64)
            .map(|i| completion("h1", &(as_of - chrono::Duration::days(i)).format("%Y-%m-%d").to_string()))
            .collect();
        let g = completion_gold(&cfg(), &Importance::Low, &completions, as_of);
        assert!((g - 12.0).abs() < 1e-9, "expected 12.0, got {g}");
    }

    #[test]
    fn completion_gold_seven_days_drops_to_base() {
        // All 7 of last 7 days completed → bonus expires → 6.0 × 1.0 × 1.0 = 6.0
        let as_of = date("2026-04-26");
        let completions: Vec<Completion> = (1..=7i64)
            .map(|i| completion("h1", &(as_of - chrono::Duration::days(i)).format("%Y-%m-%d").to_string()))
            .collect();
        let g = completion_gold(&cfg(), &Importance::Low, &completions, as_of);
        assert!((g - 6.0).abs() < 1e-9, "expected 6.0, got {g}");
    }

    #[test]
    fn completion_gold_high_importance_base() {
        // Established high-importance habit: 6.0 × 2.0 × 1.0 = 12.0
        let as_of = date("2026-04-26");
        let completions: Vec<Completion> = (1..=7i64)
            .map(|i| completion("h1", &(as_of - chrono::Duration::days(i)).format("%Y-%m-%d").to_string()))
            .collect();
        let g = completion_gold(&cfg(), &Importance::High, &completions, as_of);
        assert!((g - 12.0).abs() < 1e-9, "expected 12.0, got {g}");
    }

    // ── gold_roll_bonus ──────────────────────────────────────────────────────

    #[test]
    fn gold_roll_bonus_zero_roll_gives_base() {
        assert_eq!(gold_roll_bonus(10.0, 0.0), 10.0);
    }

    #[test]
    fn gold_roll_bonus_max_roll_gives_twenty_percent() {
        // roll=1.0 → bonus_frac = 1.0 × 0.20 = 0.20 → floor(10 × 1.20) = 12
        assert_eq!(gold_roll_bonus(10.0, 1.0), 12.0);
    }

    #[test]
    fn gold_roll_bonus_mid_roll_is_skewed_low() {
        // roll=0.5 → bonus_frac = 0.25 × 0.20 = 0.05 → floor(10 × 1.05) = 10
        assert_eq!(gold_roll_bonus(10.0, 0.5), 10.0);
        // roll=0.9 → bonus_frac = 0.81 × 0.20 = 0.162 → floor(10 × 1.162) = 11
        assert_eq!(gold_roll_bonus(10.0, 0.9), 11.0);
    }

    // ── passive_gold ─────────────────────────────────────────────────────────

    #[test]
    fn passive_gold_at_zero_consistency_is_near_zero() {
        assert_eq!(passive_gold(&cfg(), &Importance::High, 0.0), 0.0);
    }

    #[test]
    fn passive_gold_at_full_consistency_low_importance() {
        // 12.0 × 1.0 × 1.0² = 12.0  (completes the ~18/day steady state with 6 completion base)
        assert!((passive_gold(&cfg(), &Importance::Low, 1.0) - 12.0).abs() < 1e-9);
    }

    #[test]
    fn passive_gold_at_full_consistency_high_importance() {
        // 12.0 × 2.0 × 1.0² = 24.0
        assert!((passive_gold(&cfg(), &Importance::High, 1.0) - 24.0).abs() < 1e-9);
    }

    #[test]
    fn passive_gold_at_half_consistency_medium() {
        // 12.0 × 1.5 × 0.25 = 4.5
        assert!((passive_gold(&cfg(), &Importance::Medium, 0.5) - 4.5).abs() < 1e-9);
    }

    // ── reschedule_cost ──────────────────────────────────────────────────────

    #[test]
    fn reschedule_cost_first_reschedule_low() {
        // ceil(50.0 × 1.0 × (1 + 0)) = 50
        assert_eq!(reschedule_cost(&cfg(), &Importance::Low, 0), 50);
    }

    #[test]
    fn reschedule_cost_escalates() {
        let c = cfg();
        let r0 = reschedule_cost(&c, &Importance::Low, 0); // 50
        let r1 = reschedule_cost(&c, &Importance::Low, 1); // 100
        let r2 = reschedule_cost(&c, &Importance::Low, 2); // 150
        assert_eq!(r0, 50);
        assert_eq!(r1, 100);
        assert_eq!(r2, 150);
    }

    #[test]
    fn reschedule_cost_high_importance() {
        // ceil(50.0 × 2.0 × 1) = 100
        assert_eq!(reschedule_cost(&cfg(), &Importance::High, 0), 100);
    }

    // ── reschedule_extension_days ────────────────────────────────────────────

    #[test]
    fn extension_days_normal() {
        // floor(7 × 0.5) = 3
        assert_eq!(reschedule_extension_days(&cfg(), 7), 3);
    }

    #[test]
    fn extension_days_minimum_one() {
        // floor(1 × 0.5) = 0, clamped to 1
        assert_eq!(reschedule_extension_days(&cfg(), 1), 1);
    }

    #[test]
    fn extension_days_30_day_window() {
        // floor(30 × 0.5) = 15
        assert_eq!(reschedule_extension_days(&cfg(), 30), 15);
    }

    // ── compute_consistency_daily ────────────────────────────────────────────

    #[test]
    fn consistency_daily_no_completions_is_zero() {
        let c = compute_consistency_daily(&cfg(), &[], date("2026-04-25"));
        assert_eq!(c, 0.0);
    }

    #[test]
    fn consistency_daily_full_window() {
        let as_of = date("2026-04-25");
        let window = cfg().consistency_window_days;
        let completions: Vec<Completion> = (0..window as i64)
            .map(|i| {
                let d = as_of - chrono::Duration::days(i + 1);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();
        let c = compute_consistency_daily(&cfg(), &completions, as_of);
        assert!((c - 1.0).abs() < 1e-9, "expected 1.0, got {c}");
    }

    #[test]
    fn consistency_daily_half_window() {
        let as_of = date("2026-04-25");
        let half = cfg().consistency_window_days / 2;
        let completions: Vec<Completion> = (0..half as i64)
            .map(|i| {
                let d = as_of - chrono::Duration::days(i + 1);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();
        let c = compute_consistency_daily(&cfg(), &completions, as_of);
        assert!((c - 0.5).abs() < 1e-9, "expected 0.5, got {c}");
    }

    #[test]
    fn consistency_daily_new_habit_uses_full_30_day_window() {
        // Habit only 5 days old with 3 completions — denominator is always 30.
        let as_of = date("2026-04-25");
        let created = date("2026-04-20");
        let completions: Vec<Completion> = [
            "2026-04-21",
            "2026-04-22",
            "2026-04-23",
        ]
        .iter()
        .map(|d| completion("h1", d))
        .collect();
        let c = compute_consistency_daily_with_created(&cfg(), &completions, as_of, created);
        let expected = 3.0 / 30.0;
        assert!((c - expected).abs() < 1e-9, "expected {expected}, got {c}");
    }

    #[test]
    fn consistency_daily_seven_perfect_days_is_not_full_mastery() {
        // 7 completions in 30-day window = 7/30, not 100%.
        let as_of = date("2026-04-25");
        let created = date("2026-04-18");
        let completions: Vec<Completion> = (1..=7i64)
            .map(|i| {
                let d = as_of - chrono::Duration::days(i);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();
        let c = compute_consistency_daily_with_created(&cfg(), &completions, as_of, created);
        let expected = 7.0 / 30.0;
        assert!((c - expected).abs() < 1e-9, "expected {expected}, got {c}");
    }

    // ── compute_consistency_windowed ─────────────────────────────────────────

    #[test]
    fn consistency_windowed_no_completions() {
        let c = compute_consistency_windowed(&cfg(), &[], date("2026-04-25"), 7);
        assert_eq!(c, 0.0);
    }

    #[test]
    fn consistency_windowed_all_cycles_completed() {
        let as_of = date("2026-04-25");
        let cycles = cfg().consistency_window_cycles;
        let window_days = 7i64;
        // One completion in each of the last 10 cycles (one per cycle).
        let completions: Vec<Completion> = (0..cycles as i64)
            .map(|i| {
                // Place each completion 1 day into its cycle from the end.
                let d = as_of - chrono::Duration::days(i * window_days + 1);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();
        let c = compute_consistency_windowed(&cfg(), &completions, as_of, 7);
        assert!((c - 1.0).abs() < 1e-9, "expected 1.0, got {c}");
    }

    #[test]
    fn consistency_windowed_half_cycles_completed() {
        let as_of = date("2026-04-25");
        let cycles = cfg().consistency_window_cycles; // 10
        let window_days = 7i64;
        // Complete 5 of the last 10 cycles (every other cycle).
        let completions: Vec<Completion> = (0..cycles as i64)
            .filter(|i| i % 2 == 0)
            .map(|i| {
                let d = as_of - chrono::Duration::days(i * window_days + 1);
                completion("h1", &d.format("%Y-%m-%d").to_string())
            })
            .collect();
        let c = compute_consistency_windowed(&cfg(), &completions, as_of, 7);
        assert!((c - 0.5).abs() < 1e-9, "expected 0.5, got {c}");
    }

    #[test]
    fn consistency_windowed_zero_percent() {
        // Place all completions outside the 10-cycle lookback window.
        let as_of = date("2026-04-25");
        let cycles = cfg().consistency_window_cycles as i64;
        let window_days = 7i64;
        let far_past = as_of - chrono::Duration::days(cycles * window_days + 30);
        let completions = vec![completion("h1", &far_past.format("%Y-%m-%d").to_string())];
        let c = compute_consistency_windowed(&cfg(), &completions, as_of, 7);
        assert_eq!(c, 0.0, "expected 0.0, got {c}");
    }

    // ── daily_completion ─────────────────────────────────────────────────────

    #[test]
    fn daily_completion_rest_day_deals_nothing() {
        assert_eq!(daily_completion(0, 0), 0.0);
    }

    #[test]
    fn daily_completion_two_of_two_capped_under_half() {
        // 2/2 perfect = tanh(0.4) × 1.0 ≈ 0.380 — must stay ≤ 0.5.
        let p = daily_completion(2, 2);
        assert!((p - 0.3799).abs() < 1e-3, "got {p}");
        assert!(p <= 0.5);
    }

    #[test]
    fn daily_completion_inconsistency_punished() {
        // 4/10 = tanh(4/5) × 0.4 ≈ 0.266 — well below a perfect 5/5.
        let partial = daily_completion(10, 4);
        let perfect5 = daily_completion(5, 5); // tanh(1) ≈ 0.762
        assert!((partial - 0.2656).abs() < 1e-3, "got {partial}");
        assert!(partial < perfect5);
    }

    #[test]
    fn daily_completion_beats_empty_day() {
        // The motivating case: 9/10 must out-damage a rest day.
        assert!(daily_completion(10, 9) > daily_completion(0, 0));
    }

    #[test]
    fn daily_completion_effort_is_concave() {
        // tanh ramp: marginal gain per completion diminishes.
        let d1 = daily_completion(1, 1);
        let d2 = daily_completion(2, 2);
        let d3 = daily_completion(3, 3);
        assert!(d2 - d1 > d3 - d2);
    }

    // ── boss_effective_multiplier ─────────────────────────────────────────────

    #[test]
    fn armor_zero_keeps_full_multiplier() {
        assert!((boss_effective_multiplier(2.5, 0) - 2.5).abs() < 1e-9);
    }

    #[test]
    fn armor_halves_bonus_at_k() {
        // armor == K(100): reduction 0.5 → eff = 1 + (2.5-1)*0.5 = 1.75
        assert!((boss_effective_multiplier(2.5, 100) - 1.75).abs() < 1e-9);
    }

    #[test]
    fn armor_floors_at_one_and_only_shaves_bonus() {
        // Huge armor approaches 1.0 but never below.
        let eff = boss_effective_multiplier(2.5, 100_000);
        assert!(eff > 1.0 && eff < 1.01);
        // No boss (mult 1.0) stays 1.0 regardless of armor.
        assert!((boss_effective_multiplier(1.0, 200) - 1.0).abs() < 1e-9);
    }

    // ── boss_damage_gear_bonus ─────────────────────────────────────────────────

    #[test]
    fn damage_zero_is_no_bonus() {
        assert!((boss_damage_gear_bonus(0) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn damage_bonus_diminishes_and_caps() {
        // K=100: damage 100 → +0.4*0.5 = +0.20
        assert!((boss_damage_gear_bonus(100) - 1.20).abs() < 1e-9);
        // Approaches +40% but never exceeds.
        let big = boss_damage_gear_bonus(1_000_000);
        assert!(big < 1.4 && big > 1.39);
    }

    // ── apply_wear ───────────────────────────────────────────────────────────

    #[test]
    fn apply_wear_reduces_durability() {
        use crate::models::{EquipmentState, Item, Importance};
        let item = Item {
            id: "wpn-n-1".to_string(),
            name: "Worn Sword".to_string(),
            slot: "weapon".to_string(),
            tier: "normal".to_string(),
            damage: 5,
            armor: 0,
            price: 50,
            description: "test".to_string(),
            required_renown: None,
            max_durability: 100,
        };
        let mut eq = EquipmentState::default();
        eq.equipped.insert("weapon".to_string(), "wpn-n-1".to_string());

        let (eq2, broken) = apply_wear(&eq, 10, &[item]);
        assert!(broken.is_empty());
        assert_eq!(*eq2.durability.get("wpn-n-1").unwrap(), 90);
    }

    #[test]
    fn apply_wear_breaks_item_at_zero() {
        use crate::models::{EquipmentState, Item};
        let item = Item {
            id: "wpn-n-1".to_string(),
            name: "Worn Sword".to_string(),
            slot: "weapon".to_string(),
            tier: "normal".to_string(),
            damage: 5,
            armor: 0,
            price: 50,
            description: "test".to_string(),
            required_renown: None,
            max_durability: 10,
        };
        let mut eq = EquipmentState::default();
        eq.equipped.insert("weapon".to_string(), "wpn-n-1".to_string());
        eq.durability.insert("wpn-n-1".to_string(), 5);

        let (eq2, broken) = apply_wear(&eq, 10, &[item]);
        assert_eq!(broken, vec!["wpn-n-1"]);
        assert!(eq2.equipped.is_empty(), "broken item must be unequipped");
        assert!(eq2.durability.get("wpn-n-1").is_none(), "broken item durability must be removed");
    }
}
