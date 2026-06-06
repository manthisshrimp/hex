// calendar-site/backend-rust/src/routes/categories.rs
use axum::{extract::{Path, State}, http::{HeaderMap, StatusCode}, Json};
use serde_json::json;
use crate::{error::AppError, models::{CreateCategoryRequest, UpdateCategoryRequest}};
use super::super::AppState;
use super::events::require_auth;

pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    Ok(Json(json!({ "categories": state.categories.all().await })))
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateCategoryRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    require_auth(&headers, &state).await?;
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Name is required".into()));
    }
    let cat = state.categories.create(body).await?;
    Ok((StatusCode::CREATED, Json(json!(cat))))
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateCategoryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let cat = state.categories.update(&id, body).await?;
    Ok(Json(json!(cat)))
}

pub async fn delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let deleted_id = state.categories.delete(&id).await?;
    Ok(Json(json!({ "deleted": deleted_id })))
}
