// calendar-site/backend-rust/src/routes/events.rs
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use crate::{error::AppError, models::{CreateEventRequest, UpdateEventRequest, ReorderRequest}};
use super::super::AppState;

pub async fn require_auth(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    let token = headers.get("x-admin-token")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    match token {
        None => Err(AppError::Unauthorized("Missing X-Admin-Token header".into())),
        Some(t) if !state.auth.verify(&t).await =>
            Err(AppError::Forbidden("Invalid admin token".into())),
        _ => Ok(()),
    }
}

#[derive(Deserialize)]
pub struct RangeQuery { pub start: String, pub end: String }

pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<RangeQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let events = state.events.in_range(&q.start, &q.end).await;
    Ok(Json(json!({ "events": events })))
}

pub async fn get_by_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let ev = state.events.by_id(&id).await
        .ok_or_else(|| AppError::NotFound("Event not found".into()))?;
    Ok(Json(json!(ev)))
}

pub async fn get_for_date(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(date): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let events = state.events.for_date(&date).await;
    Ok(Json(json!({ "date": date, "events": events })))
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateEventRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    require_auth(&headers, &state).await?;
    if body.date.is_empty() || body.title.is_empty() {
        return Err(AppError::Validation("date and title are required".into()));
    }
    let event = state.events.create(body).await?;
    Ok((StatusCode::CREATED, Json(json!(event))))
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateEventRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let ev = state.events.update(&id, body).await?
        .ok_or_else(|| AppError::NotFound("Event not found".into()))?;
    Ok(Json(json!(ev)))
}

pub async fn reorder(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ReorderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    state.events.reorder(body).await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let found = state.events.delete(&id).await?;
    if !found { return Err(AppError::NotFound("Event not found".into())); }
    Ok(Json(json!({ "success": true })))
}
