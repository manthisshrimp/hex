use axum::{extract::{Query, State}, http::HeaderMap, Json};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;

use crate::error::AppError;
use super::AppState;

#[derive(Deserialize)]
pub struct DaysQuery {
    days: Option<u32>,
}

fn since_n_days(n: u32) -> String {
    let since = Utc::now().date_naive() - chrono::Duration::days(n as i64);
    since.format("%Y-%m-%d").to_string()
}

// ── GET /api/history/hp ───────────────────────────────────────────────────────

pub async fn history_hp(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let since = since_n_days(30);
    let events = state.store.events.health_since(&since);
    Ok(Json(serde_json::to_value(events).unwrap()))
}

// ── GET /api/history/gold ─────────────────────────────────────────────────────

pub async fn history_gold(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let since = since_n_days(30);
    let events = state.store.events.gold_since(&since);
    Ok(Json(serde_json::to_value(events).unwrap()))
}

// ── GET /api/history/completions ──────────────────────────────────────────────

pub async fn history_completions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<DaysQuery>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let days = params.days.unwrap_or(30).min(365);
    let since = since_n_days(days);
    let completions = state.store.completions.get_since(&since);
    Ok(Json(serde_json::to_value(completions).unwrap()))
}
