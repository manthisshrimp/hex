pub mod auth;
pub mod error;
pub mod models;
pub mod routes;
pub mod storage;
pub use auth::AuthManager;
pub use storage::{items::ItemStore, checks::CheckStore, todo_sets::TodoSetStore};

#[derive(Clone)]
pub struct AppState {
    pub auth: AuthManager,
    pub items: ItemStore,
    pub checks: CheckStore,
    pub todo_sets: TodoSetStore,
}
