use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{NaiveDate, Utc};
use rand::Rng;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::AppError;
use crate::game;
use crate::models::{
    Completion, CreateHabitRequest, GoldEvent, Habit, HabitWithState, UpdateHabitRequest,
};
use super::AppState;

fn compute_streak(habit: &Habit, completions: &[Completion], next_deadline_str: &str, today: NaiveDate) -> u32 {
    if habit.frequency == "daily" {
        let mut streak = 0u32;
        let mut check_date = today;
        loop {
            let check_str = check_date.format("%Y-%m-%d").to_string();
            let done = completions.iter().any(|c| {
                c.completed_at.get(..10).unwrap_or("") == check_str
            });
            if done {
                streak += 1;
                check_date = match check_date.pred_opt() { Some(d) => d, None => break };
            } else {
                break;
            }
        }
        streak
    } else {
        let next_deadline = NaiveDate::parse_from_str(next_deadline_str, "%Y-%m-%d").unwrap_or(today);
        let window = chrono::Duration::days(habit.window_days as i64);
        let mut window_end = next_deadline;
        let mut streak = 0u32;
        for _ in 0..1000 {
            let window_start = window_end - window;
            let done = completions.iter().any(|c| {
                NaiveDate::parse_from_str(c.completed_at.get(..10).unwrap_or(""), "%Y-%m-%d")
                    .map(|d| d > window_start && d <= window_end)
                    .unwrap_or(false)
            });
            if done {
                streak += 1;
                window_end = window_start;
            } else {
                break;
            }
        }
        streak
    }
}

// ── GET /api/habits ───────────────────────────────────────────────────────────

pub async fn list_habits(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<HabitWithState>>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today = game::today();
    let today_str = game::today_str();

    let character = state.store.character.get();
    let forsaken = character.hp <= 0.0;

    let habits = state.store.habits.get_all();
    let mut result = Vec::with_capacity(habits.len());

    for habit in &habits {
        let habit_completions: Vec<Completion> = state
            .store
            .completions
            .get_for_habit(&habit.id);

        let consistency = game::compute_consistency(&state.config, habit, &habit_completions, today);

        let created_at = game::parse_iso_date(&habit.created_at).unwrap_or(today);

        // Determine next_deadline from store, or compute initial if absent.
        let next_deadline = match state.store.deadlines.get(&habit.id) {
            Some(d) => d,
            None => {
                // Compute initial deadline based on frequency.
                if habit.frequency == "windowed" {
                    let d = created_at + chrono::Duration::days(habit.window_days as i64);
                    d.format("%Y-%m-%d").to_string()
                } else {
                    created_at.format("%Y-%m-%d").to_string()
                }
            }
        };

        // Reschedule cost: None for daily, Some(cost) for windowed.
        let reschedule_cost = if habit.frequency == "windowed" {
            Some(game::reschedule_cost(&state.config, &habit.importance, 0))
        } else {
            None
        };

        // can_complete: false if already completed in the current cycle or today.
        let can_complete = if habit.frequency == "daily" {
            !habit_completions.iter().any(|c| {
                c.completed_at.get(..10).unwrap_or("") == today_str
            })
        } else {
            let nd = NaiveDate::parse_from_str(&next_deadline, "%Y-%m-%d").unwrap_or(today);
            let cs = nd - chrono::Duration::days(habit.window_days as i64);
            !habit_completions.iter().any(|c| {
                let date_str = c.completed_at.get(..10).unwrap_or("");
                if date_str == today_str { return true; }
                NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                    .map(|d| d > cs && d <= nd)
                    .unwrap_or(false)
            })
        };

        let yesterday_str = (today - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        let can_backfill = habit.active && !habit_completions.iter().any(|c| {
            c.completed_at.get(..10).unwrap_or("") == yesterday_str
        });

        let completion_gold = if forsaken { 0.0 } else {
            game::completion_gold(&state.config, &habit.importance, &habit_completions, today)
        };
        let passive_gold = game::passive_gold(&state.config, &habit.importance, consistency);
        let streak = compute_streak(habit, &habit_completions, &next_deadline, today);

        result.push(HabitWithState {
            habit: habit.clone(),
            consistency,
            next_deadline,
            reschedule_cost,
            can_complete,
            can_backfill,
            completion_gold,
            passive_gold,
            streak,
        });
    }

    Ok(Json(result))
}

// ── POST /api/habits ──────────────────────────────────────────────────────────

pub async fn create_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateHabitRequest>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::require_auth(&headers, &state).await?;

    // Validate.
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Validation("Habit name is required".to_string()));
    }
    let freq = body.frequency.as_str();
    if freq != "daily" && freq != "windowed" {
        return Err(AppError::Validation(
            "frequency must be 'daily' or 'windowed'".to_string(),
        ));
    }
    let window_days = if freq == "daily" {
        1
    } else {
        let wd = body.window_days.unwrap_or(1);
        if wd < 1 {
            return Err(AppError::Validation("window_days must be >= 1".to_string()));
        }
        wd
    };

    // Build create request with possibly-adjusted window_days.
    let create_req = CreateHabitRequest {
        name,
        importance: body.importance,
        frequency: freq.to_string(),
        window_days: Some(window_days),
        notes: body.notes,
        show_on_days: body.show_on_days,
    };

    let habit = state.store.habits.create(create_req).await?;

    // Set initial deadline.
    let today = game::today();
    let today_str = game::today_str();

    let initial_deadline = if freq == "windowed" {
        (today + chrono::Duration::days(window_days as i64))
            .format("%Y-%m-%d")
            .to_string()
    } else {
        today_str
    };
    state.store.deadlines.set(&habit.id, &initial_deadline).await?;

    Ok((StatusCode::CREATED, Json(json!(habit))))
}

