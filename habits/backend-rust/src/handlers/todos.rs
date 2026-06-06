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
use crate::models::{GoldEvent, Todo, TodoWithGold};
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
