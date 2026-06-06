use std::time::Duration;
use axum::{extract::State, http::HeaderMap, Json};
use reqwest::Client;
use serde_json::json;
use uuid::Uuid;

use crate::error::AppError;
use crate::game;
use crate::models::{
    AddMeRequest, AddMemberRequest, CheerReceived, CheerRequest, GoldEvent, HealthEvent,
    PartyMemberRecord, PublicCharacter, ReceiveCheerRequest, ResolvedRandomEvent,
    RemoveMeRequest, RemoveMemberRequest, UpdateCharacterRequest,
};
use super::{require_auth, AppState};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Storage(e.to_string()))
}

/// Build an outbound URL for a party member's habits API.
/// base is the bare origin (e.g. https://habits.example.com).
fn habits_url(base: &str, path: &str) -> String {
    format!("{}/habits{}", base.trim_end_matches('/'), path)
}

// ── GET /api/party/public (no auth) ──────────────────────────────────────────

pub async fn get_public(
    State(state): State<AppState>,
) -> Result<Json<PublicCharacter>, AppError> {
    let character = state.store.character.get();
    let eq = state.store.equipment.get();
    let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
            (d + item.damage, a + item.armor)
        } else {
            (d, a)
        }
    });
    Ok(Json(PublicCharacter {
        name: character.name,
        hp: character.hp,
        armor,
        damage,
        renown: character.renown,
        last_seen: character.last_tick_date,
    }))
}

// ── PATCH /api/character (auth) ───────────────────────────────────────────────

pub async fn update_character(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<UpdateCharacterRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;
    let mut character = state.store.character.get();
    match body.name {
        Some(n) => {
            let trimmed = n.trim().to_string();
            character.name = if trimmed.is_empty() { None } else { Some(trimmed) };
        }
        None => character.name = None,
    }
    state.store.character.save(character).await?;
    Ok(Json(json!({ "ok": true })))
}

// ── GET /api/party (auth) ─────────────────────────────────────────────────────

pub async fn get_party(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;

    let mut party = state.store.party.get();
    let client = make_client()?;

    for member in &mut party.members {
        let public_url = habits_url(&member.url, "/api/party/public");
        if let Ok(resp) = client.get(&public_url).send().await {
            if let Ok(public) = resp.json::<PublicCharacter>().await {
                member.cached_public = Some(public);
                member.cache_updated_at = Some(chrono::Utc::now().to_rfc3339());
            }
        }
    }

    state.store.party.save(party.clone()).await?;
    Ok(Json(json!({ "members": party.members })))
}

// ── POST /api/party/members (auth) ───────────────────────────────────────────

pub async fn add_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AddMemberRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;

    let url = body.url.trim_end_matches('/').to_string();
    let my_url = body.my_url.trim_end_matches('/').to_string();

    let mut party = state.store.party.get();
    if party.members.iter().any(|m| m.url == url) {
        return Err(AppError::Conflict("Already in party".to_string()));
    }

    let client = make_client()?;
    let public_url = habits_url(&url, "/api/party/public");
    let cached_public = match client.get(&public_url).send().await {
        Ok(resp) => resp.json::<PublicCharacter>().await.ok(),
        Err(_) => None,
    };

    party.members.push(PartyMemberRecord {
        url: url.clone(),
        added_at: chrono::Utc::now().to_rfc3339(),
        last_cheer_sent_at: None,
        cached_public,
        cache_updated_at: Some(chrono::Utc::now().to_rfc3339()),
    });

    state.store.party.save(party).await?;

    // Best-effort: register ourselves at their server so they get added back
    if let Ok(client) = make_client() {
        let add_me_url = habits_url(&url, "/api/party/add-me");
        let _ = client
            .post(&add_me_url)
            .json(&json!({ "url": my_url }))
            .send()
            .await;
    }

    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/party/add-me (no auth) ─────────────────────────────────────────
// Called by a remote server when they add us; idempotent.

pub async fn add_me(
    State(state): State<AppState>,
    Json(body): Json<AddMeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let url = body.url.trim_end_matches('/').to_string();

    let mut party = state.store.party.get();
    if party.members.iter().any(|m| m.url == url) {
        return Ok(Json(json!({ "ok": true })));
    }

    let client = make_client()?;
    let public_url = habits_url(&url, "/api/party/public");
    let cached_public = match client.get(&public_url).send().await {
        Ok(resp) => resp.json::<PublicCharacter>().await.ok(),
        Err(_) => None,
    };

    party.members.push(PartyMemberRecord {
        url,
        added_at: chrono::Utc::now().to_rfc3339(),
        last_cheer_sent_at: None,
        cached_public,
        cache_updated_at: Some(chrono::Utc::now().to_rfc3339()),
    });

    state.store.party.save(party).await?;
    Ok(Json(json!({ "ok": true })))
}

// ── DELETE /api/party/members (auth) ─────────────────────────────────────────

