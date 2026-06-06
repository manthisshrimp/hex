// inventory/backend-rust/src/routes/todo_sets.rs
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, put},
    Json, Router,
};
use crate::{error::AppError, models::TodoSet, AppState};
use super::require_auth;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/todo-sets", get(list))
        .route("/api/todo-sets/:id", get(get_by_id).delete(delete_set))
        .route("/api/todo-sets/:set_id/items/:item_id/done", put(mark_done))
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<TodoSet>>, AppError> {
    require_auth(&headers, &state).await?;
    Ok(Json(state.todo_sets.all().await))
}

// Public — no auth required
async fn get_by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<TodoSet>, AppError> {
    let set = state
        .todo_sets
        .by_id(&id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("Todo set not found: {id}")))?;
    Ok(Json(set))
}

// Public — no auth required
async fn mark_done(
    State(state): State<AppState>,
    Path((set_id, item_id)): Path<(String, String)>,
) -> Result<Json<TodoSet>, AppError> {
    let set = state
        .todo_sets
        .mark_item_done(&set_id, &item_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Todo set or item not found")))?;
    Ok(Json(set))
}

async fn delete_set(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_auth(&headers, &state).await?;
    let removed = state.todo_sets.delete(&id).await?;
    if removed.is_none() {
        return Err(AppError::NotFound(format!("Todo set not found: {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}
