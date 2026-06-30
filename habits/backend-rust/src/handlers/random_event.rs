use axum::{extract::State, http::HeaderMap, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use chrono::Utc;

use crate::error::AppError;
use crate::game;
use crate::models::{ActiveRandomEvent, ResolvedRandomEvent, HealthEvent, GoldEvent};
use crate::random_events_catalogue::{self as cat, EventKind, StatType};
use super::AppState;

/// Reveal a boss when an event with `reveals_boss` resolves. The weighted
/// sentinel picks a difficulty-weighted boss not already revealed, hosted, or
/// in an active quest; a concrete id reveals that specific boss. Best-effort.
async fn reveal_from_event(state: &AppState, reveals: &str, today_str: &str) {
    let mut boss_state = state.store.boss.get();

    let chosen_id: Option<String> = if reveals == cat::REVEAL_WEIGHTED {
        let mut exclude: Vec<String> =
            boss_state.revealed.iter().map(|r| r.boss_id.clone()).collect();
        if let Some(p) = &boss_state.participating {
            if p.outcome.is_none() { exclude.push(p.boss_id.clone()); }
        }
        if let Some(h) = &boss_state.hosted { exclude.push(h.boss_id.clone()); }
        let ex: Vec<&str> = exclude.iter().map(|s| s.as_str()).collect();
        crate::bosses_catalogue::pick_weighted_unrevealed(&ex).map(|b| b.id.to_string())
    } else {
        Some(reveals.to_string())
    };

    if let Some(id) = chosen_id {
        if !boss_state.revealed.iter().any(|r| r.boss_id == id) {
            boss_state.revealed.push(crate::models::RevealedBoss {
                boss_id: id,
                revealed_at: today_str.to_string(),
            });
            let _ = state.store.boss.save(boss_state).await;
        }
    }
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OptionInfo {
    label: String,
    prompt: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CurrentEventInfo {
    event_id: String,
    title: String,
    text: String,
    kind: String,
    options: Vec<OptionInfo>,
    appeared_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GetRandomEventResponse {
    current: Option<CurrentEventInfo>,
    next_event_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveResponse {
    pub outcome_text: String,
    pub hp_delta: f64,
    pub gold_delta: f64,
    pub new_hp: f64,
    pub new_gold: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChooseBody {
    pub option_index: usize,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn compute_stats(state: &AppState) -> (u32, u32, f64) {
    let character = state.store.character.get();
    let eq = state.store.equipment.get();
    let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
            (d + item.damage, a + item.armor)
        } else {
            (d, a)
        }
    });
    (damage, armor, character.hp)
}

fn make_current_info(def: &cat::EventDef, active: &ActiveRandomEvent) -> CurrentEventInfo {
    let (kind_str, options) = match &def.kind {
        EventKind::Passive { .. } => ("passive".to_string(), vec![]),
        EventKind::Choice { options } => (
            "choice".to_string(),
            options.iter().map(|o| OptionInfo {
                label: o.label.to_string(),
                prompt: o.prompt.to_string(),
            }).collect(),
        ),
    };
    CurrentEventInfo {
        event_id: def.id.to_string(),
        title: def.title.to_string(),
        text: def.text.to_string(),
        kind: kind_str,
        options,
        appeared_at: active.appeared_at.clone(),
    }
}

async fn apply_outcome(
    state: &AppState,
    hp_delta_raw: f64,
    gold_delta: f64,
    title: &str,
    is_passive: bool,
) -> Result<(f64, f64, f64, f64), AppError> {
    let mut character = state.store.character.get();
    let today_str = game::today_str();

    let new_hp = if is_passive {
        (character.hp + hp_delta_raw).max(10.0).min(100.0)
    } else {
        (character.hp + hp_delta_raw).clamp(0.0, 100.0)
    };
    let hp_delta_actual = new_hp - character.hp;
    let new_gold = game::apply_gold_delta(character.gold, gold_delta);

    if hp_delta_actual != 0.0 {
        let ev = HealthEvent {
            id: Uuid::new_v4().to_string(),
            event_type: if hp_delta_actual > 0.0 { "regen".to_string() } else { "damage".to_string() },
            amount: hp_delta_actual.abs(),
            reason: format!("Encounter: {}", title),
            habit_id: None,
            tick_date: today_str.clone(),
        };
        state.store.events.append_health(ev).await?;
    }

    if gold_delta != 0.0 {
        let ev = GoldEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "random_event".to_string(),
            amount: gold_delta,
            reason: format!("Encounter: {}", title),
            habit_id: None,
            timestamp: Utc::now().to_rfc3339(),
        };
        state.store.events.append_gold(ev).await?;
    }

    character.hp = new_hp;
    character.gold = new_gold;
    state.store.character.save(character).await?;

    Ok((hp_delta_actual, gold_delta, new_hp, new_gold))
}

// ── GET /api/random-event ─────────────────────────────────────────────────────

pub async fn get_random_event(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today_str = game::today_str();
    let today = game::today();
    let catalogue = cat::catalogue();

    let mut ev_state = state.store.random_events.get();

    // If there's an active event, return it
    if let Some(ref active) = ev_state.current.clone() {
        if let Some(def) = catalogue.iter().find(|e| e.id == active.event_id) {
            let resp = GetRandomEventResponse {
                current: Some(make_current_info(def, active)),
                next_event_at: ev_state.next_event_at.clone(),
            };
            return Ok(Json(serde_json::to_value(resp).unwrap()));
        }
    }

    // Check if it's time for a new event
    let should_spawn = match &ev_state.next_event_at {
        None => true,
        Some(next) => today_str >= *next,
    };

    if should_spawn {
        let history_ids: Vec<String> = ev_state.history.iter().map(|h| h.event_id.clone()).collect();
        let event_id = cat::pick_event_id(&history_ids);
        let def = catalogue.iter().find(|e| e.id == event_id).expect("event in catalogue");

        let active = ActiveRandomEvent {
            event_id: event_id.clone(),
            appeared_at: today_str.clone(),
        };
        ev_state.current = Some(active.clone());
        state.store.random_events.save(ev_state.clone()).await?;

        let resp = GetRandomEventResponse {
            current: Some(make_current_info(def, &active)),
            next_event_at: ev_state.next_event_at,
        };
        return Ok(Json(serde_json::to_value(resp).unwrap()));
    }

    let _ = today; // suppress unused warning
    let resp = GetRandomEventResponse {
        current: None,
        next_event_at: ev_state.next_event_at,
    };
    Ok(Json(serde_json::to_value(resp).unwrap()))
}

// ── POST /api/random-event/resolve (passive) ──────────────────────────────────

pub async fn resolve_random_event(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ResolveResponse>, AppError> {
    super::require_auth(&headers, &state).await?;

    let mut ev_state = state.store.random_events.get();
    let active = ev_state.current.take()
        .ok_or_else(|| AppError::Validation("No active event".to_string()))?;

    let catalogue = cat::catalogue();
    let def = catalogue.iter().find(|e| e.id == active.event_id)
        .ok_or_else(|| AppError::Validation("Unknown event".to_string()))?;

    let (stat, tiers) = match &def.kind {
        EventKind::Passive { stat, tiers } => (stat, tiers),
        EventKind::Choice { .. } => {
            ev_state.current = Some(active);
            return Err(AppError::Validation("Choice event — use /choose".to_string()));
        }
    };

    let (damage, armor, hp) = compute_stats(&state);
    let stat_value = match stat {
        StatType::Armor => armor,
        StatType::Damage => damage,
        StatType::Hp => hp as u32,
        StatType::None => 0,
    };

    let outcome = cat::resolve_passive(tiers, stat_value);
    let (hp_delta_actual, gold_delta, new_hp, new_gold) =
        apply_outcome(&state, outcome.hp_delta, outcome.gold_delta, def.title, true).await?;

    let today_str = game::today_str();
    let resolved = ResolvedRandomEvent {
        event_id: def.id.to_string(),
        title: def.title.to_string(),
        appeared_at: active.appeared_at.clone(),
        resolved_at: today_str.clone(),
        choice_made: None,
        outcome_text: outcome.text.to_string(),
        hp_delta: hp_delta_actual,
        gold_delta,
    };
    ev_state.history.insert(0, resolved);
    ev_state.history.truncate(10);
    ev_state.next_event_at = Some(cat::next_event_date(game::today()));
    state.store.random_events.save(ev_state).await?;

    if let Some(reveals) = def.reveals_boss {
        reveal_from_event(&state, reveals, &today_str).await;
    }

    Ok(Json(ResolveResponse {
        outcome_text: outcome.text.to_string(),
        hp_delta: hp_delta_actual,
        gold_delta,
        new_hp,
        new_gold,
    }))
}

// ── POST /api/random-event/choose ─────────────────────────────────────────────

pub async fn choose_random_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ChooseBody>,
) -> Result<Json<ResolveResponse>, AppError> {
    super::require_auth(&headers, &state).await?;

    let mut ev_state = state.store.random_events.get();
    let active = ev_state.current.take()
        .ok_or_else(|| AppError::Validation("No active event".to_string()))?;

    let catalogue = cat::catalogue();
    let def = catalogue.iter().find(|e| e.id == active.event_id)
        .ok_or_else(|| AppError::Validation("Unknown event".to_string()))?;

    let options = match &def.kind {
        EventKind::Choice { options } => options,
        EventKind::Passive { .. } => {
            ev_state.current = Some(active);
            return Err(AppError::Validation("Passive event — use /resolve".to_string()));
        }
    };

    let chosen = options.get(body.option_index)
        .ok_or_else(|| AppError::Validation("Invalid option index".to_string()))?;

    let (damage, armor, hp) = compute_stats(&state);
    let outcome = cat::resolve_choice_effect(&chosen.effect, damage, armor, hp);

    let (hp_delta_actual, gold_delta, new_hp, new_gold) =
        apply_outcome(&state, outcome.hp_delta, outcome.gold_delta, def.title, false).await?;

    let today_str = game::today_str();
    let resolved = ResolvedRandomEvent {
        event_id: def.id.to_string(),
        title: def.title.to_string(),
        appeared_at: active.appeared_at.clone(),
        resolved_at: today_str.clone(),
        choice_made: Some(chosen.label.to_string()),
        outcome_text: outcome.text.to_string(),
        hp_delta: hp_delta_actual,
        gold_delta,
    };
    ev_state.history.insert(0, resolved);
    ev_state.history.truncate(10);
    ev_state.next_event_at = Some(cat::next_event_date(game::today()));
    state.store.random_events.save(ev_state).await?;

    if let Some(reveals) = def.reveals_boss {
        reveal_from_event(&state, reveals, &today_str).await;
    }

    Ok(Json(ResolveResponse {
        outcome_text: outcome.text.to_string(),
        hp_delta: hp_delta_actual,
        gold_delta,
        new_hp,
        new_gold,
    }))
}

// ── GET /api/random-event/history ─────────────────────────────────────────────

pub async fn get_random_event_history(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let ev_state = state.store.random_events.get();
    Ok(Json(serde_json::to_value(&ev_state.history).unwrap()))
}

// ── POST /api/encounters ──────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InjectEncounterBody {
    pub event_id: String,
    pub title: String,
    pub outcome_text: String,
}

pub async fn inject_encounter(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<InjectEncounterBody>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today = game::today_str();
    let resolved = ResolvedRandomEvent {
        event_id: body.event_id,
        title: body.title,
        appeared_at: today.clone(),
        resolved_at: today,
        choice_made: None,
        outcome_text: body.outcome_text,
        hp_delta: 0.0,
        gold_delta: 0.0,
    };

    let mut ev_state = state.store.random_events.get();
    ev_state.history.insert(0, resolved);
    ev_state.history.truncate(10);
    state.store.random_events.save(ev_state).await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
