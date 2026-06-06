pub mod categories;
pub mod years;

use axum::http::HeaderMap;
use crate::auth::AuthManager;
use crate::storage::AppStore;
use crate::error::AppError;

#[derive(Clone)]
pub struct AppState {
    pub store: AppStore,
    pub auth: AuthManager,
}

pub(super) async fn require_auth(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    let token = headers.get("x-admin-token")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing X-Admin-Token header".to_string()))?;
    if !state.auth.verify_token(token).await {
        return Err(AppError::Unauthorized("Invalid admin token".to_string()));
    }
    Ok(())
}
