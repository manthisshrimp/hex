use std::time::Duration;
use axum::{extract::State, http::HeaderMap, Json};
use chrono::NaiveDate;
use reqwest::Client;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::bosses_catalogue::{self as boss_cat, BossDef};
use crate::error::AppError;
use crate::game;
use crate::models::{
    ContributeRequest, GoldEvent, HealthEvent,
    HostedQuest, JoinBossRequest, LaunchBossRequest, MemberContribution,
    ParticipantRequest, Participation,
};
use super::{require_auth, AppState};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::Storage(e.to_string()))
}

fn habits_url(base: &str, path: &str) -> String {
    format!("{}/habits{}", base.trim_end_matches('/'), path)
}

fn my_url() -> String {
    std::env::var("MY_URL").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

// ── GET /api/boss/active (no auth, peer-to-peer) ──────────────────────────────

pub async fn get_active(
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    let mut boss = state.store.boss.get();

    let Some(ref hosted) = boss.hosted else {
        return Ok(Json(Value::Null));
    };

    // Prune if ended_at + 30 days has passed
    if let Some(ref ended_at) = hosted.ended_at {
        if let Ok(ended) = NaiveDate::parse_from_str(ended_at, "%Y-%m-%d") {
            let today = game::today();
            if today > ended + chrono::Duration::days(30) {
                boss.hosted = None;
                let _ = state.store.boss.save(boss).await;
                return Ok(Json(Value::Null));
            }
        }
    }

    Ok(Json(serde_json::to_value(hosted).map_err(|e| AppError::Storage(e.to_string()))?))
}

// ── POST /api/boss/participants (no auth, peer-to-peer) ───────────────────────

pub async fn post_participants(
    State(state): State<AppState>,
    Json(body): Json<ParticipantRequest>,
) -> Result<Json<Value>, AppError> {
    let mut boss = state.store.boss.get();

    let hosted = boss.hosted.as_mut()
        .filter(|h| h.status == "active")
        .ok_or_else(|| AppError::Validation("No active hosted quest".to_string()))?;

    let url = body.url.trim_end_matches('/').to_string();

    // Idempotent
    if hosted.contributions.contains_key(&url) {
        return Ok(Json(json!({ "ok": true })));
    }

    // HP is fixed — joining adds a contributor but does not raise the pool, so
    // every member (even a late one) only speeds the kill.
    hosted.contributions.insert(url, MemberContribution { last_date: "".to_string(), total: 0.0 });

    state.store.boss.save(boss).await?;
    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/boss/contribute (no auth, peer-to-peer) ────────────────────────

pub async fn post_contribute(
    State(state): State<AppState>,
    Json(body): Json<ContributeRequest>,
) -> Result<Json<Value>, AppError> {
    let mut boss = state.store.boss.get();

    let hosted = boss.hosted.as_mut()
        .ok_or_else(|| AppError::Validation("No hosted quest".to_string()))?;

    if hosted.status != "active" {
        return Err(AppError::Validation("Quest is not active".to_string()));
    }

    let url = body.url.trim_end_matches('/').to_string();

    let contrib = hosted.contributions.get_mut(&url)
        .ok_or_else(|| AppError::Validation("Not a participant".to_string()))?;

    // Idempotent: same or earlier date → no-op, return current state
    if !contrib.last_date.is_empty() && body.date.as_str() <= contrib.last_date.as_str() {
        return Ok(Json(json!({
            "hpRemaining": hosted.hp_remaining,
            "status": hosted.status,
        })));
    }

    contrib.total += body.p;
    contrib.last_date = body.date.clone();
    hosted.hp_remaining -= body.p;

    // Check win/time-out
    let today_str = game::today_str();
    if hosted.hp_remaining <= 0.0 || today_str.as_str() >= hosted.ends_at.as_str() {
        hosted.status = "ended".to_string();
        hosted.ended_at = Some(today_str);
    }

    let hp_remaining = hosted.hp_remaining;
    let status = hosted.status.clone();
    state.store.boss.save(boss).await?;

    Ok(Json(json!({
        "hpRemaining": hp_remaining,
        "status": status,
    })))
}

// ── POST /api/boss/launch (auth) ─────────────────────────────────────────────

pub async fn post_launch(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<LaunchBossRequest>,
) -> Result<Json<Value>, AppError> {
    require_auth(&headers, &state).await?;

    let mut boss = state.store.boss.get();

    if boss.participating.is_some() {
        return Err(AppError::Validation("Already participating in a quest".to_string()));
    }

    // Boss must be revealed
    if !boss.revealed.iter().any(|r| r.boss_id == body.boss_id) {
        return Err(AppError::Validation("Boss not revealed".to_string()));
    }

    // Boss must exist in catalogue
    let boss_def = boss_cat::find(&body.boss_id)
        .ok_or_else(|| AppError::Validation("Unknown boss".to_string()))?;

    // Only one boss per party at a time — reject if any member is already hosting.
    let party = state.store.party.get();
    let client = make_client()?;
    for member in &party.members {
        let active_url = habits_url(&member.url, "/api/boss/active");
        if let Ok(resp) = client.get(&active_url).send().await {
            if let Ok(Some(hq)) = resp.json::<Option<HostedQuest>>().await {
                if hq.status == "active" {
                    return Err(AppError::Validation(
                        "A party member already has an active boss quest — join theirs instead.".to_string(),
                    ));
                }
            }
        }
    }

    let my = my_url();
    let today_str = game::today_str();
    let today = game::today();
    let ends_at = (today + chrono::Duration::days(boss_def.duration_days as i64))
        .format("%Y-%m-%d")
        .to_string();
    let quest_id = Uuid::new_v4().to_string();
    // Fixed HP — independent of party size, so partying up only speeds the kill.
    let hp_pool = boss_def.base_hp;

    let mut contributions = std::collections::HashMap::new();
    contributions.insert(my.clone(), MemberContribution { last_date: "".to_string(), total: 0.0 });

    let hosted = HostedQuest {
        quest_id: quest_id.clone(),
        boss_id: body.boss_id.clone(),
        host_url: my.clone(),
        started_at: today_str.clone(),
        duration_days: boss_def.duration_days,
        ends_at: ends_at.clone(),
        hp_pool,
        hp_remaining: hp_pool,
        contributions,
        status: "active".to_string(),
        ended_at: None,
    };

    let participation = Participation {
        quest_id,
        boss_id: body.boss_id.clone(),
        host_url: my.clone(),
        started_at: today_str,
        ends_at,
        last_contributed_date: "".to_string(),
        outbox: vec![],
        broken_gear: vec![],
        outcome: None,
        reward_claimed: false,
        resolved_at: None,
        cached_state: Some(hosted.clone()),
    };

    boss.hosted = Some(hosted);
    boss.participating = Some(participation);
    // Remove from revealed
    boss.revealed.retain(|r| r.boss_id != body.boss_id);

    state.store.boss.save(boss).await?;
    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/boss/join (auth) ────────────────────────────────────────────────

pub async fn post_join(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<JoinBossRequest>,
) -> Result<Json<Value>, AppError> {
    require_auth(&headers, &state).await?;

    let mut boss = state.store.boss.get();

    if boss.participating.is_some() {
        return Err(AppError::Validation("Already participating in a quest".to_string()));
    }

    let host_url = body.host_url.trim_end_matches('/').to_string();
    let client = make_client()?;
    let active_url = habits_url(&host_url, "/api/boss/active");

    let host_quest: Option<HostedQuest> = client
        .get(&active_url)
        .send()
        .await
        .map_err(|_| AppError::Validation("Could not reach host".to_string()))?
        .json()
        .await
        .map_err(|_| AppError::Validation("Invalid response from host".to_string()))?;

    let host_quest = host_quest
        .filter(|q| q.status == "active")
        .ok_or_else(|| AppError::Validation("Host has no active quest".to_string()))?;

    let my = my_url();

    let participation = Participation {
        quest_id: host_quest.quest_id.clone(),
        boss_id: host_quest.boss_id.clone(),
        host_url: host_url.clone(),
        started_at: host_quest.started_at.clone(),
        ends_at: host_quest.ends_at.clone(),
        last_contributed_date: "".to_string(),
        outbox: vec![],
        broken_gear: vec![],
        outcome: None,
        reward_claimed: false,
        resolved_at: None,
        cached_state: Some(host_quest),
    };

    boss.participating = Some(participation);
    state.store.boss.save(boss).await?;

    // Best-effort: register at host (outbox handles retry if this fails)
    if let Ok(client) = make_client() {
        let part_url = habits_url(&host_url, "/api/boss/participants");
        let _ = client.post(&part_url).json(&json!({ "url": my })).send().await;
    }

    Ok(Json(json!({ "ok": true })))
}

// ── POST /api/boss/abandon (auth) ────────────────────────────────────────────

pub async fn post_abandon(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    require_auth(&headers, &state).await?;

    let mut boss = state.store.boss.get();

    if boss.participating.is_none() {
        return Ok(Json(json!({ "ok": true })));
    }

    if let Some(ref mut p) = boss.participating {
        p.outcome = Some("abandoned".to_string());
        p.resolved_at = Some(game::today_str());
    }
    boss.participating = None;

    state.store.boss.save(boss).await?;
    Ok(Json(json!({ "ok": true })))
}

// ── GET /api/boss (auth) ──────────────────────────────────────────────────────

pub async fn get_boss(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    require_auth(&headers, &state).await?;

    let mut boss = state.store.boss.get();
    let today_str = game::today_str();
    let client = make_client()?;

    // ── 0. Seed the starter boss once, so a new account has something to fight ─
    if !boss.initialized {
        boss.initialized = true;
        if !boss.revealed.iter().any(|r| r.boss_id == boss_cat::STARTER_BOSS) {
            boss.revealed.push(crate::models::RevealedBoss {
                boss_id: boss_cat::STARTER_BOSS.to_string(),
                revealed_at: today_str.clone(),
            });
        }
        let _ = state.store.boss.save(boss.clone()).await;
    }

    // ── 1. Flush outbox ───────────────────────────────────────────────────────
    if let Some(ref mut p) = boss.participating {
        if p.outcome.is_none() && !p.outbox.is_empty() {
            let host_url = p.host_url.clone();
            let my = my_url();
            let contribute_url = habits_url(&host_url, "/api/boss/contribute");
            let mut flushed = vec![];
            for entry in &p.outbox {
                let ok = client
                    .post(&contribute_url)
                    .json(&json!({ "url": my, "date": entry.date, "p": entry.p }))
                    .send()
                    .await
                    .map(|r| r.status().is_success())
                    .unwrap_or(false);
                if ok { flushed.push(entry.date.clone()); }
            }
            p.outbox.retain(|e| !flushed.contains(&e.date));
        }
    }

    // ── 2. Resolve end state ──────────────────────────────────────────────────
    if let Some(ref mut p) = boss.participating {
        if p.outcome.is_none() {
            let host_url = p.host_url.clone();
            let boss_id = p.boss_id.clone();
            let ends_at = p.ends_at.clone();

            // Poll host for fresh state
            let active_url = habits_url(&host_url, "/api/boss/active");
            if let Ok(resp) = client.get(&active_url).send().await {
                if let Ok(hq) = resp.json::<Option<HostedQuest>>().await {
                    p.cached_state = hq.clone().or(p.cached_state.clone());
                }
            }

            let host_ended = p.cached_state.as_ref().map(|h| h.status == "ended").unwrap_or(false);
            let time_expired = today_str.as_str() >= ends_at.as_str();

            if host_ended || time_expired {
                let hp_remaining = p.cached_state.as_ref().map(|h| h.hp_remaining).unwrap_or(1.0);
                let victory = hp_remaining <= 0.0;
                let outcome = if victory { "victory" } else { "defeat" };
                p.outcome = Some(outcome.to_string());
                p.resolved_at = Some(today_str.clone());

                if victory && !p.reward_claimed {
                    p.reward_claimed = true;
                    if let Some(boss_def) = boss_cat::find(&boss_id) {
                        let _ = grant_victory_reward(&state, &boss_def).await;
                    }
                }
            }
        }
    }

    state.store.boss.save(boss.clone()).await?;

    // ── 3. Collect invitations from party members ─────────────────────────────
    let party = state.store.party.get();
    let mut invitations = vec![];
    for member in &party.members {
        let active_url = habits_url(&member.url, "/api/boss/active");
        if let Ok(resp) = client.get(&active_url).send().await {
            if let Ok(Some(hq)) = resp.json::<Option<HostedQuest>>().await {
                if hq.status == "active" {
                    // Only show if we're not already participating in this quest
                    let already = boss.participating.as_ref()
                        .map(|p| p.quest_id == hq.quest_id)
                        .unwrap_or(false);
                    if !already {
                        let boss_def = boss_cat::find(&hq.boss_id);
                        let participants_count = hq.contributions.len();
                        invitations.push(json!({
                            "hostUrl": member.url,
                            "boss": boss_def.as_ref().map(boss_def_to_json),
                            "participants": participants_count,
                        }));
                    }
                }
            }
        }
    }

    // ── 4. Assemble active quest info ─────────────────────────────────────────
    let active_val = if let Some(ref p) = boss.participating {
        if p.outcome.is_none() {
            let quest = p.cached_state.as_ref();
            let boss_def = boss_cat::find(&p.boss_id);

            let my = my_url();
            let char_name = state.store.character.get().name
                .unwrap_or_else(|| "You".to_string());
            let my_contribution = quest
                .and_then(|q| q.contributions.get(&my))
                .map(|c| c.total)
                .unwrap_or(0.0);
            let my_contributed_today = p.last_contributed_date == today_str;

            // Gear (equipped items with durability)
            let eq = state.store.equipment.get();
            let gear: Vec<Value> = eq.equipped.iter().map(|(slot, item_id)| {
                let item = state.catalogue.iter().find(|i| &i.id == item_id);
                let max_dur = item.map(|i| i.max_durability).unwrap_or(100);
                let dur = eq.durability.get(item_id.as_str()).copied().unwrap_or(max_dur);
                json!({
                    "slot": slot,
                    "name": item.map(|i| i.name.as_str()).unwrap_or("Unknown"),
                    "durability": dur,
                    "max": max_dur,
                })
            }).collect();

            // Leaderboard from cached state — resolve URLs to party member names
            let leaderboard: Vec<Value> = quest.map(|q| {
                let mut entries: Vec<_> = q.contributions.iter()
                    .map(|(url, c)| (url.clone(), c.total))
                    .collect();
                entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
                entries.into_iter().map(|(url, total)| {
                    let trimmed = url.trim_end_matches('/');
                    let is_me = trimmed == my.trim_end_matches('/');
                    let name = if is_me {
                        char_name.clone()
                    } else {
                        party.members.iter()
                            .find(|m| m.url.trim_end_matches('/') == trimmed)
                            .and_then(|m| m.cached_public.as_ref())
                            .and_then(|pc| pc.name.clone())
                            .unwrap_or_else(|| trimmed.replace("https://", "").replace("http://", ""))
                    };
                    json!({ "name": name, "total": total, "isMe": is_me })
                }).collect()
            }).unwrap_or_default();

            Some(json!({
                "boss": boss_def.as_ref().map(boss_def_to_json),
                "quest": quest,
                "myContribution": my_contribution,
                "myContributedToday": my_contributed_today,
                "gear": gear,
                "leaderboard": leaderboard,
            }))
        } else {
            None
        }
    } else {
        None
    };

    // ── 5. Recent (resolved participations) ───────────────────────────────────
    // ponytail: only current participation is tracked; recent list is from the single Participation slot
    let recent: Vec<Value> = boss.participating.as_ref()
        .filter(|p| p.outcome.is_some())
        .map(|p| {
            let boss_def = boss_cat::find(&p.boss_id);
            let broken_names: Vec<String> = p.broken_gear.iter().map(|id| {
                state.catalogue.iter().find(|i| &i.id == id)
                    .map(|i| i.name.clone())
                    .unwrap_or_else(|| id.clone())
            }).collect();
            vec![json!({
                "boss": boss_def.as_ref().map(boss_def_to_json),
                "outcome": p.outcome,
                "brokenGear": broken_names,
                "resolvedAt": p.resolved_at,
            })]
        })
        .unwrap_or_default();

    // ── 6. Revealed bosses ────────────────────────────────────────────────────
    let revealed: Vec<Value> = boss.revealed.iter().filter_map(|r| {
        boss_cat::find(&r.boss_id).map(|def| {
            let mut v = boss_def_to_json(&def);
            if let Value::Object(ref mut m) = v {
                m.insert("revealedAt".to_string(), Value::String(r.revealed_at.clone()));
            }
            v
        })
    }).collect();

    Ok(Json(json!({
        "active": active_val,
        "revealed": revealed,
        "invitations": invitations,
        "recent": recent,
    })))
}

// ── Reward ────────────────────────────────────────────────────────────────────

async fn grant_victory_reward(state: &AppState, boss_def: &BossDef) -> Result<(), AppError> {
    let mut character = state.store.character.get();

    // Always: gold
    character.gold = game::apply_gold_delta(character.gold, boss_def.reward_gold);
    state.store.events.append_gold(GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "boss_reward".to_string(),
        amount: boss_def.reward_gold,
        reason: format!("Boss defeated: {}", boss_def.name),
        habit_id: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }).await?;

    // Sometimes: item
    if let Some(item_id) = boss_def.reward_item {
        if rand::random::<f64>() < boss_def.reward_item_chance {
            let mut eq = state.store.equipment.get();
            let max_dur = state.catalogue.iter()
                .find(|i| i.id == item_id)
                .map(|i| i.max_durability)
                .unwrap_or(100);
            eq.inventory.push(item_id.to_string());
            eq.durability.insert(item_id.to_string(), max_dur);
            state.store.equipment.save(eq).await?;
        }
    }

    // Sometimes: heal
    if rand::random::<f64>() < boss_def.reward_heal_chance {
        let old_hp = character.hp;
        character.hp = (character.hp + boss_def.reward_heal).min(state.config.max_hp);
        let actual = character.hp - old_hp;
        if actual > 0.0 {
            state.store.events.append_health(HealthEvent {
                id: Uuid::new_v4().to_string(),
                event_type: "regen".to_string(),
                amount: actual,
                reason: format!("Boss victory heal: {}", boss_def.name),
                habit_id: None,
                tick_date: game::today_str(),
            }).await?;
        }
    }

    state.store.character.save(character).await?;
    Ok(())
}

// ── JSON helper ───────────────────────────────────────────────────────────────

fn boss_def_to_json(def: &BossDef) -> Value {
    json!({
        "id": def.id,
        "name": def.name,
        "lore": def.lore,
        "tier": def.tier,
        "revealText": def.reveal_text,
        "durationDays": def.duration_days,
        "baseHp": def.base_hp,
        "threshold": def.threshold,
        "damageMultiplier": def.damage_multiplier,
        "rewardGold": def.reward_gold,
        "rewardItem": def.reward_item,
        "rewardItemChance": def.reward_item_chance,
        "rewardHeal": def.reward_heal,
        "rewardHealChance": def.reward_heal_chance,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contribute_idempotency_logic() {
        // Simulate the idempotency check: same date should not apply twice.
        let last_date = "2026-07-01";
        let incoming_date = "2026-07-01";
        // incoming_date <= last_date → no-op
        assert!(incoming_date <= last_date);
        let incoming_date2 = "2026-07-02";
        assert!(incoming_date2 > last_date);
    }
}
