// calendar-site/backend-rust/src/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: String,
    pub date: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub category_id: String,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub start_time: String,
    #[serde(default)]
    pub end_time: String,
    #[serde(default)]
    pub all_day: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub is_non_working: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayInfo {
    pub date: String,
    pub day_of_month: u32,
    pub month: u32,
    pub month_name: String,
    pub day_name: String,
    pub is_weekend: bool,
    pub is_month_boundary: bool,
    pub is_today: bool,
    pub event_count: usize,
    pub has_events: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEventRequest {
    pub date: String,
    pub title: String,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub color: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub all_day: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEventRequest {
    pub date: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub category_id: Option<String>,
    pub color: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub all_day: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryRequest {
    pub name: String,
    pub color: Option<String>,
    pub is_non_working: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub is_non_working: Option<bool>,
}
