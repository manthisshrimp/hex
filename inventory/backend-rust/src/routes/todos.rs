// inventory/backend-rust/src/routes/todos.rs
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, put},
    Json, Router,
};
use crate::{error::AppError, models::Todo, AppState};
use super::require_auth;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/todos", get(list))
        .route("/api/todos/open", get(list_open))
        .route("/api/todos/:id", get(get_by_id).delete(delete_todo))
        .route("/api/todos/:id/resolve", put(resolve))
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Todo>>, AppError> {
    require_auth(&headers, &state).await?;
    Ok(Json(state.todos.all().await))
}

async fn list_open(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Todo>>, AppError> {
    require_auth(&headers, &state).await?;
    Ok(Json(state.todos.open().await))
}

async fn get_by_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Todo>, AppError> {
    require_auth(&headers, &state).await?;
    let todo = state
        .todos
        .by_id(&id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("Todo not found: {id}")))?;
    Ok(Json(todo))
}

async fn resolve(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Todo>, AppError> {
    require_auth(&headers, &state).await?;
    let todo = state
        .todos
        .resolve(&id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Todo not found: {id}")))?;
    Ok(Json(todo))
}

async fn delete_todo(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_auth(&headers, &state).await?;
    let removed = state.todos.delete(&id).await?;
    if removed.is_none() {
        return Err(AppError::NotFound(format!("Todo not found: {id}")));
    }
    Ok(StatusCode::NO_CONTENT)
}