pub async fn remove_member(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RemoveMemberRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;

    let url = body.url.trim_end_matches('/').to_string();
    let my_url = body.my_url.trim_end_matches('/').to_string();

    let mut party = state.store.party.get();
    let before = party.members.len();
    party.members.retain(|m| m.url != url);
    if party.members.len() == before {
        return Err(AppError::NotFound("Member not found".to_string()));
    }
    state.store.party.save(party).await?;

    // Best-effort: ask them to remove us
    if let Ok(client) = make_client() {
        let remove_me_url = habits_url(&url, "/api/party/remove-me");
        let _ = client
            .post(&remove_me_url)
            .json(&json!({ "url": my_url }))
            .send()
            .await;
    }

    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/party/remove-me (no auth) ──────────────────────────────────────

pub async fn remove_me(
    State(state): State<AppState>,
    Json(body): Json<RemoveMeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let url = body.url.trim_end_matches('/').to_string();
    let mut party = state.store.party.get();
    party.members.retain(|m| m.url != url);
    state.store.party.save(party).await?;
    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/party/cheer (auth) ─────────────────────────────────────────────

pub async fn cheer(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CheerRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_auth(&headers, &state).await?;

    let today = game::today_str();
    let target_url = body.target_url.trim_end_matches('/').to_string();
    let my_url = body.my_url.trim_end_matches('/').to_string();

    // Validate member exists and not already cheered today
    {
        let party = state.store.party.get();
        let member = party
            .members
            .iter()
            .find(|m| m.url == target_url)
            .ok_or_else(|| AppError::Validation("Not a party member".to_string()))?;
        if member.last_cheer_sent_at.as_deref() == Some(today.as_str()) {
            return Err(AppError::Validation("Already cheered today".to_string()));
        }
    }

    // Validate gold
    let cheer_cost = 25.0f64;
    {
        let character = state.store.character.get();
        if character.gold < cheer_cost {
            return Err(AppError::Validation("Not enough gold (need 25)".to_string()));
        }
    }

    // Call their server
    let client = make_client()?;
    let receive_url = habits_url(&target_url, "/api/party/receive-cheer");
    let resp = client
        .post(&receive_url)
        .json(&json!({ "fromUrl": my_url }))
        .send()
        .await
        .map_err(|_| AppError::Validation("Could not reach party member".to_string()))?;

    if !resp.status().is_success() {
        let body_val: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = body_val["error"].as_str().unwrap_or("Cheer failed").to_string();
        return Err(AppError::Validation(msg));
    }

    // Deduct gold
    let mut character = state.store.character.get();
    let gold_event = GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "cheer_sent".to_string(),
        amount: -cheer_cost,
        reason: "Party cheer sent".to_string(),
        habit_id: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    character.gold = game::apply_gold_delta(character.gold, -cheer_cost);
    state.store.events.append_gold(gold_event).await?;
    state.store.character.save(character).await?;

    // Mark cheer sent
    let mut party = state.store.party.get();
    if let Some(m) = party.members.iter_mut().find(|m| m.url == target_url) {
        m.last_cheer_sent_at = Some(today);
    }
    state.store.party.save(party).await?;

    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/party/receive-cheer (no auth) ──────────────────────────────────

pub async fn receive_cheer(
    State(state): State<AppState>,
    Json(body): Json<ReceiveCheerRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let today = game::today_str();
    let from_url = body.from_url.trim_end_matches('/').to_string();

    let party = state.store.party.get();

    if !party.members.iter().any(|m| m.url == from_url) {
        return Err(AppError::Validation("Not a party member".to_string()));
    }

    if party
        .cheers_received_log
        .iter()
        .any(|c| c.from_url == from_url && c.date == today)
    {
        return Err(AppError::Validation(
            "Already received a cheer from this member today".to_string(),
        ));
    }

    drop(party);

    // Award HP
    let mut character = state.store.character.get();
    let hp_gain = 5.0f64;
    let actual_gain = hp_gain.min(100.0 - character.hp).max(0.0);
    character.hp = (character.hp + hp_gain).min(100.0);

    let health_event = HealthEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "regen".to_string(),
        amount: actual_gain,
        reason: "Party cheer".to_string(),
        habit_id: None,
        tick_date: today.clone(),
    };
    state.store.events.append_health(health_event).await?;
    state.store.character.save(character).await?;

    // Inject a "Party Cheer" encounter entry in the event history
    let resolved = ResolvedRandomEvent {
        event_id: "party-cheer".to_string(),
        title: "An ally cheers you on!".to_string(),
        appeared_at: today.clone(),
        resolved_at: today.clone(),
        choice_made: None,
        outcome_text: format!(
            "A party member rallied behind you, restoring {:.0} HP.",
            actual_gain
        ),
        hp_delta: actual_gain,
        gold_delta: 0.0,
    };
    let mut ev_state = state.store.random_events.get();
    ev_state.history.insert(0, resolved);
    ev_state.history.truncate(10);
    state.store.random_events.save(ev_state).await?;

    // Record cheer in log
    let mut party = state.store.party.get();
    party.cheers_received_log.push(CheerReceived {
        from_url,
        date: today,
    });
    if party.cheers_received_log.len() > 200 {
        party.cheers_received_log.drain(0..100);
    }
    state.store.party.save(party).await?;

    Ok(Json(json!({ "ok": true })))
}
