// calendar-site/backend-rust/src/routes/days.rs
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use chrono::{NaiveDate, Datelike, Duration};
use crate::error::AppError;
use crate::models::DayInfo;
use super::super::AppState;
use super::events::require_auth;

const MONTHS: [&str; 12] = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
];
const DAYS: [&str; 7] = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

#[derive(Deserialize)]
pub struct DaysQuery { pub start: String, pub count: u32 }

pub async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<DaysQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;

    if q.count == 0 {
        return Err(AppError::Validation("count must be positive".into()));
    }

    let start = NaiveDate::parse_from_str(&q.start, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Invalid date format, use YYYY-MM-DD".into()))?;

    let today = chrono::Local::now().date_naive();
    let mut days = Vec::with_capacity(q.count as usize);

    for i in 0..q.count {
        let d = start + Duration::days(i as i64);
        let date_str = d.format("%Y-%m-%d").to_string();
        let dow = d.weekday().num_days_from_sunday() as usize; // 0=Sun
        let is_weekend = dow == 0 || dow == 6;

        // month boundary: last day of month (next day is a different month)
        let next = d + Duration::days(1);
        let is_month_boundary = next.month() != d.month();

        let event_count = state.events.count_for_date(&date_str).await;

        days.push(DayInfo {
            date: date_str,
            day_of_month: d.day(),
            month: d.month(),
            month_name: MONTHS[(d.month0()) as usize].to_string(),
            day_name: DAYS[dow].to_string(),
            is_weekend,
            is_month_boundary,
            is_today: d == today,
            event_count,
            has_events: event_count > 0,
        });
    }

    Ok(Json(json!({ "days": days })))
}
