// calendar-site/backend-rust/src/routes/holidays.rs
use axum::{extract::{Query, State}, http::HeaderMap, Json};
use serde::Deserialize;
use serde_json::json;
use chrono::Datelike;
use crate::{error::AppError, models::{CreateEventRequest, CreateCategoryRequest}};
use super::super::AppState;
use super::events::require_auth;

#[derive(Deserialize)]
pub struct ImportQuery { pub year: Option<i32> }

#[derive(Deserialize)]
struct NagerHoliday {
    date: String,
    #[serde(rename = "localName")]
    local_name: String,
    name: String,
}

pub async fn import(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<ImportQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;

    let current_year = chrono::Local::now().year();
    let years: Vec<i32> = match q.year {
        Some(y) => vec![y],
        None    => (current_year..=current_year + 5).collect(),
    };

    // Ensure "Public Holiday" category exists
    let cats = state.categories.all().await;
    let holiday_cat = if let Some(c) = cats.iter().find(|c| c.name == "Public Holiday") {
        c.clone()
    } else {
        state.categories.create(CreateCategoryRequest {
            name: "Public Holiday".to_string(),
            color: Some("#fdca40".to_string()),
            is_non_working: Some(true),
        }).await?
    };

    let client = reqwest::Client::new();
    let mut imported = 0usize;
    let mut skipped  = 0usize;

    for year in &years {
        let url = format!("https://date.nager.at/api/v3/PublicHolidays/{year}/ZA");
        let resp = client.get(&url)
            .header("User-Agent", "calendar-site/1.0")
            .send().await
            .map_err(|e| AppError::BadGateway(format!("Fetch failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(AppError::BadGateway(
                format!("Unexpected status {} for year {year}", resp.status())));
        }

        let holidays: Vec<NagerHoliday> = resp.json().await
            .map_err(|e| AppError::BadGateway(format!("Parse failed: {e}")))?;

        let existing = state.events.all().await;

        for h in holidays {
            let dup = existing.iter().any(|e| e.date == h.date && e.title == h.local_name);
            if dup { skipped += 1; continue; }

            let description = if h.name != h.local_name { h.name } else { String::new() };
            state.events.create(CreateEventRequest {
                date: h.date,
                title: h.local_name,
                description: Some(description),
                category_id: Some(holiday_cat.id.clone()),
                color: None, start_time: None, end_time: None,
                all_day: Some(true),
            }).await?;
            imported += 1;
        }
    }

    Ok(Json(json!({ "imported": imported, "skipped": skipped, "years": years })))
}
