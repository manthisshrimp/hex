use axum::{extract::{Path, State}, http::HeaderMap, Json};
use serde_json::{json, Value};

use crate::error::AppError;
use super::AppState;

const VALID_SLOTS: &[&str] = &[
    "weapon", "offhand", "helm", "chest", "gloves", "belt", "boots", "amulet", "ring1", "ring2",
];

/// Loadout is locked while in an active boss quest — you commit your gear up
/// front and pay the (light) wear, rather than stripping it to dodge wear.
fn loadout_locked(state: &AppState) -> bool {
    state.store.boss.get().participating
        .map(|p| p.outcome.is_none())
        .unwrap_or(false)
}

// ── GET /api/equipment ────────────────────────────────────────────────────────

pub async fn get_equipment(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    let eq = state.store.equipment.get();

    // Expand equipped slots to full item objects.
    let equipped_obj: serde_json::Map<String, Value> = eq.equipped.iter()
        .filter_map(|(slot, item_id)| {
            state.catalogue.iter()
                .find(|i| &i.id == item_id)
                .map(|item| (slot.clone(), serde_json::to_value(item).unwrap_or(Value::Null)))
        })
        .collect();

    // Expand inventory to full item objects (preserve order).
    let inventory: Vec<Value> = eq.inventory.iter()
        .filter_map(|item_id| {
            state.catalogue.iter()
                .find(|i| &i.id == item_id)
                .map(|item| serde_json::to_value(item).unwrap_or(Value::Null))
        })
        .collect();

    Ok(Json(json!({ "equipped": equipped_obj, "inventory": inventory })))
}

// ── POST /api/equipment/equip/:id ─────────────────────────────────────────────

pub async fn equip_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    if loadout_locked(&state) {
        return Err(AppError::Validation("Gear is locked during an active boss quest.".to_string()));
    }

    // Verify item exists in catalogue.
    let item = state.catalogue.iter()
        .find(|i| i.id == id)
        .ok_or_else(|| AppError::NotFound("Item not found".to_string()))?;

    // Verify player owns it.
    let mut eq = state.store.equipment.get();
    if !eq.inventory.contains(&id) {
        return Err(AppError::Validation("Item not in inventory".to_string()));
    }

    // Determine target slot.
    let target_slot = if item.slot == "ring" {
        // Auto-assign: ring1 first, then ring2, then replace ring1.
        if !eq.equipped.contains_key("ring1") {
            "ring1".to_string()
        } else if !eq.equipped.contains_key("ring2") {
            "ring2".to_string()
        } else {
            "ring1".to_string()
        }
    } else {
        item.slot.clone()
    };

    // Validate slot name.
    if !VALID_SLOTS.contains(&target_slot.as_str()) {
        return Err(AppError::Validation(format!("Invalid slot: {target_slot}")));
    }

    // Equip (previous item in slot stays in inventory).
    eq.equipped.insert(target_slot.clone(), id.clone());
    eq.durability.entry(id.clone()).or_insert(item.max_durability);
    state.store.equipment.save(eq).await?;

    Ok(Json(json!({ "slot": target_slot, "item_id": id })))
}

// ── POST /api/equipment/unequip/:slot ─────────────────────────────────────────

pub async fn unequip_slot(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slot): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;

    if loadout_locked(&state) {
        return Err(AppError::Validation("Gear is locked during an active boss quest.".to_string()));
    }

    if !VALID_SLOTS.contains(&slot.as_str()) {
        return Err(AppError::Validation(format!("Invalid slot: {slot}")));
    }

    let mut eq = state.store.equipment.get();
    let removed = eq.equipped.remove(&slot);

    if removed.is_none() {
        return Err(AppError::Validation(format!("Slot {slot} is already empty")));
    }

    state.store.equipment.save(eq).await?;

    Ok(Json(json!({ "slot": slot, "unequipped": removed })))
}
