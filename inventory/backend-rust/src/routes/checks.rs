// inventory/backend-rust/src/routes/checks.rs
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post, put},
    Json, Router,
};
use uuid::Uuid;
use std::collections::VecDeque;
use crate::{
    error::AppError,
    models::{CheckEntry, CheckMode, CheckResponse, CreateCheckRequest, ItemForCheck, SubmitCheckRequest, TodoSetItem},
    storage::items::ItemStore,
    AppState,
};
use super::require_auth;

fn check_to_response(
    check: crate::models::Check,
    items: Vec<ItemForCheck>,
) -> CheckResponse {
    CheckResponse {
        id: check.id,
        location_id: check.location_id,
        started_at: check.started_at,
        completed_at: check.completed_at,
        entries: check.entries,
        items,
        todo_set_id: None,
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/checks", get(list).post(create))
        .route("/api/checks/location/:location_id", get(for_location))
        .route("/api/checks/:id", get(get_by_id))
        .route("/api/checks/:id/submit", put(submit))
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<CheckResponse>>, AppError> {
    require_auth(&headers, &state).await?;
    let checks = state.checks.all().await;
    let responses = checks
        .into_iter()
        .map(|c| check_to_response(c, vec![]))
        .collect();
    Ok(Json(responses))
}

async fn get_by_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<CheckResponse>, AppError> {
    require_auth(&headers, &state).await?;
    let check = state
        .checks
        .by_id(&id)
        .await
        .ok_or_else(|| AppError::NotFound(format!("Check not found: {id}")))?;
    Ok(Json(check_to_response(check, vec![])))
}

async fn for_location(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(location_id): Path<String>,
) -> Result<Json<Vec<CheckResponse>>, AppError> {
    require_auth(&headers, &state).await?;
    let checks = state.checks.for_location(&location_id).await;
    let responses = checks
        .into_iter()
        .map(|c| check_to_response(c, vec![]))
        .collect();
    Ok(Json(responses))
}

fn has_children(item_id: &str, all_items: &[crate::models::Item]) -> bool {
    all_items.iter().any(|i| i.parent_id.as_deref() == Some(item_id))
}

fn collect_items_for_check(
    location_id: &str,
    all_items: &[crate::models::Item],
    mode: &CheckMode,
) -> Vec<ItemForCheck> {
    match mode {
        CheckMode::OneLevel => all_items
            .iter()
            .filter(|i| i.parent_id.as_deref() == Some(location_id))
            .map(|i| ItemForCheck {
                id: i.id.clone(),
                name: i.name.clone(),
                required_quantity: i.required_quantity,
                tags: i.tags.clone(),
                path: ItemStore::compute_path(&i.id, all_items),
            })
            .collect(),

        CheckMode::Leaves | CheckMode::FullDepth => {
            let leaves_only = matches!(mode, CheckMode::Leaves);
            let mut result = vec![];
            let mut queue = VecDeque::new();
            queue.push_back(location_id.to_string());
            while let Some(parent_id) = queue.pop_front() {
                for item in all_items {
                    if item.parent_id.as_deref() == Some(&parent_id) {
                        let is_leaf = !has_children(&item.id, all_items);
                        if !leaves_only || is_leaf {
                            result.push(ItemForCheck {
                                id: item.id.clone(),
                                name: item.name.clone(),
                                required_quantity: item.required_quantity,
                                tags: item.tags.clone(),
                                path: ItemStore::compute_path(&item.id, all_items),
                            });
                        }
                        queue.push_back(item.id.clone());
                    }
                }
            }
            result
        }
    }
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateCheckRequest>,
) -> Result<(StatusCode, Json<CheckResponse>), AppError> {
    require_auth(&headers, &state).await?;

    let all_items = state.items.all().await;
    let items_for_check = collect_items_for_check(&body.location_id, &all_items, &body.mode);

    if items_for_check.is_empty() {
        return Err(AppError::Conflict("Location has no items to check".into()));
    }

    let check = state.checks.create(body.location_id).await?;
    let response = check_to_response(check, items_for_check);
    Ok((StatusCode::CREATED, Json(response)))
}

async fn submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<SubmitCheckRequest>,
) -> Result<Json<CheckResponse>, AppError> {
    require_auth(&headers, &state).await?;

    // Fetch items to get required_quantity
    let all_items = state.items.all().await;

    let entries: Vec<CheckEntry> = body
        .entries
        .iter()
        .map(|e| {
            let required = all_items
                .iter()
                .find(|i| i.id == e.item_id)
                .map(|i| i.required_quantity)
                .unwrap_or(1);
            CheckEntry {
                id: Uuid::new_v4().to_string(),
                item_id: e.item_id.clone(),
                actual_quantity: e.actual_quantity,
                required_quantity: required,
            }
        })
        .collect();

    if state.checks.is_complete(&id).await {
        return Err(AppError::Conflict("Check already completed".into()));
    }

    let check = state
        .checks
        .complete(&id, entries)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Check not found: {id}")))?;

    // Create a todo set for all shortfalls
    let shortfall_items: Vec<TodoSetItem> = check.entries.iter()
        .filter(|e| e.actual_quantity < e.required_quantity)
        .map(|e| {
            let item = all_items.iter().find(|i| i.id == e.item_id);
            TodoSetItem {
                id: uuid::Uuid::new_v4().to_string(),
                item_id: e.item_id.clone(),
                item_name: item.map(|i| i.name.clone()).unwrap_or_default(),
                path: ItemStore::parent_path(&e.item_id, &all_items),
                required_quantity: e.required_quantity,
                actual_quantity: e.actual_quantity,
                done: false,
                done_at: None,
            }
        })
        .collect();

    let todo_set_id = if !shortfall_items.is_empty() {
        let location_name = all_items.iter()
            .find(|i| i.id == check.location_id)
            .map(|i| i.name.clone())
            .unwrap_or_else(|| check.location_id.clone());
        let set = state.todo_sets.create(check.id.clone(), location_name, shortfall_items).await?;
        Some(set.id)
    } else {
        None
    };

    let mut response = check_to_response(check, vec![]);
    response.todo_set_id = todo_set_id;
    Ok(Json(response))
}
