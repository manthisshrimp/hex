// inventory/backend-rust/src/routes/tags.rs
use axum::{
    extract::State,
    http::HeaderMap,
    routing::get,
    Json, Router,
};
use crate::{error::AppError, AppState};
use super::require_auth;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/tags", get(list_tags))
}

async fn list_tags(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<String>>, AppError> {
    require_auth(&headers, &state).await?;
    let items = state.items.all().await;
    let mut tags: Vec<String> = items
        .into_iter()
        .flat_map(|i| i.tags)
        .collect();
    tags.sort();
    tags.dedup();
    Ok(Json(tags))
}
