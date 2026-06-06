use axum::{extract::State, http::HeaderMap, Json};
use chrono::Utc;
use serde_json::Value;

use crate::error::AppError;
use super::AppState;

fn since_30_days() -> String {
    let since = Utc::now().date_naive() - chrono::Duration::days(30);
    since.format("%Y-%m-%d").to_string()
}

// ── GET /api/history/hp ───────────────────────────────────────────────────────

pub async fn history_hp(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let since = since_30_days();
    let events = state.store.events.health_since(&since);
    Ok(Json(serde_json::to_value(events).unwrap()))
}

// ── GET /api/history/gold ─────────────────────────────────────────────────────

pub async fn history_gold(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let since = since_30_days();
    let events = state.store.events.gold_since(&since);
    Ok(Json(serde_json::to_value(events).unwrap()))
}

// ── GET /api/history/completions ──────────────────────────────────────────────

pub async fn history_completions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let since = since_30_days();
    let completions = state.store.completions.get_since(&since);
    Ok(Json(serde_json::to_value(completions).unwrap()))
}
