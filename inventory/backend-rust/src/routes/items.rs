// inventory/backend-rust/src/routes/items.rs
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post, put, delete},
    Json, Router,
};
use std::collections::HashMap;
use crate::{error::AppError, models::{CreateItemRequest, ItemResponse, UpdateItemRequest}, AppState};
use super::require_auth;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/items", get(list).post(create))
        .route("/api/items/search", get(search))
        .route("/api/items/:id", get(get_by_id).put(update).delete(delete_item))
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ItemResponse>>, AppError> {
    require_auth(&headers, &state).await?;
    let items = state.items.all().await;
    let mut responses = Vec::with_capacity(items.len());
    for item in &items {
        responses.push(state.items.to_response(item).await);
    }
    Ok(Json(responses))
}

async fn search(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<ItemResponse>>, AppError> {
    require_auth(&headers, &state).await?;
    let q = params.get("q").map(|s| s.as_str()).unwrap_or("");
    let containers_only = params
        .get("containers_only")
        .map(|v| v == "true")
        .unwrap_or(false);
    let items = state.items.search(q, containers_only).await;
    let mut responses = Vec::with_capacity(items.len());
    for item in &items {
        responses.push(state.items.to_response(item).await);
    }
    Ok(Json(responses))
}

async fn get_by_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ItemResponse>, AppError> {
    require_auth(&headers, &state).await?;
    let item = state
        .items
        .by_id(&id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("Item not found: {id}")))?;
    Ok(Json(state.items.to_response(&item).await))
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateItemRequest>,
) -> Result<(StatusCode, Json<ItemResponse>), AppError> {
    require_auth(&headers, &state).await?;
    let item = state.items.create(body).await?;
    let response = state.items.to_response(&item).await;
    Ok((StatusCode::CREATED, Json(response)))
}

async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateItemRequest>,
) -> Result<Json<ItemResponse>, AppError> {
    require_auth(&headers, &state).await?;
    let item = state
        .items
        .update(&id, body)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Item not found: {id}")))?;
    Ok(Json(state.items.to_response(&item).await))
}

async fn delete_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    require_auth(&headers, &state).await?;
    state.items.by_id(&id).await
        .ok_or_else(|| AppError::NotFound(format!("Item not found: {id}")))?;
    if state.items.has_children(&id).await {
        return Err(AppError::Conflict("Cannot delete item with children".into()));
    }
    state.items.delete(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}
