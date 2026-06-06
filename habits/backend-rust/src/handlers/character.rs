use axum::{extract::State, http::HeaderMap, Json};
use chrono::NaiveDate;
use uuid::Uuid;
use std::collections::HashMap;
use serde::Deserialize;

use crate::error::AppError;
use crate::models::{Character, CharacterResponse, CheckinHabit, Completion, GoldEvent, Importance};
use crate::game::{self, SYSTEM_HABIT_ID};
use crate::tick::{TickInput, process_tick};
use super::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckinRequest {
    pub completed_ids: Vec<String>,
}

pub async fn get_character(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<CharacterResponse>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today = game::today();
    let today_str = game::today_str();

    // ── Step 1: Auto-complete the system habit for today ──────────────────────
    let sys_completions = state.store.completions.get_for_habit(SYSTEM_HABIT_ID);
    let already_done = sys_completions
        .iter()
        .any(|c| c.completed_at.get(..10).unwrap_or("") == today_str);

    if !already_done {
        let completion = Completion {
            id: Uuid::new_v4().to_string(),
            habit_id: SYSTEM_HABIT_ID.to_string(),
            completed_at: chrono::Utc::now().to_rfc3339(),
        };
        state.store.completions.append(completion).await?;

        // Award completion gold: use today+1 as as_of so today's completion counts
        // toward the 7-day established check (same as complete_habit does).
        let gold_earned = game::completion_gold(
            &state.config,
            &Importance::Low,
            &sys_completions,
            today + chrono::Duration::days(1),
        );
        let gold_event = GoldEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "completion_bonus".to_string(),
            amount: gold_earned,
            reason: "Open the app".to_string(),
            habit_id: Some(SYSTEM_HABIT_ID.to_string()),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        state.store.events.append_gold(gold_event).await?;

        let mut character = state.store.character.get();
        character.gold = game::apply_gold_delta(character.gold, gold_earned);
        state.store.character.save(character).await?;

        // Advance system habit deadline to tomorrow.
        let next_day = (today + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        state.store.deadlines.set(SYSTEM_HABIT_ID, &next_day).await?;
    }

    // ── Step 2: Catch up ticks through yesterday (stop before today) ────────────
    // Today's tick is held until the morning check-in is confirmed.
    let character = state.store.character.get();
    let last_tick: NaiveDate = NaiveDate::parse_from_str(&character.last_tick_date, "%Y-%m-%d")
        .unwrap_or(today);

    if last_tick < today {
        let all_habits = state.store.habits.get_all();
        let active_habits: Vec<_> = all_habits.iter().filter(|h| h.active).cloned().collect();
        let all_completions = state.store.completions.get_all();

        // Ensure initial deadlines exist for every active habit.
        for habit in &active_habits {
            if state.store.deadlines.get(&habit.id).is_none() {
                let created_date = game::parse_iso_date(&habit.created_at).unwrap_or(today);
                let initial_deadline = if habit.frequency == "windowed" {
                    created_date + chrono::Duration::days(habit.window_days as i64)
                } else {
                    created_date
                };
                state.store.deadlines.set(
                    &habit.id,
                    &initial_deadline.format("%Y-%m-%d").to_string(),
                ).await?;
            }
        }

        let mut current_character = state.store.character.get();
        let mut day = last_tick + chrono::Duration::days(1);

        // Stop strictly before today — today's tick waits for check-in.
        while day < today {
            let raw_deadlines = state.store.deadlines.get_all();
            let deadlines: HashMap<String, NaiveDate> = raw_deadlines
                .iter()
                .filter_map(|(k, v)| {
                    NaiveDate::parse_from_str(v, "%Y-%m-%d").ok().map(|d| (k.clone(), d))
                })
                .collect();

            let input = TickInput {
                date: day,
                habits: active_habits.clone(),
                deadlines,
                completions: all_completions.clone(),
                current_hp: current_character.hp,
                current_gold: current_character.gold,
                current_renown: current_character.renown,
                config: state.config.clone(),
            };

            let output = process_tick(input);

            for ev in output.health_events {
                state.store.events.append_health(ev).await?;
            }
            for ev in output.gold_events {
                state.store.events.append_gold(ev).await?;
            }
            for update in output.deadline_updates {
                state.store.deadlines.set(
                    &update.habit_id,
                    &update.new_deadline.format("%Y-%m-%d").to_string(),
                ).await?;
            }

            current_character.hp = output.new_hp;
            current_character.gold = output.new_gold;
            current_character.renown = output.new_renown;
            current_character.last_tick_date = day.format("%Y-%m-%d").to_string();
            day += chrono::Duration::days(1);
        }

        state.store.character.save(current_character).await?;
    }

    // ── Step 3: Check if today's tick is pending and needs check-in ─────────────
    let character = state.store.character.get();
    let last_tick_now: NaiveDate = NaiveDate::parse_from_str(&character.last_tick_date, "%Y-%m-%d")
        .unwrap_or(today);

    if last_tick_now < today {
        // Today's tick hasn't run yet. Find habits due yesterday with no completion.
        let yesterday = today - chrono::Duration::days(1);
        let yesterday_str = yesterday.format("%Y-%m-%d").to_string();
        let raw_deadlines = state.store.deadlines.get_all();
        let all_habits = state.store.habits.get_all();
        let all_completions = state.store.completions.get_all();

        let pending: Vec<CheckinHabit> = all_habits.iter()
            .filter(|h| h.active && h.id != SYSTEM_HABIT_ID)
            .filter(|h| raw_deadlines.get(&h.id).map(|d| d == &yesterday_str).unwrap_or(false))
            .filter(|h| !all_completions.iter().any(|c| {
                c.habit_id == h.id && c.completed_at.get(..10).unwrap_or("") == yesterday_str
            }))
            .map(|h| CheckinHabit {
                id: h.id.clone(),
                name: h.name.clone(),
                importance: h.importance.clone(),
                notes: h.notes.clone(),
            })
            .collect();

        if !pending.is_empty() {
            // Return the character data as-is with the pending list.
            // Today's tick (and damage) will run after the check-in is submitted.
            let eq = state.store.equipment.get();
            let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
                if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
                    (d + item.damage, a + item.armor)
                } else { (d, a) }
            });
            return Ok(Json(CharacterResponse {
                hp: character.hp,
                gold: character.gold,
                last_tick_date: character.last_tick_date.clone(),
                damage,
                armor,
                renown: character.renown,
                name: character.name.clone(),
                pending_checkin: Some(pending),
            }));
        }

        // No pending habits — run today's tick immediately.
        run_today_tick(&state, today).await?;
    }

    let character = state.store.character.get();

    // Compute damage/armor totals from equipped items.
    let eq = state.store.equipment.get();
    let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
            (d + item.damage, a + item.armor)
        } else {
            (d, a)
        }
    });

    Ok(Json(CharacterResponse {
        hp: character.hp,
        gold: character.gold,
        last_tick_date: character.last_tick_date,
        damage,
        armor,
        renown: character.renown,
        name: character.name.clone(),
        pending_checkin: None,
    }))
}

