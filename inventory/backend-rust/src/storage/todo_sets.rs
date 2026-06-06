// inventory/backend-rust/src/storage/todo_sets.rs
use std::{path::PathBuf, sync::Arc};
use tokio::{fs, sync::Mutex};
use chrono::Utc;
use uuid::Uuid;
use crate::{error::AppError, models::{TodoSet, TodoSetItem}};

#[derive(Clone)]
pub struct TodoSetStore {
    path: PathBuf,
    cache: Arc<Mutex<Vec<TodoSet>>>,
}

impl TodoSetStore {
    pub async fn new(data_path: &str) -> Result<Self, AppError> {
        let path = PathBuf::from(data_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await
                .map_err(|e| AppError::Storage(e.to_string()))?;
        }
        if !path.exists() {
            fs::write(&path, "").await
                .map_err(|e| AppError::Storage(e.to_string()))?;
        }
        let cache = Self::load(&path).await?;
        Ok(Self { path, cache: Arc::new(Mutex::new(cache)) })
    }

    async fn load(path: &PathBuf) -> Result<Vec<TodoSet>, AppError> {
        let content = fs::read_to_string(path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        content.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l)
                .map_err(|e| AppError::Storage(format!("Parse error: {e}"))))
            .collect()
    }

    async fn flush_with(&self, sets: &[TodoSet]) -> Result<(), AppError> {
        let content: String = sets.iter()
            .map(|s| serde_json::to_string(s).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        let content = if content.is_empty() { content } else { content + "\n" };
        fs::write(&self.path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    pub async fn all(&self) -> Vec<TodoSet> {
        let mut sets = self.cache.lock().await.clone();
        sets.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        sets
    }

    pub async fn by_id(&self, id: &str) -> Option<TodoSet> {
        self.cache.lock().await.iter()
            .find(|s| s.id == id)
            .cloned()
    }

    pub async fn create(
        &self,
        check_id: String,
        location_name: String,
        items: Vec<TodoSetItem>,
    ) -> Result<TodoSet, AppError> {
        let set = TodoSet {
            id: Uuid::new_v4().to_string(),
            check_id,
            location_name,
            created_at: Utc::now().to_rfc3339(),
            items,
        };
        let line = serde_json::to_string(&set).unwrap() + "\n";
        let mut file = tokio::fs::OpenOptions::new()
            .append(true).open(&self.path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, line.as_bytes()).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        self.cache.lock().await.push(set.clone());
        Ok(set)
    }

    pub async fn mark_item_done(&self, set_id: &str, item_id: &str) -> Result<Option<TodoSet>, AppError> {
        let mut cache = self.cache.lock().await;
        let Some(set) = cache.iter_mut().find(|s| s.id == set_id) else {
            return Ok(None);
        };
        let Some(item) = set.items.iter_mut().find(|i| i.id == item_id) else {
            return Ok(None);
        };
        item.done = true;
        item.done_at = Some(Utc::now().to_rfc3339());
        let result = set.clone();
        self.flush_with(&cache).await?;
        Ok(Some(result))
    }

    pub async fn delete(&self, id: &str) -> Result<Option<TodoSet>, AppError> {
        let mut cache = self.cache.lock().await;
        let pos = cache.iter().position(|s| s.id == id);
        match pos {
            None => Ok(None),
            Some(idx) => {
                let removed = cache.remove(idx);
                self.flush_with(&cache).await?;
                Ok(Some(removed))
            }
        }
    }
}
