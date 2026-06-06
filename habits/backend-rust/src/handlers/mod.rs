pub mod character;
pub mod debug;
pub mod habits;
pub mod history;
pub mod shop;
pub mod equipment;
pub mod random_event;
pub mod todos;
pub mod deeds;
pub mod service;
pub mod party;

use std::sync::Arc;
use axum::http::HeaderMap;
use crate::auth::AuthManager;
use crate::storage::AppStore;
use crate::game::GameConfig;
use crate::error::AppError;
use crate::models::Item;
use crate::sync::TaskBoardSync;

#[derive(Clone)]
pub struct AppState {
    pub store: AppStore,
    pub auth: AuthManager,
    pub config: GameConfig,
    pub catalogue: Arc<Vec<Item>>,
    /// Shared Octiron API key (None if key file absent).
    pub api_key: Option<String>,
    /// Client for syncing todos to the task-board app (None if not configured).
    pub sync: Option<TaskBoardSync>,
}

pub(super) async fn require_auth(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    let token = headers
        .get("x-admin-token")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing X-Admin-Token header".to_string()))?;
    if !state.auth.verify_token(token).await {
        return Err(AppError::Unauthorized("Invalid admin token".to_string()));
    }
    Ok(())
}

pub(super) fn require_api_key(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    let provided = headers
        .get("x-api-key")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing X-Api-Key header".to_string()))?;
    match &state.api_key {
        Some(key) if key == provided => Ok(()),
        _ => Err(AppError::Unauthorized("Invalid API key".to_string())),
    }
}