// ── PUT /api/habits/:id ───────────────────────────────────────────────────────

pub async fn update_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateHabitRequest>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let updated = state.store.habits.update(&id, body).await?;
    Ok(Json(json!(updated)))
}

// ── DELETE /api/habits/:id ────────────────────────────────────────────────────

pub async fn delete_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    super::require_auth(&headers, &state).await?;

    state.store.completions.remove_for_habit(&id).await?;
    state.store.habits.delete(&id).await?;
    state.store.deadlines.remove(&id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/habits/:id/complete ─────────────────────────────────────────────

pub async fn complete_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let habit = state
        .store
        .habits
        .get_by_id(&id)
        .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;

    if !habit.active {
        return Err(AppError::Validation("Habit is not active".to_string()));
    }

    let today = game::today();
    let today_str = game::today_str();

    // Determine cycle window [cycle_start, next_deadline).
    let next_deadline_str = state
        .store
        .deadlines
        .get(&id)
        .unwrap_or_else(|| today_str.clone());
    let next_deadline = NaiveDate::parse_from_str(&next_deadline_str, "%Y-%m-%d")
        .unwrap_or(today);

    let cycle_start = next_deadline - chrono::Duration::days(habit.window_days as i64);

    // Check if a valid completion already exists in this cycle.
    let habit_completions = state.store.completions.get_for_habit(&id);
    let already_completed = habit_completions.iter().any(|c| {
        let date_str = c.completed_at.get(..10).unwrap_or("");
        if date_str == today_str { return true; }
        NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map(|d| d > cycle_start && d <= next_deadline)
            .unwrap_or(false)
    });

    if already_completed {
        return Ok(Json(json!({ "already_completed": true })));
    }

    // Record completion.
    let completion = Completion {
        id: Uuid::new_v4().to_string(),
        habit_id: id.clone(),
        completed_at: Utc::now().to_rfc3339(),
    };
    state.store.completions.append(completion).await?;

    // Fetch completions after appending (includes today's) for gold calculation.
    let character = state.store.character.get();
    let gold_earned = if character.hp <= 0.0 {
        0.0
    } else {
        let all_completions = state.store.completions.get_for_habit(&id);
        let base_gold = game::completion_gold(&state.config, &habit.importance, &all_completions, today + chrono::Duration::days(1));
        let roll: f64 = rand::thread_rng().gen();
        game::gold_roll_bonus(base_gold, roll)
    };

    // Advance deadline: completion_date + window_days.
    let new_deadline = today + chrono::Duration::days(habit.window_days as i64);
    state
        .store
        .deadlines
        .set(&id, &new_deadline.format("%Y-%m-%d").to_string())
        .await?;

    // Only award gold if not forsaken.
    let new_gold = if gold_earned > 0.0 {
        let gold_event = GoldEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "completion_bonus".to_string(),
            amount: gold_earned,
            reason: format!("completed: {}", habit.name),
            habit_id: Some(id.clone()),
            timestamp: Utc::now().to_rfc3339(),
        };
        state.store.events.append_gold(gold_event).await?;

        let mut ch = state.store.character.get();
        ch.gold = game::apply_gold_delta(ch.gold, gold_earned);
        let g = ch.gold;
        state.store.character.save(ch).await?;
        g
    } else {
        character.gold
    };

    Ok(Json(json!({
        "gold_earned": gold_earned,
        "new_gold": new_gold,
    })))
}

