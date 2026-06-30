use axum::{extract::State, http::HeaderMap, Json};
use chrono::NaiveDate;
use uuid::Uuid;
use std::collections::HashMap;
use std::time::Duration;
use serde::Deserialize;
use reqwest::Client;

use crate::error::AppError;
use crate::models::{Character, CharacterResponse, CheckinHabit, Completion, DailyContribution, GoldEvent, HealthEvent, HostedQuest, Importance, MemberContribution};
use crate::game::{self, SYSTEM_HABIT_ID};
use crate::tick::{TickInput, process_tick};
use super::AppState;

/// Sum equipped items' (damage, armor) from the catalogue. Used to feed boss
/// gear bonuses into the tick.
fn equipped_totals(state: &AppState) -> (u32, u32) {
    let eq = state.store.equipment.get();
    eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        state.catalogue.iter().find(|i| &i.id == item_id)
            .map(|i| (d + i.damage, a + i.armor))
            .unwrap_or((d, a))
    })
}

/// Compute boss tick parameters for a given day.
/// Returns (boss_active, damage_multiplier, wear_per_day).
fn boss_tick_params(
    participating: &Option<crate::models::Participation>,
    day: NaiveDate,
) -> (bool, f64, u32) {
    let Some(p) = participating else { return (false, 1.0, 0); };
    let started = game::parse_iso_date(&p.started_at).unwrap_or(day);
    let ends   = game::parse_iso_date(&p.ends_at).unwrap_or(day);
    if day < started || day >= ends {
        return (false, 1.0, 0);
    }
    let def = crate::bosses_catalogue::find(&p.boss_id);
    let multiplier = def.as_ref().map(|b| b.damage_multiplier).unwrap_or(1.0);
    let wear = def.as_ref().map(|b| b.wear_per_day).unwrap_or(1);
    (true, multiplier, wear)
}

