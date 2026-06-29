use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::NaiveDate;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::AppError;
use crate::game;
use crate::models::{CompletedTodo, GoldEvent, HealthEvent, Todo, TodoWithGold};
use super::AppState;

fn todo_gold(created_date: &str, today: NaiveDate) -> f64 {
    let created = NaiveDate::parse_from_str(created_date, "%Y-%m-%d").unwrap_or(today);
    let days = (today - created).num_days().max(0) as f64;
    (50.0 - days * 5.0).max(10.0)
}

pub async fn list_todos(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<TodoWithGold>>, AppError> {
    super::require_auth(&headers, &state).await?;
    let today = game::today();
    let todos = state.store.todos.get_all().into_iter().map(|t| {
        let gold = todo_gold(&t.created_date, today);
        TodoWithGold { todo: t, gold }
    }).collect();
    Ok(Json(todos))
}

pub async fn create_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::require_auth(&headers, &state).await?;
    let title = body["title"].as_str().unwrap_or("").trim().to_string();
    if title.is_empty() {
        return Err(AppError::Validation("Title is required".to_string()));
    }
    let today_str = game::today_str();
    let mut todo = Todo {
        id: Uuid::new_v4().to_string(),
        title: title.clone(),
        created_date: today_str,
        task_board_id: None,
    };

    // Sync to task-board before saving so we can store the returned ID
    if let Some(sync) = &state.sync {
        if let Some(tb_id) = sync.create_task(&title, &todo.id).await {
            todo.task_board_id = Some(tb_id);
        }
    }

    let created = state.store.todos.create(todo).await?;
    Ok((StatusCode::CREATED, Json(json!(created))))
}

pub async fn complete_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let today = game::today();
    let todo = state.store.todos.get_by_id(&id)
        .ok_or_else(|| AppError::NotFound("Todo not found".to_string()))?;

    let gold_earned = todo_gold(&todo.created_date, today);

    // Log the completion for the weekly turn-in (both forsaken and normal paths).
    state.store.completed_todos.append(CompletedTodo {
        id: todo.id.clone(),
        title: todo.title.clone(),
        completed_at: chrono::Utc::now().to_rfc3339(),
    }).await?;

    let mut character = state.store.character.get();
    if character.hp <= 0.0 {
        state.store.todos.remove(&id).await?;
        // Sync deletion to task-board (forsaken — task still "done")
        if let (Some(sync), Some(tb_id)) = (&state.sync, &todo.task_board_id) {
            sync.complete_task(tb_id).await;
        }
        return Ok(Json(json!({ "gold_earned": 0.0, "new_gold": character.gold })));
    }

    character.gold = game::apply_gold_delta(character.gold, gold_earned);
    let new_gold = character.gold;

    let gold_event = GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "todo_completion".to_string(),
        amount: gold_earned,
        reason: format!("todo: {}", todo.title),
        habit_id: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    state.store.events.append_gold(gold_event).await?;
    state.store.character.save(character).await?;
    state.store.todos.remove(&id).await?;

    // Sync completion to task-board
    if let (Some(sync), Some(tb_id)) = (&state.sync, &todo.task_board_id) {
        sync.complete_task(tb_id).await;
    }

    Ok(Json(json!({ "gold_earned": gold_earned, "new_gold": new_gold })))
}

pub async fn delete_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    super::require_auth(&headers, &state).await?;
    let todo = state.store.todos.get_by_id(&id)
        .ok_or_else(|| AppError::NotFound("Todo not found".to_string()))?;

    state.store.todos.remove(&id).await?;

    // Sync deletion to task-board
    if let (Some(sync), Some(tb_id)) = (&state.sync, &todo.task_board_id) {
        sync.delete_task(tb_id).await;
    }

    Ok(StatusCode::NO_CONTENT)
}

// ── Weekly task bounty ────────────────────────────────────────────────────────

/// The claimable batch = tasks completed in the week that closed on the most
/// recent Monday, i.e. [monday-7, monday). Tasks done this week belong to the
/// next Monday's batch. Returns (monday, batch).
fn weekly_batch(state: &AppState, today: NaiveDate) -> (NaiveDate, Vec<CompletedTodo>) {
    let monday = game::most_recent_monday(today);
    let start = monday - chrono::Duration::days(7);
    let batch = state.store.completed_todos.get_all().into_iter()
        .filter(|c| game::parse_iso_date(&c.completed_at)
            .map(|d| d >= start && d < monday)
            .unwrap_or(false))
        .collect();
    (monday, batch)
}

pub async fn get_reward(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let today = game::today();
    let (monday, batch) = weekly_batch(&state, today);
    let count = batch.len();
    let monday_str = monday.format("%Y-%m-%d").to_string();
    let claimed = state.store.character.get().last_reward_claim.as_deref() == Some(monday_str.as_str());

    // Live progress counter: tasks completed since this Monday (resets weekly).
    let week_count = state.store.completed_todos.get_all().into_iter()
        .filter(|c| game::parse_iso_date(&c.completed_at)
            .map(|d| d >= monday)
            .unwrap_or(false))
        .count();

    Ok(Json(json!({
        "count": count,
        "weekCount": week_count,
        "available": count >= 1 && !claimed,
        "claimed": claimed,
        "gold": 100.0 + 5.0 * count as f64,
        "heal": 10.0 + count as f64,
        "weekStart": (monday - chrono::Duration::days(7)).format("%Y-%m-%d").to_string(),
        "weekEnd": monday_str,
        "tasks": batch.iter()
            .map(|c| json!({ "title": c.title, "completedAt": c.completed_at }))
            .collect::<Vec<_>>(),
    })))
}

pub async fn claim_reward(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let reward_type = body["type"].as_str().unwrap_or("");

    let (monday, batch) = weekly_batch(&state, game::today());
    let count = batch.len();
    let monday_str = monday.format("%Y-%m-%d").to_string();

    let mut character = state.store.character.get();
    if character.hp <= 0.0 {
        return Err(AppError::Validation("Pay the Ferryman before claiming.".to_string()));
    }
    if count == 0 {
        return Err(AppError::Validation("No completed tasks to turn in.".to_string()));
    }
    if character.last_reward_claim.as_deref() == Some(monday_str.as_str()) {
        return Err(AppError::Validation("This week's bounty is already claimed.".to_string()));
    }

    let (gold_delta, heal) = match reward_type {
        "gold" => (100.0 + 5.0 * count as f64, 0.0),
        "heal" => (0.0, 10.0 + count as f64),
        _ => return Err(AppError::Validation("type must be 'gold' or 'heal'".to_string())),
    };

    if gold_delta > 0.0 {
        character.gold = game::apply_gold_delta(character.gold, gold_delta);
        state.store.events.append_gold(GoldEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "weekly_reward".to_string(),
            amount: gold_delta,
            reason: format!("weekly bounty: {} tasks", count),
            habit_id: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }).await?;
    }
    if heal > 0.0 {
        character.hp = (character.hp + heal).min(state.config.max_hp);
        state.store.events.append_health(HealthEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "regen".to_string(),
            amount: heal,
            reason: format!("weekly bounty: {} tasks", count),
            habit_id: None,
            tick_date: game::today_str(),
        }).await?;
    }

    character.last_reward_claim = Some(monday_str);
    let new_gold = character.gold;
    let new_hp = character.hp;
    state.store.character.save(character).await?;

    Ok(Json(json!({
        "type": reward_type,
        "goldEarned": gold_delta,
        "hpHealed": heal,
        "newGold": new_gold,
        "newHp": new_hp,
    })))
}
