use axum::{extract::State, http::HeaderMap, Json};
use chrono::NaiveDate;
use serde_json::{json, Value};

use crate::error::AppError;
use crate::game;
use super::AppState;

/// POST /api/debug/advance-days  { "days": N }
///
/// Rolls back last_tick_date and all deadlines by N days so that the next
/// GET /api/character processes N days of ticks (damage, regen, passive gold).
pub async fn advance_days(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let days = body["days"].as_i64().unwrap_or(1).max(1);

    let today = game::today();

    // Roll back last_tick_date.
    let mut character = state.store.character.get();
    let current_tick = NaiveDate::parse_from_str(&character.last_tick_date, "%Y-%m-%d")
        .unwrap_or(today);
    let new_tick = current_tick - chrono::Duration::days(days);
    character.last_tick_date = new_tick.format("%Y-%m-%d").to_string();
    state.store.character.save(character).await?;

    // Shift completions and habit created_at dates back by N days so all
    // temporal relationships stay intact for consistency calculation,
    // while canComplete resets to true (no completion from "today").
    state.store.completions.shift_dates_back(days).await?;
    state.store.habits.shift_created_at_back(days).await?;

    // Roll back all deadlines by the same amount.
    let all_deadlines = state.store.deadlines.get_all();
    let shifted = all_deadlines
        .into_iter()
        .filter_map(|(id, d_str)| {
            NaiveDate::parse_from_str(&d_str, "%Y-%m-%d")
                .ok()
                .map(|d| (id, (d - chrono::Duration::days(days)).format("%Y-%m-%d").to_string()))
        })
        .collect();
    state.store.deadlines.save_all(shifted).await?;

    Ok(Json(json!({
        "advanced_days": days,
        "new_last_tick_date": new_tick.format("%Y-%m-%d").to_string(),
        "note": "Open the app (GET /api/character) to trigger the tick",
    })))
}