/// Apply gear wear from a boss-day and submit/queue the daily contribution.
/// Best-effort: errors are swallowed so they don't interrupt the character tick.
async fn apply_boss_outputs(
    state: &AppState,
    gear_wear: u32,
    contribution: Option<DailyContribution>,
) {
    if gear_wear > 0 {
        let eq = state.store.equipment.get();
        let (new_eq, broken) = game::apply_wear(&eq, gear_wear, &state.catalogue);
        let _ = state.store.equipment.save(new_eq).await;
        if !broken.is_empty() {
            let mut bs = state.store.boss.get();
            if let Some(ref mut p) = bs.participating {
                p.broken_gear.extend(broken);
            }
            let _ = state.store.boss.save(bs).await;
        }
    }

    let Some(contrib) = contribution else { return; };
    let mut bs = state.store.boss.get();
    let Some(ref p) = bs.participating.clone() else { return; };

    // Idempotency: skip if already contributed for this date.
    if !p.last_contributed_date.is_empty() && contrib.date <= p.last_contributed_date {
        return;
    }

    let my_url = std::env::var("MY_URL")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    if p.host_url == my_url {
        // Self-hosted: apply directly to hosted quest.
        if let Some(ref mut hosted) = bs.hosted {
            let today_str = game::today_str();
            let entry = hosted.contributions
                .entry(my_url.clone())
                .or_insert(MemberContribution { last_date: String::new(), total: 0.0 });
            if contrib.date > entry.last_date {
                hosted.hp_remaining -= contrib.p;
                entry.total += contrib.p;
                entry.last_date = contrib.date.clone();
            }
            if hosted.hp_remaining <= 0.0 && hosted.status == "active" {
                hosted.status = "ended".to_string();
                hosted.ended_at = Some(today_str);
            }
        }
        if let Some(ref mut part) = bs.participating {
            part.last_contributed_date = contrib.date.clone();
        }
        let _ = state.store.boss.save(bs).await;
    } else {
        // POST to host.
        let host_contribute_url = format!(
            "{}/habits/api/boss/contribute",
            p.host_url.trim_end_matches('/')
        );
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap_or_else(|_| Client::new());
        let payload = serde_json::json!({
            "url": my_url,
            "date": contrib.date,
            "p": contrib.p,
        });
        let ok = client.post(&host_contribute_url)
            .json(&payload)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        if ok {
            if let Some(ref mut part) = bs.participating {
                part.last_contributed_date = contrib.date.clone();
                part.outbox.retain(|o| o.date != contrib.date);
            }
        } else {
            // Queue for retry.
            if let Some(ref mut part) = bs.participating {
                if !part.outbox.iter().any(|o| o.date == contrib.date) {
                    part.outbox.push(contrib);
                }
            }
        }
        let _ = state.store.boss.save(bs).await;
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckinRequest {
    pub completed_ids: Vec<String>,
}

pub async fn get_character(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<CharacterResponse>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today = game::today();
    let today_str = game::today_str();

    // ── Step 1: Auto-complete the system habit for today ──────────────────────
    let sys_completions = state.store.completions.get_for_habit(SYSTEM_HABIT_ID);
    let already_done = sys_completions
        .iter()
        .any(|c| c.completed_at.get(..10).unwrap_or("") == today_str);

    if !already_done {
        let completion = Completion {
            id: Uuid::new_v4().to_string(),
            habit_id: SYSTEM_HABIT_ID.to_string(),
            completed_at: chrono::Utc::now().to_rfc3339(),
        };
        state.store.completions.append(completion).await?;

        // Award completion gold: use today+1 as as_of so today's completion counts
        // toward the 7-day established check (same as complete_habit does).
        let gold_earned = game::completion_gold(
            &state.config,
            &Importance::Low,
            &sys_completions,
            today + chrono::Duration::days(1),
        );
        let gold_event = GoldEvent {
            id: Uuid::new_v4().to_string(),
            event_type: "completion_bonus".to_string(),
            amount: gold_earned,
            reason: "Open the app".to_string(),
            habit_id: Some(SYSTEM_HABIT_ID.to_string()),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        state.store.events.append_gold(gold_event).await?;

        let mut character = state.store.character.get();
        character.gold = game::apply_gold_delta(character.gold, gold_earned);
        state.store.character.save(character).await?;

        // Advance system habit deadline to tomorrow.
        let next_day = (today + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        state.store.deadlines.set(SYSTEM_HABIT_ID, &next_day).await?;
    }

    // ── Step 2: Catch up ticks through yesterday (stop before today) ────────────
    // Today's tick is held until the morning check-in is confirmed.
    let character = state.store.character.get();
    let last_tick: NaiveDate = NaiveDate::parse_from_str(&character.last_tick_date, "%Y-%m-%d")
        .unwrap_or(today);

    if last_tick < today {
        let all_habits = state.store.habits.get_all();
        let active_habits: Vec<_> = all_habits.iter().filter(|h| h.active && !h.inscribed).cloned().collect();
        let all_completions = state.store.completions.get_all();

        // Ensure initial deadlines exist for every active habit.
        for habit in &active_habits {
            if state.store.deadlines.get(&habit.id).is_none() {
                let created_date = game::parse_iso_date(&habit.created_at).unwrap_or(today);
                let initial_deadline = if habit.frequency == "windowed" {
                    created_date + chrono::Duration::days(habit.window_days as i64)
                } else {
                    created_date
                };
                state.store.deadlines.set(
                    &habit.id,
                    &initial_deadline.format("%Y-%m-%d").to_string(),
                ).await?;
            }
        }

        let mut current_character = state.store.character.get();
        let mut day = last_tick + chrono::Duration::days(1);

        let boss_state = state.store.boss.get();
        let participating = boss_state.participating.clone();

        // Stop strictly before today — today's tick waits for check-in.
        while day < today {
            let raw_deadlines = state.store.deadlines.get_all();
            let deadlines: HashMap<String, NaiveDate> = raw_deadlines
                .iter()
                .filter_map(|(k, v)| {
                    NaiveDate::parse_from_str(v, "%Y-%m-%d").ok().map(|d| (k.clone(), d))
                })
                .collect();

            let (boss_active, boss_mult, boss_wear) = boss_tick_params(&participating, day);
            let (gear_damage, gear_armor) = equipped_totals(&state);
            let input = TickInput {
                date: day,
                habits: active_habits.clone(),
                deadlines,
                completions: all_completions.clone(),
                current_hp: current_character.hp,
                current_gold: current_character.gold,
                current_renown: current_character.renown,
                config: state.config.clone(),
                boss_active,
                boss_damage_multiplier: boss_mult,
                boss_wear_per_day: boss_wear,
                boss_armor: gear_armor,
                boss_damage: gear_damage,
            };

            let output = process_tick(input);

            for ev in output.health_events {
                state.store.events.append_health(ev).await?;
            }
            for ev in output.gold_events {
                state.store.events.append_gold(ev).await?;
            }
            for update in output.deadline_updates {
                state.store.deadlines.set(
                    &update.habit_id,
                    &update.new_deadline.format("%Y-%m-%d").to_string(),
                ).await?;
            }
            for update in output.habit_health_updates {
                state.store.habits.update_health_removed(&update.habit_id, update.new_health_removed).await?;
            }

            current_character.hp = output.new_hp;
            current_character.gold = output.new_gold;
            current_character.renown = output.new_renown;
            current_character.last_tick_date = day.format("%Y-%m-%d").to_string();
            apply_boss_outputs(&state, output.gear_wear, output.boss_contribution).await;
            day += chrono::Duration::days(1);
        }

        state.store.character.save(current_character).await?;

        // Retry any queued boss contributions that failed during earlier ticks.
        {
            let bs = state.store.boss.get();
            let pending: Vec<DailyContribution> = bs.participating.as_ref()
                .map(|p| p.outbox.clone())
                .unwrap_or_default();
            for contrib in pending {
                apply_boss_outputs(&state, 0, Some(contrib)).await;
            }
        }
    }

    // ── Step 3: Check if today's tick is pending and needs check-in ─────────────
    let character = state.store.character.get();
    let last_tick_now: NaiveDate = NaiveDate::parse_from_str(&character.last_tick_date, "%Y-%m-%d")
        .unwrap_or(today);

    if last_tick_now < today {
        // Today's tick hasn't run yet. Find habits due yesterday with no completion.
        let yesterday = today - chrono::Duration::days(1);
        let yesterday_str = yesterday.format("%Y-%m-%d").to_string();
        let raw_deadlines = state.store.deadlines.get_all();
        let all_habits = state.store.habits.get_all();
        let all_completions = state.store.completions.get_all();

        let pending: Vec<CheckinHabit> = all_habits.iter()
            .filter(|h| h.active && !h.inscribed && h.id != SYSTEM_HABIT_ID)
            .filter(|h| raw_deadlines.get(&h.id).map(|d| d == &yesterday_str).unwrap_or(false))
            .filter(|h| !all_completions.iter().any(|c| {
                c.habit_id == h.id && c.completed_at.get(..10).unwrap_or("") == yesterday_str
            }))
            .map(|h| CheckinHabit {
                id: h.id.clone(),
                name: h.name.clone(),
                importance: h.importance.clone(),
                notes: h.notes.clone(),
            })
            .collect();

        if !pending.is_empty() {
            // Return the character data as-is with the pending list.
            // Today's tick (and damage) will run after the check-in is submitted.
            let eq = state.store.equipment.get();
            let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
                if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
                    (d + item.damage, a + item.armor)
                } else { (d, a) }
            });
            return Ok(Json(CharacterResponse {
                hp: character.hp,
                gold: character.gold,
                last_tick_date: character.last_tick_date.clone(),
                damage,
                armor,
                renown: character.renown,
                name: character.name.clone(),
                pending_checkin: Some(pending),
            }));
        }

        // No pending habits — run today's tick immediately.
        run_today_tick(&state, today).await?;
    }

    let character = state.store.character.get();

    // Compute damage/armor totals from equipped items.
    let eq = state.store.equipment.get();
    let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
            (d + item.damage, a + item.armor)
        } else {
            (d, a)
        }
    });

    Ok(Json(CharacterResponse {
        hp: character.hp,
        gold: character.gold,
        last_tick_date: character.last_tick_date,
        damage,
        armor,
        renown: character.renown,
        name: character.name.clone(),
        pending_checkin: None,
    }))
}

