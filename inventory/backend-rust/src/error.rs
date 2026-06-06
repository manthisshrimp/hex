// inventory/backend-rust/src/error.rs
use axum::{response::{IntoResponse, Response}, http::StatusCode, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    /// 401 — token missing
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    /// 403 — token present but wrong
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Storage error: {0}")]
    Storage(String),
    #[error("Bad gateway: {0}")]
    BadGateway(String),
    #[error("Conflict: {0}")]
    Conflict(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            AppError::NotFound(m)     => (StatusCode::NOT_FOUND, m.clone()),
            AppError::Validation(m)   => (StatusCode::BAD_REQUEST, m.clone()),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.clone()),
            AppError::Forbidden(m)    => (StatusCode::FORBIDDEN, m.clone()),
            AppError::Storage(m)      => (StatusCode::INTERNAL_SERVER_ERROR, m.clone()),
            AppError::BadGateway(m)   => (StatusCode::BAD_GATEWAY, m.clone()),
            AppError::Conflict(m)     => (StatusCode::CONFLICT, m.clone()),
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}
