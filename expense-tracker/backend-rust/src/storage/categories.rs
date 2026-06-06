use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use uuid::Uuid;
use crate::models::Category;
use crate::error::AppError;

const DEFAULT_CATEGORIES: &[(&str, &str, &str)] = &[
    ("cat-groceries",    "Groceries",     "#22c55e"),
    ("cat-transport",    "Transport",     "#3b82f6"),
    ("cat-utilities",    "Utilities",     "#f59e0b"),
    ("cat-entertainment","Entertainment", "#8b5cf6"),
    ("cat-dining",       "Dining",        "#ef4444"),
    ("cat-healthcare",   "Healthcare",    "#06b6d4"),
    ("cat-shopping",     "Shopping",      "#ec4899"),
    ("cat-other",        "Other",         "#6b7280"),
];

#[derive(Clone)]
pub struct CategoriesStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<Category>>>,
}

impl CategoriesStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("categories.json");
        fs::create_dir_all(data_dir).await?;

        let categories = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let v: serde_json::Value = serde_json::from_str(&content)?;
            serde_json::from_value(v["categories"].clone())?
        } else {
            let defaults: Vec<Category> = DEFAULT_CATEGORIES.iter()
                .map(|(id, name, color)| Category {
                    id: id.to_string(),
                    name: name.to_string(),
                    color: color.to_string(),
                })
                .collect();
            let content = serde_json::to_string_pretty(&serde_json::json!({ "categories": defaults }))?;
            fs::write(&file_path, content).await?;
            defaults
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(categories)) })
    }

    pub fn get_all(&self) -> Vec<Category> {
        self.cache.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<Category> {
        self.cache.lock().unwrap().iter().find(|c| c.id == id).cloned()
    }

    pub async fn create(&self, name: String, color: String) -> Result<Category, AppError> {
        let cat = {
            let mut cache = self.cache.lock().unwrap();
            if cache.iter().any(|c| c.name.to_lowercase() == name.to_lowercase()) {
                return Err(AppError::Conflict("Category with this name already exists".to_string()));
            }
            let cat = Category {
                id: format!("cat-{}", &Uuid::new_v4().to_string()[..8]),
                name: name.trim().to_string(),
                color: Self::normalize_color(Some(&color)),
            };
            cache.push(cat.clone());
            cat
        }; // MutexGuard dropped here before await
        self.persist().await?;
        Ok(cat)
    }

    pub async fn update(&self, id: &str, name: Option<String>, color: Option<String>) -> Result<Category, AppError> {
        let updated = {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|c| c.id == id)
                .ok_or_else(|| AppError::NotFound("Category not found".to_string()))?;
            if let Some(ref n) = name {
                if cache.iter().enumerate().any(|(i, c)| i != idx && c.name.to_lowercase() == n.to_lowercase()) {
                    return Err(AppError::Conflict("Category with this name already exists".to_string()));
                }
                cache[idx].name = n.trim().to_string();
            }
            if let Some(ref c) = color {
                cache[idx].color = Self::normalize_color(Some(c));
            }
            cache[idx].clone()
        }; // MutexGuard dropped here before await
        self.persist().await?;
        Ok(updated)
    }

    pub async fn delete(&self, id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|c| c.id == id)
                .ok_or_else(|| AppError::NotFound("Category not found".to_string()))?;
            cache.remove(idx);
        } // MutexGuard dropped here before await
        self.persist().await?;
        Ok(())
    }

    async fn persist(&self) -> Result<(), AppError> {
        let cats = { self.cache.lock().unwrap().clone() }; // guard dropped before await
        let content = serde_json::to_string_pretty(&serde_json::json!({ "categories": cats }))
            .map_err(|e| AppError::Storage(e.to_string()))?;
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    /// Normalise hex color: accepts #RGB → #RRGGBB, rejects invalid → default grey.
    pub fn normalize_color(color: Option<&str>) -> String {
        let Some(c) = color else { return "#6b7280".to_string() };
        let re = regex_lite::Regex::new(r"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$").unwrap();
        if !re.is_match(c) { return "#6b7280".to_string() }
        if c.len() == 4 {
            let r = &c[1..2]; let g = &c[2..3]; let b = &c[3..4];
            format!("#{}{}{}{}{}{}", r,r,g,g,b,b).to_lowercase()
        } else {
            c.to_lowercase()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn make_store(dir: &TempDir) -> CategoriesStore {
        CategoriesStore::new(dir.path().to_str().unwrap()).await.unwrap()
    }

    #[tokio::test]
    async fn test_defaults_created_on_first_load() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        let cats = store.get_all();
        assert!(!cats.is_empty(), "defaults should be seeded");
        assert!(cats.iter().any(|c| c.name == "Groceries"));
    }

    #[tokio::test]
    async fn test_create_and_get_category() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        let cat = store.create("Food".to_string(), "#ff0000".to_string()).await.unwrap();
        assert_eq!(cat.name, "Food");
        assert_eq!(cat.color, "#ff0000");
        assert!(store.get_by_id(&cat.id).is_some());
    }

    #[tokio::test]
    async fn test_duplicate_name_rejected() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        store.create("Unique".to_string(), "#aaaaaa".to_string()).await.unwrap();
        let result = store.create("unique".to_string(), "#bbbbbb".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_category() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        let cat = store.create("Old".to_string(), "#111111".to_string()).await.unwrap();
        let updated = store.update(&cat.id, Some("New".to_string()), Some("#222222".to_string())).await.unwrap();
        assert_eq!(updated.name, "New");
        assert_eq!(updated.color, "#222222");
    }

    #[tokio::test]
    async fn test_delete_category() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        let cat = store.create("Temp".to_string(), "#333333".to_string()).await.unwrap();
        store.delete(&cat.id).await.unwrap();
        assert!(store.get_by_id(&cat.id).is_none());
    }

    #[tokio::test]
    async fn test_color_normalisation() {
        assert_eq!(CategoriesStore::normalize_color(Some("#ABC")), "#aabbcc");
        assert_eq!(CategoriesStore::normalize_color(Some("#aabbcc")), "#aabbcc");
        assert_eq!(CategoriesStore::normalize_color(Some("notacolor")), "#6b7280");
        assert_eq!(CategoriesStore::normalize_color(None), "#6b7280");
    }
}