// ── Shared tick helper ────────────────────────────────────────────────────────

async fn run_today_tick(state: &AppState, today: NaiveDate) -> Result<(), AppError> {
    let all_habits = state.store.habits.get_all();
    let active_habits: Vec<_> = all_habits.iter().filter(|h| h.active && !h.inscribed).cloned().collect();
    let all_completions = state.store.completions.get_all();
    let raw_deadlines = state.store.deadlines.get_all();
    let deadlines: HashMap<String, NaiveDate> = raw_deadlines.iter()
        .filter_map(|(k, v)| NaiveDate::parse_from_str(v, "%Y-%m-%d").ok().map(|d| (k.clone(), d)))
        .collect();

    let boss_state = state.store.boss.get();
    let participating = boss_state.participating.clone();
    let (boss_active, boss_mult, boss_wear) = boss_tick_params(&participating, today);
    let (gear_damage, gear_armor) = equipped_totals(&state);

    let mut current_character = state.store.character.get();
    let input = TickInput {
        date: today,
        habits: active_habits,
        deadlines,
        completions: all_completions,
        current_hp: current_character.hp,
        current_gold: current_character.gold,
        current_renown: current_character.renown,
        config: state.config.clone(),
        boss_active,
        boss_damage_multiplier: boss_mult,
        boss_wear_per_day: boss_wear,
        boss_armor: gear_armor,
        boss_damage: gear_damage,
    };
    let output = process_tick(input);

    for ev in output.health_events { state.store.events.append_health(ev).await?; }
    for ev in output.gold_events { state.store.events.append_gold(ev).await?; }
    for update in output.deadline_updates {
        state.store.deadlines.set(
            &update.habit_id,
            &update.new_deadline.format("%Y-%m-%d").to_string(),
        ).await?;
    }
    for update in output.habit_health_updates {
        state.store.habits.update_health_removed(&update.habit_id, update.new_health_removed).await?;
    }

    current_character.hp = output.new_hp;
    current_character.gold = output.new_gold;
    current_character.renown = output.new_renown;
    current_character.last_tick_date = today.format("%Y-%m-%d").to_string();
    apply_boss_outputs(state, output.gear_wear, output.boss_contribution).await;
    state.store.character.save(current_character).await?;
    Ok(())
}

