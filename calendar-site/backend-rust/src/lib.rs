// calendar-site/backend-rust/src/lib.rs
pub mod auth;
pub mod error;
pub mod models;
pub mod routes;
pub mod storage;

pub use auth::AuthManager;
pub use storage::{EventStore, CategoryStore};

/// Shared application state — referenced by route handlers via `crate::AppState`
#[derive(Clone)]
pub struct AppState {
    pub auth:       auth::AuthManager,
    pub events:     storage::EventStore,
    pub categories: storage::CategoryStore,
}