// ── POST /api/habits/:id/move ─────────────────────────────────────────────────

pub async fn move_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<StatusCode, AppError> {
    super::require_auth(&headers, &state).await?;

    let direction = body["direction"].as_str().unwrap_or("down");
    if direction != "up" && direction != "down" {
        return Err(AppError::Validation("direction must be 'up' or 'down'".to_string()));
    }

    state.store.habits.move_habit_direction(&id, direction).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/habits/:id/reschedule ───────────────────────────────────────────

pub async fn reschedule_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let habit = state
        .store
        .habits
        .get_by_id(&id)
        .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;

    if habit.frequency == "daily" {
        return Err(AppError::Validation(
            "Cannot reschedule a daily habit".to_string(),
        ));
    }

    let current_deadline_str = state
        .store
        .deadlines
        .get(&id)
        .ok_or_else(|| AppError::NotFound("No deadline found for habit".to_string()))?;
    let current_deadline = NaiveDate::parse_from_str(&current_deadline_str, "%Y-%m-%d")
        .map_err(|e| AppError::Storage(format!("Date parse error: {e}")))?;

    // Count reschedules this cycle: gold events with type "reschedule_cost" for this
    // habit since cycle_start.
    let cycle_start = current_deadline - chrono::Duration::days(habit.window_days as i64);
    let cycle_start_str = cycle_start.format("%Y-%m-%d").to_string();
    let gold_events = state.store.events.gold_since(&cycle_start_str);
    let reschedules_this_cycle = gold_events
        .iter()
        .filter(|e| {
            e.event_type == "reschedule_cost"
                && e.habit_id.as_deref() == Some(&id)
        })
        .count() as u32;

    let cost = game::reschedule_cost(&state.config, &habit.importance, reschedules_this_cycle);

    // Check character has enough gold.
    let mut character = state.store.character.get();
    if character.gold < cost as f64 {
        return Err(AppError::Validation(format!(
            "Insufficient gold: need {cost}, have {}",
            character.gold as u64
        )));
    }

    // Extend deadline.
    let extension = game::reschedule_extension_days(&state.config, habit.window_days);
    let new_deadline = current_deadline + chrono::Duration::days(extension as i64);
    state
        .store
        .deadlines
        .set(&id, &new_deadline.format("%Y-%m-%d").to_string())
        .await?;

    // Deduct gold and append gold event.
    character.gold = game::apply_gold_delta(character.gold, -(cost as f64));
    let new_gold = character.gold;

    let gold_event = GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "reschedule_cost".to_string(),
        amount: -(cost as f64),
        reason: format!("reschedule: {}", habit.name),
        habit_id: Some(id.clone()),
        timestamp: Utc::now().to_rfc3339(),
    };
    state.store.events.append_gold(gold_event).await?;
    state.store.character.save(character).await?;

    Ok(Json(json!({
        "new_deadline": new_deadline.format("%Y-%m-%d").to_string(),
        "gold_spent": cost,
        "new_gold": new_gold,
    })))
}
