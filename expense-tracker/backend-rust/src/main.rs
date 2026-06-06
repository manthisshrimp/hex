use axum::{routing::{get, post, put}, Router};
use tower_http::cors::CorsLayer;
use std::env;
use tracing::info;
use serde_json::json;
use axum::response::Json;

use expense_tracker_backend::{AppState, AppStore, AuthManager};
use expense_tracker_backend::handlers::{
    categories::{list_categories, create_category, update_category, delete_category},
    years::{
        list_years, create_year, get_year, get_month, update_income,
        create_expense, update_expense, delete_expense, expenses_by_category,
    },
};

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "timestamp": chrono::Utc::now().to_rfc3339() }))
}

async fn authenticate(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, expense_tracker_backend::AppError> {
    use expense_tracker_backend::AppError;
    let password = payload.get("password")
        .and_then(|p| p.as_str())
        .ok_or_else(|| AppError::Validation("Password required".to_string()))?;
    match state.auth.authenticate(password) {
        Some(token) => Ok(Json(json!({ "token": token }))),
        None => Err(AppError::Unauthorized("Invalid password".to_string())),
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Expense Tracker Backend (Rust)");

    let port: u16 = env::var("PORT").unwrap_or_else(|_| "3000".to_string()).parse().unwrap_or(3000);
    let data_dir = env::var("DATA_PATH").unwrap_or_else(|_| "/data".to_string());

    info!("Data dir: {}", data_dir);

    let store = AppStore::new(&data_dir).await?;
    let auth = AuthManager::new().await?;
    let state = AppState { store, auth };

    // NOTE: by-category must be registered BEFORE /:expense_id to avoid route conflict
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/auth", post(authenticate))
        .route("/api/categories", get(list_categories).post(create_category))
        .route("/api/categories/:id", put(update_category).delete(delete_category))
        .route("/api/years", get(list_years).post(create_year))
        .route("/api/years/:year", get(get_year))
        .route("/api/years/:year/months/:month", get(get_month))
        .route("/api/years/:year/months/:month/income", put(update_income))
        .route("/api/years/:year/months/:month/expenses", post(create_expense))
        .route("/api/years/:year/months/:month/expenses/by-category", get(expenses_by_category))
        .route("/api/years/:year/months/:month/expenses/:expense_id",
            put(update_expense).delete(delete_expense))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