// ── Shared tick helper ────────────────────────────────────────────────────────

async fn run_today_tick(state: &AppState, today: NaiveDate) -> Result<(), AppError> {
    let all_habits = state.store.habits.get_all();
    let active_habits: Vec<_> = all_habits.iter().filter(|h| h.active).cloned().collect();
    let all_completions = state.store.completions.get_all();
    let raw_deadlines = state.store.deadlines.get_all();
    let deadlines: HashMap<String, NaiveDate> = raw_deadlines.iter()
        .filter_map(|(k, v)| NaiveDate::parse_from_str(v, "%Y-%m-%d").ok().map(|d| (k.clone(), d)))
        .collect();

    let mut current_character = state.store.character.get();
    let input = TickInput {
        date: today,
        habits: active_habits,
        deadlines,
        completions: all_completions,
        current_hp: current_character.hp,
        current_gold: current_character.gold,
        current_renown: current_character.renown,
        config: state.config.clone(),
    };
    let output = process_tick(input);

    for ev in output.health_events { state.store.events.append_health(ev).await?; }
    for ev in output.gold_events { state.store.events.append_gold(ev).await?; }
    for update in output.deadline_updates {
        state.store.deadlines.set(
            &update.habit_id,
            &update.new_deadline.format("%Y-%m-%d").to_string(),
        ).await?;
    }

    current_character.hp = output.new_hp;
    current_character.gold = output.new_gold;
    current_character.renown = output.new_renown;
    current_character.last_tick_date = today.format("%Y-%m-%d").to_string();
    state.store.character.save(current_character).await?;
    Ok(())
}

// ── POST /api/character/checkin ───────────────────────────────────────────────

pub async fn checkin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CheckinRequest>,
) -> Result<Json<CharacterResponse>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today = game::today();
    let yesterday = today - chrono::Duration::days(1);
    let yesterday_iso = format!("{}T12:00:00Z", yesterday.format("%Y-%m-%d"));

    // Record completions for yesterday for each confirmed habit.
    for id in &body.completed_ids {
        let exists = state.store.completions.get_for_habit(id).iter().any(|c| {
            c.completed_at.get(..10).unwrap_or("") == &yesterday.format("%Y-%m-%d").to_string()
        });
        if !exists {
            let completion = Completion {
                id: Uuid::new_v4().to_string(),
                habit_id: id.clone(),
                completed_at: yesterday_iso.clone(),
            };
            state.store.completions.append(completion).await?;
            // Advance the deadline: yesterday + window_days.
            if let Some(habit) = state.store.habits.get_all().iter().find(|h| &h.id == id).cloned() {
                let new_deadline = yesterday + chrono::Duration::days(habit.window_days as i64);
                state.store.deadlines.set(id, &new_deadline.format("%Y-%m-%d").to_string()).await?;
            }
        }
    }

    // Now run today's tick with the confirmed completions in place.
    run_today_tick(&state, today).await?;

    let character = state.store.character.get();
    let eq = state.store.equipment.get();
    let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
            (d + item.damage, a + item.armor)
        } else { (d, a) }
    });

    Ok(Json(CharacterResponse {
        hp: character.hp,
        gold: character.gold,
        last_tick_date: character.last_tick_date,
        damage,
        armor,
        renown: character.renown,
        name: character.name.clone(),
        pending_checkin: None,
    }))
}

// ── POST /api/character/pay-ferryman ─────────────────────────────────────────

pub async fn pay_ferryman(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Character>, AppError> {
    super::require_auth(&headers, &state).await?;

    let mut character = state.store.character.get();

    if character.hp > 0.0 {
        return Err(AppError::Validation("Not forsaken".to_string()));
    }

    let cost = (character.gold / 2.0).floor();
    character.gold = game::apply_gold_delta(character.gold, -cost);
    character.hp = 25.0;

    let gold_event = GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "ferryman".to_string(),
        amount: -cost,
        reason: "Pay the Ferryman".to_string(),
        habit_id: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    state.store.events.append_gold(gold_event).await?;
    state.store.character.save(character.clone()).await?;

    Ok(Json(character))
}