// ── POST /api/character/checkin ───────────────────────────────────────────────

pub async fn checkin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CheckinRequest>,
) -> Result<Json<CharacterResponse>, AppError> {
    super::require_auth(&headers, &state).await?;

    let today = game::today();
    let yesterday = today - chrono::Duration::days(1);
    let yesterday_iso = format!("{}T12:00:00Z", yesterday.format("%Y-%m-%d"));

    // Record completions for yesterday for each confirmed habit.
    for id in &body.completed_ids {
        let exists = state.store.completions.get_for_habit(id).iter().any(|c| {
            c.completed_at.get(..10).unwrap_or("") == &yesterday.format("%Y-%m-%d").to_string()
        });
        if !exists {
            let completion = Completion {
                id: Uuid::new_v4().to_string(),
                habit_id: id.clone(),
                completed_at: yesterday_iso.clone(),
            };
            state.store.completions.append(completion).await?;
            // Advance the deadline: yesterday + window_days.
            if let Some(habit) = state.store.habits.get_all().iter().find(|h| &h.id == id).cloned() {
                let new_deadline = yesterday + chrono::Duration::days(habit.window_days as i64);
                state.store.deadlines.set(id, &new_deadline.format("%Y-%m-%d").to_string()).await?;
            }
        }
    }

    // Now run today's tick with the confirmed completions in place.
    run_today_tick(&state, today).await?;

    let character = state.store.character.get();
    let eq = state.store.equipment.get();
    let (damage, armor) = eq.equipped.values().fold((0u32, 0u32), |(d, a), item_id| {
        if let Some(item) = state.catalogue.iter().find(|i| &i.id == item_id) {
            (d + item.damage, a + item.armor)
        } else { (d, a) }
    });

    Ok(Json(CharacterResponse {
        hp: character.hp,
        gold: character.gold,
        last_tick_date: character.last_tick_date,
        damage,
        armor,
        renown: character.renown,
        name: character.name.clone(),
        pending_checkin: None,
    }))
}

// ── POST /api/character/pay-ferryman ─────────────────────────────────────────

pub async fn pay_ferryman(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Character>, AppError> {
    super::require_auth(&headers, &state).await?;

    let mut character = state.store.character.get();

    if character.hp > 0.0 {
        return Err(AppError::Validation("Not forsaken".to_string()));
    }

    let cost = (character.gold / 2.0).floor();
    character.gold = game::apply_gold_delta(character.gold, -cost);
    character.hp = 25.0;

    let gold_event = GoldEvent {
        id: Uuid::new_v4().to_string(),
        event_type: "ferryman".to_string(),
        amount: -cost,
        reason: "Pay the Ferryman".to_string(),
        habit_id: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    state.store.events.append_gold(gold_event).await?;
    state.store.character.save(character.clone()).await?;

    Ok(Json(character))
}
