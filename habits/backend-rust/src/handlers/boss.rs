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
    ParticipantRequest, Participation, RewardResult,
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

/// Player identity in a boss quest. Uses the character name (set on the
/// Character page) so contributions work across nodes without per-node URL
/// config. Party members should pick distinct names.
pub fn my_name(state: &AppState) -> String {
    state.store.character.get().name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| "Adventurer".to_string())
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

    let name = body.name.trim().to_string();

    // Idempotent
    if hosted.contributions.contains_key(&name) {
        return Ok(Json(json!({ "ok": true })));
    }

    // HP is fixed — joining adds a contributor but does not raise the pool, so
    // every member (even a late one) only speeds the kill.
    hosted.contributions.insert(name, MemberContribution { last_date: "".to_string(), total: 0.0 });

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

    let name = body.name.trim().to_string();
    let today_str = game::today_str();

    // Absolute total (derived on the member's node), set idempotently. HP is
    // always recomputed from the sum of every member's total.
    hosted.record_contribution(name, body.total, today_str.clone(), &today_str);

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

    // Only an unresolved (ongoing) quest blocks; a finished one stays for RECENT.
    if boss.participating.as_ref().map(|p| p.outcome.is_none()).unwrap_or(false) {
        return Err(AppError::Validation("Already in an active quest".to_string()));
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
    let my_name = my_name(&state);
    let today_str = game::today_str();
    let today = game::today();
    let ends_at = (today + chrono::Duration::days(boss_def.duration_days as i64))
        .format("%Y-%m-%d")
        .to_string();
    let quest_id = Uuid::new_v4().to_string();
    // Fixed HP — independent of party size, so partying up only speeds the kill.
    let hp_pool = boss_def.base_hp;

    let mut contributions = std::collections::HashMap::new();
    contributions.insert(my_name.clone(), MemberContribution { last_date: "".to_string(), total: 0.0 });

    let hosted = HostedQuest {
        quest_id: quest_id.clone(),
        boss_id: body.boss_id.clone(),
        host_url: my.clone(), // addressing/display only — identity is the name
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
        is_host: true,
        reward: None,
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

    // Only an unresolved (ongoing) quest blocks; a finished one stays for RECENT.
    if boss.participating.as_ref().map(|p| p.outcome.is_none()).unwrap_or(false) {
        return Err(AppError::Validation("Already in an active quest".to_string()));
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

    let my_name = my_name(&state);

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
        is_host: false,
        reward: None,
    };

    boss.participating = Some(participation);
    state.store.boss.save(boss).await?;

    // Best-effort: register at host (outbox handles retry if this fails)
    if let Ok(client) = make_client() {
        let part_url = habits_url(&host_url, "/api/boss/participants");
        let _ = client.post(&part_url).json(&json!({ "name": my_name })).send().await;
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

    // Resolve the participation as abandoned but KEEP it, so it shows in RECENT.
    // Outcome guards stop it counting as active (no boss damage/wear, doesn't
    // block a new launch/join). The host's hosted quest is intentionally left
    // active so the rest of the party can still finish it.
    match boss.participating.as_mut() {
        Some(p) if p.outcome.is_none() => {
            p.outcome = Some("abandoned".to_string());
            p.resolved_at = Some(game::today_str());
        }
        _ => return Ok(Json(json!({ "ok": true }))),
    }

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

    // ── 1. Recompute + publish our derived damage (today's work included) ─────
    // Keeps the boss live when the player is on the Boss tab without hitting the
    // character endpoint. Reload afterwards since it mutates the stored state.
    crate::handlers::character::sync_boss_contribution(&state, game::today()).await;
    let mut boss = state.store.boss.get();

    // ── 2. Resolve end state ──────────────────────────────────────────────────
    // The host is authoritative for its own quest — mirror `hosted` rather than
    // self-polling localhost (which isn't reachable in the bundle). Non-hosts
    // poll the remote host for fresh state.
    let hosted_snapshot = boss.hosted.clone();
    if let Some(ref mut p) = boss.participating {
        if p.outcome.is_none() {
            let host_url = p.host_url.clone();
            let boss_id = p.boss_id.clone();
            let ends_at = p.ends_at.clone();

            if p.is_host {
                p.cached_state = hosted_snapshot.or(p.cached_state.clone());
            } else {
                let active_url = habits_url(&host_url, "/api/boss/active");
                if let Ok(resp) = client.get(&active_url).send().await {
                    if let Ok(hq) = resp.json::<Option<HostedQuest>>().await {
                        p.cached_state = hq.clone().or(p.cached_state.clone());
                    }
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
                        if let Ok(result) = grant_victory_reward(&state, &boss_def).await {
                            p.reward = Some(result);
                        }
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
                        let host_name = member.cached_public.as_ref()
                            .and_then(|pc| pc.name.clone())
                            .unwrap_or_else(|| member.url.trim_end_matches('/')
                                .replace("https://", "").replace("http://", ""));
                        invitations.push(json!({
                            "hostUrl": member.url,
                            "hostName": host_name,
                            "boss": boss_def.as_ref().map(|d| boss_def_to_json(d, &state.catalogue)),
                            "quest": { "hpRemaining": hq.hp_remaining, "hpPool": hq.hp_pool },
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

            let my_name = my_name(&state);
            let my_contribution = quest
                .and_then(|q| q.contributions.get(&my_name))
                .map(|c| c.total)
                .unwrap_or(0.0);
            // The boss lags a day: today's habits aren't final until tomorrow, so
            // we report the last fully-scored day rather than a same-day flag.
            let my_contributed_through = p.last_contributed_date.clone();

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

            // Gear stat totals and their boss effects, so the player can see why
            // gear matters (armor mitigates the multiplier, damage boosts dealt).
            let (gear_damage, gear_armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), id| {
                state.catalogue.iter().find(|i| &i.id == id)
                    .map(|i| (d + i.damage, a + i.armor))
                    .unwrap_or((d, a))
            });
            let base_mult = boss_def.as_ref().map(|b| b.damage_multiplier).unwrap_or(1.0);
            let eff_mult = game::boss_effective_multiplier(base_mult, gear_armor);
            let damage_bonus = game::boss_damage_gear_bonus(gear_damage);

            // Leaderboard — contributions are keyed by player name directly.
            let leaderboard: Vec<Value> = quest.map(|q| {
                let mut entries: Vec<_> = q.contributions.iter()
                    .map(|(name, c)| (name.clone(), c.total))
                    .collect();
                entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
                entries.into_iter().map(|(name, total)| {
                    let is_me = name == my_name;
                    json!({ "name": name, "total": total, "isMe": is_me })
                }).collect()
            }).unwrap_or_default();

            Some(json!({
                "boss": boss_def.as_ref().map(|d| boss_def_to_json(d, &state.catalogue)),
                "quest": quest,
                "myContribution": my_contribution,
                "myContributedThrough": my_contributed_through,
                "gear": gear,
                "armor": gear_armor,
                "damage": gear_damage,
                "effMultiplier": eff_mult,
                "damageBonus": damage_bonus,
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
            // Reward with the item id resolved to a display name.
            let reward = p.reward.as_ref().map(|r| {
                let item_name = r.item.as_ref()
                    .and_then(|id| state.catalogue.iter().find(|i| &i.id == id))
                    .map(|i| i.name.clone());
                json!({ "gold": r.gold, "item": item_name, "heal": r.heal })
            });
            // Final fight state for the detail view (leaderboard, HP felled).
            let my_name = my_name(&state);
            let quest = p.cached_state.as_ref();
            let leaderboard: Vec<Value> = quest.map(|q| {
                let mut entries: Vec<_> = q.contributions.iter()
                    .map(|(name, c)| (name.clone(), c.total)).collect();
                entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
                entries.into_iter().map(|(name, total)| {
                    let is_me = name == my_name;
                    json!({ "name": name, "total": total, "isMe": is_me })
                }).collect()
            }).unwrap_or_default();
            let my_contribution = quest
                .and_then(|q| q.contributions.get(&my_name))
                .map(|c| c.total).unwrap_or(0.0);
            let quest_json = quest.map(|q| json!({
                "hpPool": q.hp_pool, "hpRemaining": q.hp_remaining,
                "endsAt": q.ends_at, "durationDays": q.duration_days,
            }));
            vec![json!({
                "questId": p.quest_id,
                "boss": boss_def.as_ref().map(|d| boss_def_to_json(d, &state.catalogue)),
                "outcome": p.outcome,
                "brokenGear": broken_names,
                "resolvedAt": p.resolved_at,
                "reward": reward,
                "quest": quest_json,
                "leaderboard": leaderboard,
                "myContribution": my_contribution,
            })]
        })
        .unwrap_or_default();

    // ── 6. Revealed bosses ────────────────────────────────────────────────────
    let revealed: Vec<Value> = boss.revealed.iter().filter_map(|r| {
        boss_cat::find(&r.boss_id).map(|def| {
            let mut v = boss_def_to_json(&def, &state.catalogue);
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

async fn grant_victory_reward(state: &AppState, boss_def: &BossDef) -> Result<RewardResult, AppError> {
    let mut character = state.store.character.get();
    let mut dropped_item: Option<String> = None;
    let mut healed = 0.0;

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
            dropped_item = Some(item_id.to_string());
        }
    }

    // Sometimes: heal
    if rand::random::<f64>() < boss_def.reward_heal_chance {
        let old_hp = character.hp;
        character.hp = (character.hp + boss_def.reward_heal).min(state.config.max_hp);
        let actual = character.hp - old_hp;
        if actual > 0.0 {
            healed = actual;
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
    Ok(RewardResult { gold: boss_def.reward_gold, item: dropped_item, heal: healed })
}

// ── JSON helper ───────────────────────────────────────────────────────────────

fn boss_def_to_json(def: &BossDef, catalogue: &[crate::models::Item]) -> Value {
    let reward_item_name = def.reward_item
        .and_then(|id| catalogue.iter().find(|i| i.id == id))
        .map(|i| i.name.clone());
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
        // Solo damage tops out at duration × ~0.96; only lesser bosses sit below
        // their HP, so this mirrors the difficulty-gating invariant.
        "soloable": def.tier == "lesser",
        "rewardGold": def.reward_gold,
        "rewardItem": def.reward_item,
        "rewardItemName": reward_item_name,
        "rewardItemChance": def.reward_item_chance,
        "rewardHeal": def.reward_heal,
        "rewardHealChance": def.reward_heal_chance,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    fn hosted(pool: f64, ends_at: &str) -> crate::models::HostedQuest {
        crate::models::HostedQuest {
            quest_id: "q".into(), boss_id: "b".into(), host_url: "".into(),
            started_at: "2026-07-01".into(), duration_days: 5, ends_at: ends_at.into(),
            hp_pool: pool, hp_remaining: pool,
            contributions: HashMap::new(), status: "active".into(), ended_at: None,
        }
    }

    // HP is always pool − Σ member totals. Because totals are absolute (set, not
    // accumulated), re-publishing the same total is idempotent and a larger
    // total only lowers HP further. The quest ends on kill or time-out.
    #[test]
    fn record_contribution_reconciles_hp_and_resolves() {
        let mut q = hosted(2.3, "2026-07-06");

        q.record_contribution("a".into(), 1.0, "2026-07-02".into(), "2026-07-02");
        let hp1 = q.hp_remaining;

        q.record_contribution("a".into(), 1.0, "2026-07-02".into(), "2026-07-02"); // idempotent
        assert_eq!(hp1, q.hp_remaining, "re-publishing the same total must be idempotent");

        q.record_contribution("a".into(), 1.5, "2026-07-02".into(), "2026-07-02");
        q.record_contribution("b".into(), 0.5, "2026-07-02".into(), "2026-07-02");
        assert!((q.hp_remaining - 0.3).abs() < 1e-9);
        assert!(q.hp_remaining < hp1, "more damage → less HP");
        assert_eq!(q.status, "active", "still alive above 0 HP before the deadline");

        // Kill: total ≥ pool → ended.
        q.record_contribution("b".into(), 1.3, "2026-07-03".into(), "2026-07-03");
        assert!(q.hp_remaining <= 0.0);
        assert_eq!(q.status, "ended");
        assert_eq!(q.ended_at.as_deref(), Some("2026-07-03"));

        // Time-out: alive but past ends_at → ended.
        let mut q2 = hosted(100.0, "2026-07-06");
        q2.record_contribution("a".into(), 1.0, "2026-07-06".into(), "2026-07-06");
        assert!(q2.hp_remaining > 0.0);
        assert_eq!(q2.status, "ended", "reaching ends_at resolves the quest even with HP left");
    }
}
