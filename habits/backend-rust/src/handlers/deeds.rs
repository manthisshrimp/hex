use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use uuid::Uuid;
use serde_json::{json, Value};

use crate::error::AppError;
use crate::game;
use crate::models::{CreateDeedRequest, DeedLog, DeedWithState, HealthEvent, UpdateDeedRequest};
use crate::storage::deeds::deed_effect;
use super::AppState;

// ── GET /api/deeds ────────────────────────────────────────────────────────────

pub async fn list_deeds(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<DeedWithState>>, AppError> {
    super::require_auth(&headers, &state).await?;
    let today_str = game::today_str();
    let deeds = state.store.deeds.get_all();
    let result = deeds.into_iter().map(|d| {
        let logged_today = state.store.deed_logs.logged_today(&d.id, &today_str);
        let effect = deed_effect(&d.importance);
        DeedWithState { deed: d, logged_today, effect }
    }).collect();
    Ok(Json(result))
}

// ── POST /api/deeds ───────────────────────────────────────────────────────────

pub async fn create_deed(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateDeedRequest>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::require_auth(&headers, &state).await?;
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Name is required".to_string()));
    }
    if body.deed_type != "good" && body.deed_type != "bad" {
        return Err(AppError::Validation("Type must be 'good' or 'bad'".to_string()));
    }
    let deed = state.store.deeds.create(body).await?;
    Ok((StatusCode::CREATED, Json(json!(deed))))
}

// ── PUT /api/deeds/:id ────────────────────────────────────────────────────────

pub async fn update_deed(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateDeedRequest>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let updated = state.store.deeds.update(&id, body).await?;
    Ok(Json(json!(updated)))
}

// ── DELETE /api/deeds/:id ─────────────────────────────────────────────────────

pub async fn delete_deed(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    super::require_auth(&headers, &state).await?;
    state.store.deeds.delete(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── POST /api/deeds/:id/log ───────────────────────────────────────────────────

pub async fn log_deed(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today_str = game::today_str();

    let deed = state.store.deeds.get_by_id(&id)
        .ok_or_else(|| AppError::NotFound("Deed not found".to_string()))?;

    if state.store.deed_logs.logged_today(&id, &today_str) {
        return Err(AppError::Validation("Deed already logged today".to_string()));
    }

    let amount = deed_effect(&deed.importance);
    let mut character = state.store.character.get();

    let (renown_delta, hp_delta) = if deed.deed_type == "good" {
        // Good deed: always grant renown regardless of HP state
        (amount, 0.0)
    } else {
        // Bad deed: drain renown first, remainder goes to HP
        let renown_drain = amount.min(character.renown);
        let hp_drain = amount - renown_drain;
        (-renown_drain, -hp_drain)
    };

    character.renown = (character.renown + renown_delta).max(0.0);
    character.hp = (character.hp + hp_delta).clamp(0.0, 100.0);

    // Record HP event for bad deeds that dealt HP damage
    if hp_delta < 0.0 {
        let hp_event = HealthEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "damage".to_string(),
            amount: -hp_delta,
            reason: format!("bad deed: {}", deed.name),
            habit_id: None,
            tick_date: today_str.clone(),
        };
        state.store.events.append_health(hp_event).await?;
    }

    state.store.character.save(character.clone()).await?;

    let log = DeedLog {
        id: Uuid::new_v4().to_string(),
        deed_id: id,
        logged_at: today_str,
        renown_delta,
        hp_delta,
    };
    state.store.deed_logs.append(log).await?;

    Ok(Json(json!({
        "renownDelta": renown_delta,
        "hpDelta": hp_delta,
        "newRenown": character.renown,
        "newHp": character.hp,
    })))
}
