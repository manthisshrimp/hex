use serde::{Deserialize, Serialize};

// ── Importance ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Importance {
    Low,
    Medium,
    High,
}

// ── Core data structures ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub importance: Importance,
    pub frequency: String,   // "daily" or "windowed"
    pub window_days: u32,    // 1 for daily
    pub active: bool,
    pub system: bool,        // if true: cannot be edited/deleted/paused
    pub created_at: String,  // ISO datetime
    #[serde(default)]
    pub position: u32,       // manual sort order; 0 = first
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_on_days: Option<Vec<u8>>,  // JS getDay() values: 0=Sun 1=Mon … 6=Sat; windowed only
    #[serde(default)]
    pub inscribed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inscribed_at: Option<String>,   // ISO datetime when the habit was inscribed
    #[serde(default)]
    pub health_removed: f64,            // cumulative HP drained by misses; caps passive healing
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Completion {
    pub id: String,
    pub habit_id: String,
    pub completed_at: String,  // ISO datetime
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,   // "damage" or "regen"
    pub amount: f64,          // always positive
    pub reason: String,
    pub habit_id: Option<String>,
    pub tick_date: String,    // YYYY-MM-DD
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoldEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,   // "completion_bonus" | "passive_income" | "reschedule_cost"
    pub amount: f64,          // positive = earn, negative = spend
    pub reason: String,
    pub habit_id: Option<String>,
    pub timestamp: String,    // ISO datetime
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub hp: f64,              // 0.0–100.0, display as integer
    pub gold: f64,            // non-negative, display as integer floor
    pub last_tick_date: String,  // YYYY-MM-DD
    #[serde(default)]
    pub renown: f64,          // decays 1/day; filled by good deeds at full HP
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

// ── API response types ────────────────────────────────────────────────────────

/// Habit with computed fields — returned by GET /api/habits
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitWithState {
    #[serde(flatten)]
    pub habit: Habit,
    pub consistency: f64,              // 0.0–1.0
    pub next_deadline: String,         // YYYY-MM-DD
    pub reschedule_cost: Option<u64>,  // None for daily habits
    pub can_complete: bool,            // false if already completed this cycle
    pub can_backfill: bool,            // true if yesterday has no completion
    pub completion_gold: f64,          // gold earned on next completion
    pub passive_gold: f64,             // passive gold earned per day tick
    pub streak: u32,                   // consecutive completed cycles
}

// ── Equipment ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub name: String,
    pub slot: String,   // weapon|offhand|helm|chest|gloves|belt|boots|amulet|ring
    pub tier: String,   // normal|magic|rare|unique
    pub damage: u32,
    pub armor: u32,
    pub price: u64,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_renown: Option<u32>,
}

/// Persisted per-character equipment state.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EquipmentState {
    /// slot name → item id. Rings use "ring1" / "ring2".
    pub equipped: std::collections::HashMap<String, String>,
    /// item ids owned but not necessarily equipped
    pub inventory: Vec<String>,
}

/// A habit shown in the morning check-in prompt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckinHabit {
    pub id: String,
    pub name: String,
    pub importance: Importance,
    pub notes: Option<String>,
}

/// Augmented character response including computed damage/armor totals.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterResponse {
    pub hp: f64,
    pub gold: f64,
    pub last_tick_date: String,
    pub damage: u32,
    pub armor: u32,
    pub renown: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Present only when yesterday's habits need confirmation before damage is applied.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_checkin: Option<Vec<CheckinHabit>>,
}

// ── Random Events ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveRandomEvent {
    pub event_id: String,
    pub appeared_at: String,  // YYYY-MM-DD
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedRandomEvent {
    pub event_id: String,
    pub title: String,
    pub appeared_at: String,
    pub resolved_at: String,
    pub choice_made: Option<String>,
    pub outcome_text: String,
    pub hp_delta: f64,
    pub gold_delta: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RandomEventState {
    pub current: Option<ActiveRandomEvent>,
    pub next_event_at: Option<String>,  // YYYY-MM-DD
    pub history: Vec<ResolvedRandomEvent>,
}

// ── Todos ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub created_date: String,  // YYYY-MM-DD
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_board_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoWithGold {
    #[serde(flatten)]
    pub todo: Todo,
    pub gold: f64,
}

// ── Deeds ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deed {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub deed_type: String,   // "good" or "bad"
    pub importance: Importance,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeedLog {
    pub id: String,
    pub deed_id: String,
    pub logged_at: String,  // YYYY-MM-DD
    pub renown_delta: f64,
    pub hp_delta: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeedWithState {
    #[serde(flatten)]
    pub deed: Deed,
    pub logged_today: bool,
    pub effect: f64,  // renown/HP amount: 3 low / 5 medium / 8 high
}

// ── Request bodies ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHabitRequest {
    pub name: String,
    pub importance: Importance,
    pub frequency: String,
    pub window_days: Option<u32>,
    pub notes: Option<String>,
    #[serde(default)]
    pub show_on_days: Option<Vec<u8>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHabitRequest {
    pub name: Option<String>,
    pub importance: Option<Importance>,
    pub frequency: Option<String>,
    pub window_days: Option<u32>,
    pub active: Option<bool>,
    pub notes: Option<String>,
    #[serde(default)]
    pub show_on_days: Option<Vec<u8>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeedRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub deed_type: String,
    pub importance: Importance,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDeedRequest {
    pub name: Option<String>,
    pub importance: Option<Importance>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuthRequest {
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCharacterRequest {
    pub name: Option<String>,
}

// ── Party ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCharacter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub hp: f64,
    pub armor: u32,
    pub damage: u32,
    pub renown: f64,
    pub last_seen: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PartyMemberRecord {
    pub url: String,
    pub added_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_cheer_sent_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_public: Option<PublicCharacter>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheerReceived {
    pub from_url: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PartyState {
    #[serde(default)]
    pub members: Vec<PartyMemberRecord>,
    #[serde(default)]
    pub cheers_received_log: Vec<CheerReceived>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMemberRequest {
    pub url: String,
    pub my_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMeRequest {
    pub url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveMemberRequest {
    pub url: String,
    pub my_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheerRequest {
    pub target_url: String,
    pub my_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveMeRequest {
    pub url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiveCheerRequest {
    pub from_url: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_importance_serializes_lowercase() {
        assert_eq!(serde_json::to_string(&Importance::Low).unwrap(), "\"low\"");
        assert_eq!(serde_json::to_string(&Importance::Medium).unwrap(), "\"medium\"");
        assert_eq!(serde_json::to_string(&Importance::High).unwrap(), "\"high\"");
    }

    #[test]
    fn test_health_event_type_field_renamed() {
        let ev = HealthEvent {
            id: "1".to_string(),
            event_type: "damage".to_string(),
            amount: 10.0,
            reason: "missed".to_string(),
            habit_id: None,
            tick_date: "2026-04-25".to_string(),
        };
        let v: serde_json::Value = serde_json::to_value(&ev).unwrap();
        assert!(v.get("type").is_some(), "event_type should serialize as 'type'");
        assert!(v.get("event_type").is_none());
    }

    #[test]
    fn test_gold_event_camel_case() {
        let ev = GoldEvent {
            id: "2".to_string(),
            event_type: "completion_bonus".to_string(),
            amount: 50.0,
            reason: "completed daily".to_string(),
            habit_id: Some("h1".to_string()),
            timestamp: "2026-04-25T10:00:00Z".to_string(),
        };
        let v: serde_json::Value = serde_json::to_value(&ev).unwrap();
        assert!(v.get("habitId").is_some(), "habit_id should serialize as habitId");
    }
}
