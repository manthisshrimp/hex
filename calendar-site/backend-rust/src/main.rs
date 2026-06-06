// calendar-site/backend-rust/src/main.rs
use calendar_backend::{AppState, AuthManager, EventStore, CategoryStore};
use calendar_backend::routes;
use axum::{routing::{get, post, put, delete}, Router, Json};
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
) -> Result<Json<serde_json::Value>, calendar_backend::error::AppError> {
    use calendar_backend::error::AppError;
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

    info!("Starting calendar backend on port {port}, data path: {data_path}");

    let state = AppState {
        auth:       AuthManager::new().await?,
        events:     EventStore::new(&format!("{data_path}/events.jsonl")).await?,
        categories: CategoryStore::new(&format!("{data_path}/categories.json")).await?,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/auth", post(authenticate))
        // events — by-id literal registered before wildcard (Axum resolves literal first)
        .route("/api/events",           get(routes::events::list).post(routes::events::create))
        .route("/api/events/by-id/:id", get(routes::events::get_by_id))
        // GET /:id handles date queries; PUT/DELETE use the same param slot
        .route("/api/events/:id",       get(routes::events::get_for_date).put(routes::events::update).delete(routes::events::delete))
        .route("/api/days",             get(routes::days::list))
        .route("/api/categories",       get(routes::categories::list).post(routes::categories::create))
        .route("/api/categories/:id",   put(routes::categories::update).delete(routes::categories::delete))
        .route("/api/holidays/import",  post(routes::holidays::import))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
