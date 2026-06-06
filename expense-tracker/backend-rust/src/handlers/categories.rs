use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use crate::error::AppError;
use crate::models::{CreateCategoryRequest, UpdateCategoryRequest, CategoriesResponse};
use super::AppState;

pub async fn list_categories(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<CategoriesResponse>, AppError> {
    super::require_auth(&headers, &state).await?;
    Ok(Json(CategoriesResponse { categories: state.store.categories.get_all() }))
}

pub async fn create_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateCategoryRequest>,
) -> Result<(axum::http::StatusCode, Json<Value>), AppError> {
    super::require_auth(&headers, &state).await?;
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Validation("Category name is required".to_string()));
    }
    let color = body.color.unwrap_or_else(|| "#6b7280".to_string());
    let cat = state.store.categories.create(name, color).await?;
    Ok((axum::http::StatusCode::CREATED, Json(json!(cat))))
}

pub async fn update_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<UpdateCategoryRequest>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let cat = state.store.categories.update(&id, body.name, body.color).await?;
    Ok(Json(json!(cat)))
}

pub async fn delete_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    super::require_auth(&headers, &state).await?;
    let in_use = state.store.years.is_category_used(&id).await?;
    if in_use {
        return Err(AppError::Conflict(
            "Category cannot be deleted because it is used by existing expenses".to_string()
        ));
    }
    state.store.categories.delete(&id).await?;
    Ok(Json(json!({ "success": true, "deleted": id })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::{Request, StatusCode}};
    use axum::Router;
    use tower::ServiceExt;

    async fn test_app() -> Router {
        use tempfile::TempDir;
        use crate::storage::AppStore;
        use crate::auth::AuthManager;

        let temp = TempDir::new().unwrap();
        let path = temp.path().to_path_buf();
        std::mem::forget(temp); // keep temp dir alive for test duration
        let pwd_path = path.join(".expense-admin.pwd");
        std::fs::write(&pwd_path, "testpass").unwrap();

        let store = AppStore::new(path.to_str().unwrap()).await.unwrap();
        let auth = AuthManager::new_with_path(pwd_path).await.unwrap();
        let state = AppState { store, auth };

        Router::new()
            .route("/api/categories", axum::routing::get(list_categories).post(create_category))
            .route("/api/categories/:id", axum::routing::put(update_category).delete(delete_category))
            .with_state(state)
    }

    fn auth_header() -> (&'static str, String) {
        use crate::auth::AuthManager;
        ("x-admin-token", AuthManager::hash_password("testpass"))
    }

    #[tokio::test]
    async fn test_list_categories_requires_auth() {
        let app = test_app().await;
        let resp = app.oneshot(Request::builder()
            .uri("/api/categories").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_list_categories_returns_defaults() {
        let app = test_app().await;
        let (hname, hval) = auth_header();
        let resp = app.oneshot(Request::builder()
            .uri("/api/categories")
            .header(hname, hval)
            .body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json["categories"].as_array().unwrap().len() > 0);
    }
}
