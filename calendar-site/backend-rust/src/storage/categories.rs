// calendar-site/backend-rust/src/storage/categories.rs
use std::{path::PathBuf, sync::Arc};
use tokio::{fs, sync::Mutex};
use serde_json::json;
use crate::{error::AppError, models::{Category, CreateCategoryRequest, UpdateCategoryRequest}};

const DEFAULTS: &[(&str, &str, &str)] = &[
    ("cat-work",     "Work",     "#3b82f6"),
    ("cat-personal", "Personal", "#22c55e"),
    ("cat-health",   "Health",   "#ef4444"),
    ("cat-social",   "Social",   "#8b5cf6"),
    ("cat-travel",   "Travel",   "#f59e0b"),
    ("cat-other",    "Other",    "#6b7280"),
];

#[derive(Clone)]
pub struct CategoryStore {
    path: PathBuf,
    cache: Arc<Mutex<Vec<Category>>>,
}

impl CategoryStore {
    pub async fn new(data_path: &str) -> Result<Self, AppError> {
        let path = PathBuf::from(data_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await
                .map_err(|e| AppError::Storage(e.to_string()))?;
        }
        let cats = if path.exists() {
            Self::load(&path).await?
        } else {
            let defaults: Vec<Category> = DEFAULTS.iter().map(|(id, name, color)| Category {
                id: id.to_string(), name: name.to_string(),
                color: color.to_string(), is_non_working: false,
            }).collect();
            Self::write_file(&path, &defaults).await?;
            defaults
        };
        Ok(Self { path, cache: Arc::new(Mutex::new(cats)) })
    }

    async fn load(path: &PathBuf) -> Result<Vec<Category>, AppError> {
        let content = fs::read_to_string(path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        let v: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| AppError::Storage(e.to_string()))?;
        serde_json::from_value(v["categories"].clone())
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    async fn write_file(path: &PathBuf, cats: &[Category]) -> Result<(), AppError> {
        let content = serde_json::to_string_pretty(&json!({ "categories": cats })).unwrap();
        fs::write(path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    async fn flush(&self) -> Result<(), AppError> {
        let cats = self.cache.lock().await.clone();
        Self::write_file(&self.path, &cats).await
    }

    pub async fn all(&self) -> Vec<Category> {
        self.cache.lock().await.clone()
    }

    pub async fn create(&self, req: CreateCategoryRequest) -> Result<Category, AppError> {
        let mut cache = self.cache.lock().await;
        let lname = req.name.to_lowercase();
        if cache.iter().any(|c| c.name.to_lowercase() == lname) {
            return Err(AppError::Validation("Category with this name already exists".into()));
        }
        let short_id = uuid::Uuid::new_v4().to_string().split('-').next().unwrap().to_string();
        let cat = Category {
            id: format!("cat-{short_id}"),
            name: req.name.trim().to_string(),
            color: req.color.unwrap_or_else(|| "#6b7280".to_string()),
            is_non_working: req.is_non_working.unwrap_or(false),
        };
        cache.push(cat.clone());
        drop(cache);
        self.flush().await?;
        Ok(cat)
    }

    pub async fn update(&self, id: &str, req: UpdateCategoryRequest) -> Result<Category, AppError> {
        let mut cache = self.cache.lock().await;
        let cat = cache.iter_mut().find(|c| c.id == id)
            .ok_or_else(|| AppError::NotFound("Category not found".into()))?;
        if let Some(v) = req.name            { cat.name           = v.trim().to_string(); }
        if let Some(v) = req.color           { cat.color          = v; }
        if let Some(v) = req.is_non_working  { cat.is_non_working = v; }
        let result = cat.clone();
        drop(cache);
        self.flush().await?;
        Ok(result)
    }

    pub async fn delete(&self, id: &str) -> Result<String, AppError> {
        let mut cache = self.cache.lock().await;
        let pos = cache.iter().position(|c| c.id == id)
            .ok_or_else(|| AppError::NotFound("Category not found".into()))?;
        cache.remove(pos);
        drop(cache);
        self.flush().await?;
        Ok(id.to_string())
    }
}
