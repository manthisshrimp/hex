// inventory/backend-rust/src/storage/checks.rs
use std::{path::PathBuf, sync::Arc};
use tokio::{fs, sync::Mutex};
use tokio::io::AsyncWriteExt;
use chrono::Utc;
use uuid::Uuid;
use crate::{error::AppError, models::{Check, CheckEntry}};

#[derive(Clone)]
pub struct CheckStore {
    path: PathBuf,
    cache: Arc<Mutex<Vec<Check>>>,
}

impl CheckStore {
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

    async fn load(path: &PathBuf) -> Result<Vec<Check>, AppError> {
        let content = fs::read_to_string(path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        content.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l)
                .map_err(|e| AppError::Storage(format!("Parse error: {e}"))))
            .collect()
    }

    async fn flush_with(&self, items: &[Check]) -> Result<(), AppError> {
        let content: String = items.iter()
            .map(|i| serde_json::to_string(i).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        let content = if content.is_empty() { content } else { content + "\n" };
        fs::write(&self.path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    pub async fn all(&self) -> Vec<Check> {
        self.cache.lock().await.clone()
    }

    pub async fn by_id(&self, id: &str) -> Option<Check> {
        self.cache.lock().await.iter()
            .find(|c| c.id == id)
            .cloned()
    }

    pub async fn for_location(&self, location_id: &str) -> Vec<Check> {
        self.cache.lock().await.iter()
            .filter(|c| c.location_id == location_id)
            .cloned()
            .collect()
    }

    pub async fn create(&self, location_id: String) -> Result<Check, AppError> {
        let now = Utc::now().to_rfc3339();
        let check = Check {
            id: Uuid::new_v4().to_string(),
            location_id,
            started_at: now,
            completed_at: None,
            entries: vec![],
        };
        let line = serde_json::to_string(&check).unwrap() + "\n";
        let mut file = tokio::fs::OpenOptions::new()
            .append(true).open(&self.path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        file.write_all(line.as_bytes()).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        self.cache.lock().await.push(check.clone());
        Ok(check)
    }

    pub async fn complete(&self, id: &str, entries: Vec<CheckEntry>) -> Result<Option<Check>, AppError> {
        let mut cache = self.cache.lock().await;
        let Some(check) = cache.iter_mut().find(|c| c.id == id) else {
            return Ok(None);
        };
        check.completed_at = Some(Utc::now().to_rfc3339());
        check.entries = entries;
        let result = check.clone();
        self.flush_with(&cache).await?;
        Ok(Some(result))
    }

    pub async fn is_complete(&self, id: &str) -> bool {
        self.cache.lock().await.iter()
            .find(|c| c.id == id)
            .map(|c| c.completed_at.is_some())
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn make_store(dir: &TempDir) -> CheckStore {
        let path = dir.path().join("checks.jsonl");
        CheckStore::new(path.to_str().unwrap()).await.unwrap()
    }

    #[tokio::test]
    async fn empty_load_returns_empty_vec() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        assert!(store.all().await.is_empty());
    }

    #[tokio::test]
    async fn create_returns_check_with_empty_entries() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let check = store.create("loc-1".to_string()).await.unwrap();
        assert_eq!(check.location_id, "loc-1");
        assert!(check.entries.is_empty());
        assert!(check.completed_at.is_none());
    }

    #[tokio::test]
    async fn complete_sets_entries_and_completed_at() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let check = store.create("loc-1".to_string()).await.unwrap();
        let entries = vec![CheckEntry {
            id: Uuid::new_v4().to_string(),
            item_id: "item-1".to_string(),
            actual_quantity: 2,
            required_quantity: 3,
        }];
        let completed = store.complete(&check.id, entries.clone()).await.unwrap().unwrap();
        assert!(completed.completed_at.is_some());
        assert_eq!(completed.entries.len(), 1);
        assert_eq!(completed.entries[0].item_id, "item-1");
    }

    #[tokio::test]
    async fn is_complete_before_and_after() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let check = store.create("loc-1".to_string()).await.unwrap();
        assert!(!store.is_complete(&check.id).await);
        store.complete(&check.id, vec![]).await.unwrap();
        assert!(store.is_complete(&check.id).await);
    }

    #[tokio::test]
    async fn for_location_filters_correctly() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("checks.jsonl");
        let store = CheckStore::new(path.to_str().unwrap()).await.unwrap();

        store.create("loc-a".to_string()).await.unwrap();
        store.create("loc-a".to_string()).await.unwrap();
        store.create("loc-b".to_string()).await.unwrap();

        let results = store.for_location("loc-a").await;
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|c| c.location_id == "loc-a"));
    }
}
