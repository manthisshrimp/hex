// inventory/backend-rust/src/main.rs
use inventory_backend::{AppState, AuthManager, ItemStore, CheckStore, TodoSetStore};
use inventory_backend::routes;
use axum::{routing::{get, post}, Router, Json};
use tower_http::cors::CorsLayer;
use std::env;
use tracing::info;
use serde_json::json;

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn authenticate(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, inventory_backend::error::AppError> {
    use inventory_backend::error::AppError;
    let password = body.get("password")
        .and_then(|p| p.as_str())
        .ok_or_else(|| AppError::Validation("Password required".into()))?;

    let hash = AuthManager::hash(password);
    if !state.auth.verify(&hash).await {
        return Err(AppError::Forbidden("Invalid password".into()));
    }
    Ok(Json(json!({ "token": hash })))
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse().unwrap_or(3000);

    let data_path = env::var("DATA_PATH").unwrap_or_else(|_| "/data".to_string());

    info!("Starting inventory backend on port {port}, data path: {data_path}");

    let state = AppState {
        auth:      AuthManager::new().await?,
        items:     ItemStore::new(&format!("{data_path}/items.jsonl")).await?,
        checks:    CheckStore::new(&format!("{data_path}/checks.jsonl")).await?,
        todo_sets: TodoSetStore::new(&format!("{data_path}/todo_sets.jsonl")).await?,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/auth", post(authenticate))
        .merge(routes::items::router())
        .merge(routes::checks::router())
        .merge(routes::todo_sets::router())
        .merge(routes::tags::router())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
