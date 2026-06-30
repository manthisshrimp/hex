use axum::{extract::{Path, State}, http::HeaderMap, Json};
use chrono::{Datelike, Utc};
use rand::{SeedableRng, seq::SliceRandom};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::error::AppError;
use crate::game;
use crate::models::GoldEvent;
use super::AppState;

fn week_seed() -> u64 {
    let now = Utc::now();
    let week = now.iso_week();
    // Unique per ISO year+week
    let key = format!("{}-W{:02}", week.year(), week.week());
    // FNV-1a hash for determinism
    let mut hash: u64 = 14695981039346656037u64;
    for byte in key.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211u64);
    }
    hash
}

fn shop_item_ids(catalogue: &[crate::models::Item]) -> Vec<String> {
    let seed = week_seed();
    let mut rng = rand::rngs::StdRng::seed_from_u64(seed);

    let mut regular: Vec<usize> = (0..catalogue.len())
        .filter(|&i| catalogue[i].required_renown.is_none())
        .collect();
    regular.shuffle(&mut rng);

    let mut renown: Vec<usize> = (0..catalogue.len())
        .filter(|&i| catalogue[i].required_renown.is_some())
        .collect();
    renown.shuffle(&mut rng);

    let mut ids: Vec<String> = regular[..4.min(regular.len())]
        .iter()
        .map(|&i| catalogue[i].id.clone())
        .collect();

    if let Some(&ri) = renown.first() {
        ids.push(catalogue[ri].id.clone());
    }

    ids
}

// ── GET /api/shop ─────────────────────────────────────────────────────────────

pub async fn get_shop(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let ids = shop_item_ids(&state.catalogue);
    let items: Vec<_> = ids.iter()
        .filter_map(|id| state.catalogue.iter().find(|item| &item.id == id))
        .collect();

    let week = {
        let now = Utc::now();
        let w = now.iso_week();
        format!("{}-W{:02}", w.year(), w.week())
    };

    Ok(Json(json!({ "week": week, "items": items })))
}

// ── POST /api/shop/buy/:id ────────────────────────────────────────────────────

pub async fn buy_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    // Look up item in catalogue.
    let item = state.catalogue.iter()
        .find(|i| i.id == id)
        .ok_or_else(|| AppError::NotFound("Item not found".to_string()))?;

    // All items must be in the current weekly shop.
    let shop_ids = shop_item_ids(&state.catalogue);
    if !shop_ids.contains(&id) {
        return Err(AppError::Validation("Item not available in current shop".to_string()));
    }

    let mut character = state.store.character.get();

    // Check renown requirement.
    if let Some(required) = item.required_renown {
        if character.renown < required as f64 {
            return Err(AppError::Validation(format!(
                "Insufficient renown: need {}, have {}",
                required,
                character.renown as u32
            )));
        }
    }

    // Check character gold.
    if character.gold < item.price as f64 {
        return Err(AppError::Validation(format!(
            "Insufficient gold: need {}, have {}",
            item.price,
            character.gold as u64
        )));
    }

    // Deduct gold.
    character.gold = game::apply_gold_delta(character.gold, -(item.price as f64));
    let new_gold = character.gold;

    let gold_event = GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "purchase".to_string(),
        amount: -(item.price as f64),
        reason: format!("bought: {}", item.name),
        habit_id: None,
        timestamp: Utc::now().to_rfc3339(),
    };
    state.store.events.append_gold(gold_event).await?;
    state.store.character.save(character).await?;

    // Add to inventory.
    let mut equipment = state.store.equipment.get();
    equipment.inventory.push(id.clone());
    equipment.durability.entry(item.id.clone()).or_insert(item.max_durability);
    state.store.equipment.save(equipment).await?;

    Ok(Json(json!({ "item_id": id, "new_gold": new_gold })))
}
