use axum::{
    routing::{delete, get, post, put},
    Router,
    Json,
};
use tower_http::cors::CorsLayer;
use std::env;
use std::sync::Arc;
use tracing::info;
use serde_json::json;

use habits_backend::{AppState, AuthManager, AppStore, AppError, GameConfig, TaskBoardSync};
use habits_backend::handlers::{
    character::{get_character, pay_ferryman, checkin},
    debug::advance_days,
    habits::{
        list_habits, create_habit, update_habit, delete_habit,
        complete_habit, reschedule_habit, move_habit, inscribe_habit, restore_habit,
    },
    history::{history_hp, history_gold, history_completions},
    shop::{get_shop, buy_item},
    equipment::{get_equipment, equip_item, unequip_slot},
    random_event::{get_random_event, resolve_random_event, choose_random_event, get_random_event_history, inject_encounter},
    todos::{list_todos, create_todo, complete_todo, delete_todo, get_reward, claim_reward},
    deeds::{list_deeds, create_deed, update_deed, delete_deed, log_deed},
    service::{service_create_todo, service_complete_todo, service_delete_todo},
    party::{
        get_public, update_character, get_party, add_member, add_me,
        remove_member, remove_me, cheer, receive_cheer,
    },
};
use habits_backend::models::Item;

// ── Health ────────────────────────────────────────────────────────────────────

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async fn authenticate(
    axum::extract::State(state): axum::extract::State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    let password = payload
        .get("password")
        .and_then(|p| p.as_str())
        .ok_or_else(|| AppError::Validation("Password required".to_string()))?;
    match state.auth.authenticate(password) {
        Some(token) => Ok(Json(json!({ "token": token }))),
        None => Err(AppError::Unauthorized("Invalid password".to_string())),
    }
}

// ── Shared API key loader ─────────────────────────────────────────────────────

async fn load_api_key() -> Option<String> {
    let path = env::var("OCTIRON_API_KEY_PATH")
        .unwrap_or_else(|_| "/root/.octiron-api-key".to_string());
    match tokio::fs::read_to_string(&path).await {
        Ok(k) => {
            info!("Octiron API key loaded from {path}");
            Some(k.trim().to_string())
        }
        Err(_) => {
            tracing::warn!("Octiron API key not found at {path} — service endpoints disabled");
            None
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

static ITEMS_JSON: &str = include_str!("../items.json");

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Habits Backend (Rust)");

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);
    let data_dir = env::var("DATA_PATH").unwrap_or_else(|_| "/data".to_string());

    info!("Port: {}", port);
    info!("Data dir: {}", data_dir);

    let catalogue: Vec<Item> = serde_json::from_str(ITEMS_JSON)
        .expect("items.json must be valid");
    info!("Loaded {} items in catalogue", catalogue.len());

    let store = AppStore::new(&data_dir).await?;
    let auth = AuthManager::new().await?;
    let config = GameConfig::default();
    let api_key = load_api_key().await;
    let sync = TaskBoardSync::new().await;

    let state = AppState {
        store,
        auth,
        config,
        catalogue: Arc::new(catalogue),
        api_key,
        sync,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/auth", post(authenticate))
        .route("/api/character", get(get_character).patch(update_character))
        .route("/api/character/pay-ferryman", post(pay_ferryman))
        .route("/api/character/checkin", post(checkin))
        .route("/api/party/public", get(get_public))
        .route("/api/party", get(get_party))
        .route("/api/party/members", post(add_member).delete(remove_member))
        .route("/api/party/add-me", post(add_me))
        .route("/api/party/remove-me", post(remove_me))
        .route("/api/party/cheer", post(cheer))
        .route("/api/party/receive-cheer", post(receive_cheer))
        .route("/api/habits", get(list_habits).post(create_habit))
        .route("/api/habits/:id", put(update_habit).delete(delete_habit))
        .route("/api/habits/:id/complete", post(complete_habit))
        .route("/api/habits/:id/move", post(move_habit))
        .route("/api/habits/:id/reschedule", post(reschedule_habit))
        .route("/api/habits/:id/inscribe", post(inscribe_habit))
        .route("/api/habits/:id/restore", post(restore_habit))
        .route("/api/history/hp", get(history_hp))
        .route("/api/history/gold", get(history_gold))
        .route("/api/history/completions", get(history_completions))
        .route("/api/debug/advance-days", post(advance_days))
        .route("/api/shop", get(get_shop))
        .route("/api/shop/buy/:id", post(buy_item))
        .route("/api/equipment", get(get_equipment))
        .route("/api/equipment/equip/:id", post(equip_item))
        .route("/api/equipment/unequip/:slot", post(unequip_slot))
        .route("/api/random-event", get(get_random_event))
        .route("/api/random-event/resolve", post(resolve_random_event))
        .route("/api/random-event/choose", post(choose_random_event))
        .route("/api/random-event/history", get(get_random_event_history))
        .route("/api/encounters", post(inject_encounter))
        .route("/api/todos", get(list_todos).post(create_todo))
        .route("/api/todos/reward", get(get_reward))
        .route("/api/todos/reward/claim", post(claim_reward))
        .route("/api/todos/:id/complete", post(complete_todo))
        .route("/api/todos/:id", delete(delete_todo))
        .route("/api/deeds", get(list_deeds).post(create_deed))
        .route("/api/deeds/:id", put(update_deed).delete(delete_deed))
        .route("/api/deeds/:id/log", post(log_deed))
        // Service routes — authenticated via X-Api-Key (inter-app calls from task-board)
        .route("/api/service/todos", post(service_create_todo))
        .route("/api/service/todos/:id/complete", post(service_complete_todo))
        .route("/api/service/todos/:id", delete(service_delete_todo))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
