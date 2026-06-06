use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::{
    CreateYearRequest, UpdateIncomeRequest,
    CreateExpenseRequest, UpdateExpenseRequest,
    Expense, MonthResponse, CategoryBreakdown,
};
use super::AppState;

pub async fn list_years(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let years = state.store.years.list_year_summaries().await?;
    Ok(Json(json!({ "years": years })))
}

pub async fn create_year(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateYearRequest>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::require_auth(&headers, &state).await?;
    let data = state.store.years.create_year(body.year).await?;
    Ok((StatusCode::CREATED, Json(json!(data))))
}

pub async fn get_year(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(year): Path<u32>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let data = state.store.years.get_year(year).await?;
    Ok(Json(json!(data)))
}

pub async fn get_month(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((year, month)): Path<(u32, u8)>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let m = state.store.years.get_month(year, month).await?;
    let total_expenses: f64 = m.expenses.iter().map(|e| e.amount).sum();
    let remainder = m.income - total_expenses;
    Ok(Json(json!(MonthResponse {
        month: m.month, year: m.year, income: m.income,
        expenses: m.expenses, remainder, total_expenses,
    })))
}

pub async fn update_income(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((year, month)): Path<(u32, u8)>,
    Json(body): Json<UpdateIncomeRequest>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let m = state.store.years.update_income(year, month, body.income).await?;
    let total_expenses: f64 = m.expenses.iter().map(|e| e.amount).sum();
    let remainder = m.income - total_expenses;
    Ok(Json(json!(MonthResponse {
        month: m.month, year: m.year, income: m.income,
        expenses: m.expenses, remainder, total_expenses,
    })))
}

pub async fn create_expense(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((year, month)): Path<(u32, u8)>,
    Json(body): Json<CreateExpenseRequest>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    super::require_auth(&headers, &state).await?;
    if body.day > 31 {
        return Err(AppError::Validation("Day must be between 1 and 31".to_string()));
    }
    if state.store.categories.get_by_id(&body.category_id).is_none() {
        return Err(AppError::Validation("Invalid category ID".to_string()));
    }
    let expense = state.store.years.add_expense(year, month, Expense {
        id: String::new(),
        day: body.day,
        category_id: body.category_id,
        description: body.description.unwrap_or_default(),
        amount: body.amount,
    }).await?;
    Ok((StatusCode::CREATED, Json(json!(expense))))
}

pub async fn update_expense(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((year, month, expense_id)): Path<(u32, u8, String)>,
    Json(body): Json<UpdateExpenseRequest>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    if let Some(day) = body.day {
        if day > 31 {
            return Err(AppError::Validation("Day must be between 1 and 31".to_string()));
        }
    }
    if let Some(ref cid) = body.category_id {
        if state.store.categories.get_by_id(cid).is_none() {
            return Err(AppError::Validation("Invalid category ID".to_string()));
        }
    }
    let expense = state.store.years.update_expense(
        year, month, &expense_id,
        body.day, body.category_id, body.description, body.amount,
    ).await?;
    Ok(Json(json!(expense)))
}

pub async fn delete_expense(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((year, month, expense_id)): Path<(u32, u8, String)>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    state.store.years.remove_expense(year, month, &expense_id).await?;
    Ok(Json(json!({ "deleted": expense_id })))
}

pub async fn expenses_by_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((year, month)): Path<(u32, u8)>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let m = state.store.years.get_month(year, month).await?;
    let mut map: std::collections::HashMap<String, CategoryBreakdown> = std::collections::HashMap::new();
    for expense in &m.expenses {
        let cat = state.store.categories.get_by_id(&expense.category_id);
        let entry = map.entry(expense.category_id.clone()).or_insert_with(|| CategoryBreakdown {
            category_id: expense.category_id.clone(),
            category_name: cat.as_ref().map(|c| c.name.clone()).unwrap_or_else(|| "Unknown".to_string()),
            color: cat.as_ref().map(|c| c.color.clone()).unwrap_or_else(|| "#6b7280".to_string()),
            total: 0.0,
            count: 0,
        });
        entry.total += expense.amount;
        entry.count += 1;
    }
    let mut breakdown: Vec<CategoryBreakdown> = map.into_values().collect();
    breakdown.sort_by(|a, b| b.total.partial_cmp(&a.total).unwrap_or(std::cmp::Ordering::Equal));
    Ok(Json(json!({ "breakdown": breakdown })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::{Request, StatusCode}, Router};
    use tower::ServiceExt;

    async fn test_app() -> Router {
        use tempfile::TempDir;
        use crate::{storage::AppStore, auth::AuthManager};

        let temp = TempDir::new().unwrap();
        let path = temp.path().to_path_buf();
        std::mem::forget(temp);
        let pwd_path = path.join(".expense-admin.pwd");
        std::fs::write(&pwd_path, "testpass").unwrap();

        let store = AppStore::new(path.to_str().unwrap()).await.unwrap();
        let auth = AuthManager::new_with_path(pwd_path).await.unwrap();
        let state = AppState { store, auth };

        Router::new()
            .route("/api/years", axum::routing::get(list_years).post(create_year))
            .route("/api/years/:year", axum::routing::get(get_year))
            .route("/api/years/:year/months/:month", axum::routing::get(get_month))
            .route("/api/years/:year/months/:month/income", axum::routing::put(update_income))
            .route("/api/years/:year/months/:month/expenses", axum::routing::post(create_expense))
            .route("/api/years/:year/months/:month/expenses/by-category", axum::routing::get(expenses_by_category))
            .route("/api/years/:year/months/:month/expenses/:expense_id", axum::routing::put(update_expense).delete(delete_expense))
            .with_state(state)
    }

    fn token() -> String { crate::auth::AuthManager::hash_password("testpass") }

    #[tokio::test]
    async fn test_list_years_empty() {
        let app = test_app().await;
        let resp = app.oneshot(Request::builder()
            .uri("/api/years")
            .header("x-admin-token", token())
            .body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_create_and_get_year() {
        let app = test_app().await;
        let body = serde_json::json!({ "year": 2026 }).to_string();
        let resp = app.clone().oneshot(Request::builder()
            .method("POST").uri("/api/years")
            .header("x-admin-token", token())
            .header("content-type", "application/json")
            .body(Body::from(body)).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);

        let resp = app.oneshot(Request::builder()
            .uri("/api/years/2026")
            .header("x-admin-token", token())
            .body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["year"], 2026);
        assert_eq!(json["months"].as_array().unwrap().len(), 12);
    }

    #[tokio::test]
    async fn test_add_and_delete_expense() {
        let app = test_app().await;
        let body = serde_json::json!({
            "day": 5, "categoryId": "cat-groceries",
            "description": "Bread", "amount": 25.50
        }).to_string();

        let resp = app.clone().oneshot(Request::builder()
            .method("POST").uri("/api/years/2026/months/3/expenses")
            .header("x-admin-token", token())
            .header("content-type", "application/json")
            .body(Body::from(body)).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);

        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let expense: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let id = expense["id"].as_str().unwrap().to_string();

        let resp = app.oneshot(Request::builder()
            .method("DELETE")
            .uri(format!("/api/years/2026/months/3/expenses/{}", id))
            .header("x-admin-token", token())
            .body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }
}
