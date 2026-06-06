use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::AppError;
use crate::game;
use crate::models::{GoldEvent, Todo};
use super::AppState;

// POST /api/service/todos — create a todo (called by task-board)
pub async fn service_create_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::require_api_key(&headers, &state)?;

    let title = body["title"].as_str().unwrap_or("").trim().to_string();
    if title.is_empty() {
        return Err(AppError::Validation("Title is required".to_string()));
    }
    let task_board_id = body["taskBoardId"].as_str().map(|s| s.to_string());

    let todo = Todo {
        id: Uuid::new_v4().to_string(),
        title,
        created_date: game::today_str(),
        task_board_id,
    };
    let created = state.store.todos.create(todo).await?;
    Ok((StatusCode::CREATED, Json(json!(created))))
}

// POST /api/service/todos/:id/complete — complete a todo (called by task-board)
pub async fn service_complete_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_api_key(&headers, &state)?;

    let today = game::today();
    let todo = state.store.todos.get_by_id(&id)
        .ok_or_else(|| AppError::NotFound("Todo not found".to_string()))?;

    let gold_earned = {
        use chrono::NaiveDate;
        let created = NaiveDate::parse_from_str(&todo.created_date, "%Y-%m-%d").unwrap_or(today);
        let days = (today - created).num_days().max(0) as f64;
        (50.0 - days * 5.0).max(10.0)
    };

    let mut character = state.store.character.get();
    if character.hp > 0.0 {
        character.gold = crate::game::apply_gold_delta(character.gold, gold_earned);
        let gold_event = GoldEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "todo_completion".to_string(),
            amount: gold_earned,
            reason: format!("todo: {}", todo.title),
            habit_id: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        state.store.events.append_gold(gold_event).await?;
        state.store.character.save(character.clone()).await?;
    }

    state.store.todos.remove(&id).await?;
    Ok(Json(json!({ "gold_earned": if character.hp > 0.0 { gold_earned } else { 0.0 }, "new_gold": character.gold })))
}

// DELETE /api/service/todos/:id — delete a todo without gold (called by task-board)
pub async fn service_delete_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    super::require_api_key(&headers, &state)?;
    state.store.todos.remove(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}
