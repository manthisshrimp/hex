// inventory/backend-rust/src/storage/todos.rs
use std::{path::PathBuf, sync::Arc};
use tokio::{fs, sync::Mutex};
use tokio::io::AsyncWriteExt;
use chrono::Utc;
use uuid::Uuid;
use crate::{error::AppError, models::Todo};

#[derive(Clone)]
pub struct TodoStore {
    path: PathBuf,
    cache: Arc<Mutex<Vec<Todo>>>,
}

impl TodoStore {
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

    async fn load(path: &PathBuf) -> Result<Vec<Todo>, AppError> {
        let content = fs::read_to_string(path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        content.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l)
                .map_err(|e| AppError::Storage(format!("Parse error: {e}"))))
            .collect()
    }

    async fn flush_with(&self, items: &[Todo]) -> Result<(), AppError> {
        let content: String = items.iter()
            .map(|i| serde_json::to_string(i).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        let content = if content.is_empty() { content } else { content + "\n" };
        fs::write(&self.path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    pub async fn all(&self) -> Vec<Todo> {
        self.cache.lock().await.clone()
    }

    pub async fn by_id(&self, id: &str) -> Option<Todo> {
        self.cache.lock().await.iter()
            .find(|t| t.id == id)
            .cloned()
    }

    pub async fn open(&self) -> Vec<Todo> {
        self.cache.lock().await.iter()
            .filter(|t| !t.resolved)
            .cloned()
            .collect()
    }

    pub async fn find_open_for_item(&self, item_id: &str) -> Option<Todo> {
        self.cache.lock().await.iter()
            .find(|t| !t.resolved && t.item_id == item_id)
            .cloned()
    }

    pub async fn create(
        &self,
        item_id: String,
        item_name: String,
        location_path: String,
        required: u32,
        actual: u32,
        check_id: String,
    ) -> Result<Todo, AppError> {
        let now = Utc::now().to_rfc3339();
        let todo = Todo {
            id: Uuid::new_v4().to_string(),
            item_id,
            item_name,
            location_path,
            required_quantity: required,
            actual_quantity: actual,
            resolved: false,
            created_at: now,
            resolved_at: None,
            source_check_id: check_id,
        };
        let line = serde_json::to_string(&todo).unwrap() + "\n";
        let mut file = tokio::fs::OpenOptions::new()
            .append(true).open(&self.path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        file.write_all(line.as_bytes()).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        self.cache.lock().await.push(todo.clone());
        Ok(todo)
    }

    pub async fn update_actual(&self, id: &str, actual: u32, check_id: String) -> Result<Option<Todo>, AppError> {
        let mut cache = self.cache.lock().await;
        let Some(todo) = cache.iter_mut().find(|t| t.id == id) else {
            return Ok(None);
        };
        todo.actual_quantity = actual;
        todo.source_check_id = check_id;
        let result = todo.clone();
        self.flush_with(&cache).await?;
        Ok(Some(result))
    }

    pub async fn resolve(&self, id: &str) -> Result<Option<Todo>, AppError> {
        let mut cache = self.cache.lock().await;
        let Some(todo) = cache.iter_mut().find(|t| t.id == id) else {
            return Ok(None);
        };
        todo.resolved = true;
        todo.resolved_at = Some(Utc::now().to_rfc3339());
        let result = todo.clone();
        self.flush_with(&cache).await?;
        Ok(Some(result))
    }

    pub async fn delete(&self, id: &str) -> Result<Option<Todo>, AppError> {
        let mut cache = self.cache.lock().await;
        let pos = cache.iter().position(|t| t.id == id);
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn make_store(dir: &TempDir) -> TodoStore {
        let path = dir.path().join("todos.jsonl");
        TodoStore::new(path.to_str().unwrap()).await.unwrap()
    }

    async fn make_todo(store: &TodoStore) -> Todo {
        store.create(
            "item-1".to_string(),
            "Widget".to_string(),
            "Bedroom > Shelf".to_string(),
            3,
            1,
            "check-1".to_string(),
        ).await.unwrap()
    }

    #[tokio::test]
    async fn empty_load_returns_empty_vec() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        assert!(store.all().await.is_empty());
    }

    #[tokio::test]
    async fn create_and_find_open_for_item() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let todo = make_todo(&store).await;
        let found = store.find_open_for_item("item-1").await;
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, todo.id);
        // non-existent item_id returns None
        let found_missing = store.find_open_for_item("item-99").await;
        assert!(found_missing.is_none());

        // resolved item should not be found
        let todo2 = store.create(
            "item-2".to_string(),
            "Gadget".to_string(),
            "Kitchen".to_string(),
            2,
            0,
            "check-2".to_string(),
        ).await.unwrap();
        store.resolve(&todo2.id).await.unwrap();
        let found_resolved = store.find_open_for_item("item-2").await;
        assert!(found_resolved.is_none());
    }

    #[tokio::test]
    async fn open_returns_only_unresolved() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let todo1 = make_todo(&store).await;
        // create a second todo with different item_id
        store.create(
            "item-2".to_string(),
            "Gadget".to_string(),
            "Kitchen".to_string(),
            2,
            0,
            "check-2".to_string(),
        ).await.unwrap();
        store.resolve(&todo1.id).await.unwrap();
        let open = store.open().await;
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].item_id, "item-2");
    }

    #[tokio::test]
    async fn resolve_sets_resolved_and_resolved_at() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let todo = make_todo(&store).await;
        assert!(!todo.resolved);
        assert!(todo.resolved_at.is_none());
        let resolved = store.resolve(&todo.id).await.unwrap().unwrap();
        assert!(resolved.resolved);
        assert!(resolved.resolved_at.is_some());
        // confirm cache reflects change
        let found = store.by_id(&todo.id).await.unwrap();
        assert!(found.resolved);
    }

    #[tokio::test]
    async fn update_actual_changes_quantities() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let todo = make_todo(&store).await;
        assert_eq!(todo.actual_quantity, 1);
        let updated = store.update_actual(&todo.id, 3, "check-2".to_string()).await.unwrap().unwrap();
        assert_eq!(updated.actual_quantity, 3);
        assert_eq!(updated.source_check_id, "check-2");
        // confirm cache reflects change
        let found = store.by_id(&todo.id).await.unwrap();
        assert_eq!(found.actual_quantity, 3);
    }

    #[tokio::test]
    async fn delete_removes_todo() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("todos.jsonl");
        let store = TodoStore::new(path.to_str().unwrap()).await.unwrap();

        let todo = store.create(
            "item-1".to_string(), "Charger".to_string(), "Bedroom".to_string(),
            2, 0, "check-1".to_string(),
        ).await.unwrap();

        let deleted = store.delete(&todo.id).await.unwrap();
        assert!(deleted.is_some());
        assert_eq!(deleted.unwrap().id, todo.id);
        assert!(store.all().await.is_empty());
    }
}
