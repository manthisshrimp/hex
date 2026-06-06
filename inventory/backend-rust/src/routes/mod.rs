pub mod items;
pub mod checks;
pub mod todo_sets;
pub mod tags;

use axum::http::HeaderMap;
use crate::{error::AppError, AppState};

pub async fn require_auth(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    let token = headers
        .get("x-admin-token")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    match token {
        None => Err(AppError::Unauthorized("Missing X-Admin-Token header".into())),
        Some(t) if !state.auth.verify(&t).await => {
            Err(AppError::Forbidden("Invalid admin token".into()))
        }
        _ => Ok(()),
    }
}
