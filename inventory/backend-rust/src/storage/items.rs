// inventory/backend-rust/src/storage/items.rs
use std::{path::PathBuf, sync::Arc};
use tokio::{fs, sync::Mutex};
use tokio::io::AsyncWriteExt;
use chrono::Utc;
use uuid::Uuid;
use crate::{
    error::AppError,
    models::{Item, CreateItemRequest, UpdateItemRequest, ItemResponse},
};

#[derive(Clone)]
pub struct ItemStore {
    path: PathBuf,
    cache: Arc<Mutex<Vec<Item>>>,
}

impl ItemStore {
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

    async fn load(path: &PathBuf) -> Result<Vec<Item>, AppError> {
        let content = fs::read_to_string(path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        content.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l)
                .map_err(|e| AppError::Storage(format!("Parse error: {e}"))))
            .collect()
    }

    async fn flush_with(&self, items: &[Item]) -> Result<(), AppError> {
        let content: String = items.iter()
            .map(|i| serde_json::to_string(i).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        let content = if content.is_empty() { content } else { content + "\n" };
        fs::write(&self.path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    async fn flush(&self) -> Result<(), AppError> {
        let cache = self.cache.lock().await;
        self.flush_with(&cache).await
    }

    pub async fn all(&self) -> Vec<Item> {
        self.cache.lock().await.clone()
    }

    pub async fn by_id(&self, id: &str) -> Option<Item> {
        self.cache.lock().await.iter()
            .find(|i| i.id == id)
            .cloned()
    }

    pub async fn children_of(&self, parent_id: &str) -> Vec<Item> {
        self.cache.lock().await.iter()
            .filter(|i| i.parent_id.as_deref() == Some(parent_id))
            .cloned()
            .collect()
    }

    pub async fn has_children(&self, id: &str) -> bool {
        self.cache.lock().await.iter()
            .any(|i| i.parent_id.as_deref() == Some(id))
    }

    /// Walk parent_id chain upward, join names with " > ", including the item itself.
    /// E.g. "Bedroom > Backpack > Charger"
    pub fn compute_path(item_id: &str, cache: &[Item]) -> String {
        let mut parts = Vec::new();
        let mut current_id = Some(item_id.to_string());
        while let Some(id) = current_id {
            match cache.iter().find(|i| i.id == id) {
                Some(item) => {
                    parts.push(item.name.clone());
                    current_id = item.parent_id.clone();
                }
                None => break,
            }
        }
        parts.reverse();
        parts.join(" > ")
    }

    /// Returns the path of the item's parent (or empty string if no parent).
    /// Used for Todo.location_path.
    pub fn parent_path(item_id: &str, cache: &[Item]) -> String {
        match cache.iter().find(|i| i.id == item_id) {
            Some(item) => match &item.parent_id {
                Some(pid) => Self::compute_path(pid, cache),
                None => String::new(),
            },
            None => String::new(),
        }
    }

    /// Build ItemResponse with computed path and has_children. Locks cache once.
    pub async fn to_response(&self, item: &Item) -> ItemResponse {
        let cache = self.cache.lock().await;
        let path = Self::compute_path(&item.id, &cache);
        let has_children = cache.iter().any(|i| i.parent_id.as_deref() == Some(&item.id));
        ItemResponse {
            id: item.id.clone(),
            name: item.name.clone(),
            parent_id: item.parent_id.clone(),
            required_quantity: item.required_quantity,
            tags: item.tags.clone(),
            notes: item.notes.clone(),
            created_at: item.created_at.clone(),
            updated_at: item.updated_at.clone(),
            path,
            has_children,
        }
    }

    pub async fn create(&self, req: CreateItemRequest) -> Result<Item, AppError> {
        let now = Utc::now().to_rfc3339();
        let item = Item {
            id: Uuid::new_v4().to_string(),
            name: req.name,
            parent_id: req.parent_id,
            required_quantity: req.required_quantity.unwrap_or(1),
            tags: req.tags.unwrap_or_default(),
            notes: req.notes,
            created_at: now.clone(),
            updated_at: now,
        };
        // Append single line — O(1), no full rewrite
        let line = serde_json::to_string(&item).unwrap() + "\n";
        let mut file = tokio::fs::OpenOptions::new()
            .append(true).open(&self.path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        file.write_all(line.as_bytes()).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        self.cache.lock().await.push(item.clone());
        Ok(item)
    }

    pub async fn update(&self, id: &str, req: UpdateItemRequest) -> Result<Option<Item>, AppError> {
        let mut cache = self.cache.lock().await;
        let Some(item) = cache.iter_mut().find(|i| i.id == id) else {
            return Ok(None);
        };
        item.name = req.name;
        item.parent_id = req.parent_id;
        item.required_quantity = req.required_quantity;
        item.tags = req.tags;
        item.notes = req.notes;
        item.updated_at = Utc::now().to_rfc3339();
        let result = item.clone();
        self.flush_with(&cache).await?;
        Ok(Some(result))
    }

    pub async fn delete(&self, id: &str) -> Result<Option<Item>, AppError> {
        let mut cache = self.cache.lock().await;
        let pos = cache.iter().position(|i| i.id == id);
        match pos {
            None => Ok(None),
            Some(idx) => {
                let removed = cache.remove(idx);
                self.flush_with(&cache).await?;
                Ok(Some(removed))
            }
        }
    }

    /// Case-insensitive substring search on name.
    /// If containers_only is true, only items that have children are returned.
    pub async fn search(&self, q: &str, containers_only: bool) -> Vec<Item> {
        let q_lower = q.to_lowercase();
        let cache = self.cache.lock().await;
        cache.iter()
            .filter(|i| i.name.to_lowercase().contains(&q_lower))
            .filter(|i| {
                if containers_only {
                    cache.iter().any(|c| c.parent_id.as_deref() == Some(&i.id))
                } else {
                    true
                }
            })
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn make_store(dir: &TempDir) -> ItemStore {
        let path = dir.path().join("items.jsonl");
        ItemStore::new(path.to_str().unwrap()).await.unwrap()
    }

    fn make_create_req(name: &str, parent_id: Option<&str>) -> CreateItemRequest {
        CreateItemRequest {
            name: name.to_string(),
            parent_id: parent_id.map(|s| s.to_string()),
            required_quantity: None,
            tags: None,
            notes: None,
        }
    }

    #[tokio::test]
    async fn empty_load_returns_empty_vec() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        assert!(store.all().await.is_empty());
    }

    #[tokio::test]
    async fn create_and_by_id() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let item = store.create(make_create_req("Bedroom", None)).await.unwrap();
        let found = store.by_id(&item.id).await;
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Bedroom");
    }

    #[tokio::test]
    async fn update_changes_fields() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let item = store.create(make_create_req("Old Name", None)).await.unwrap();
        let req = UpdateItemRequest {
            name: "New Name".to_string(),
            parent_id: None,
            required_quantity: 2,
            tags: vec!["tag1".to_string()],
            notes: Some("a note".to_string()),
        };
        let updated = store.update(&item.id, req).await.unwrap().unwrap();
        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.required_quantity, 2);
        assert_eq!(updated.tags, vec!["tag1"]);
        assert_eq!(updated.notes, Some("a note".to_string()));
        // Confirm cache reflects change
        let found = store.by_id(&item.id).await.unwrap();
        assert_eq!(found.name, "New Name");
    }

    #[tokio::test]
    async fn delete_removes_item() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let item = store.create(make_create_req("ToDelete", None)).await.unwrap();
        let removed = store.delete(&item.id).await.unwrap();
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().name, "ToDelete");
        assert!(store.by_id(&item.id).await.is_none());
    }

    #[tokio::test]
    async fn compute_path_root_item_returns_just_name() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let item = store.create(make_create_req("Bedroom", None)).await.unwrap();
        let cache = store.all().await;
        let path = ItemStore::compute_path(&item.id, &cache);
        assert_eq!(path, "Bedroom");
    }

    #[tokio::test]
    async fn compute_path_nested_returns_full_chain() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let bedroom = store.create(make_create_req("Bedroom", None)).await.unwrap();
        let backpack = store.create(make_create_req("Backpack", Some(&bedroom.id))).await.unwrap();
        let charger = store.create(make_create_req("Charger", Some(&backpack.id))).await.unwrap();
        let cache = store.all().await;
        let path = ItemStore::compute_path(&charger.id, &cache);
        assert_eq!(path, "Bedroom > Backpack > Charger");
    }

    #[tokio::test]
    async fn parent_path_root_returns_empty() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let item = store.create(make_create_req("Bedroom", None)).await.unwrap();
        let cache = store.all().await;
        let pp = ItemStore::parent_path(&item.id, &cache);
        assert_eq!(pp, "");
    }

    #[tokio::test]
    async fn parent_path_nested_returns_parent_chain() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let bedroom = store.create(make_create_req("Bedroom", None)).await.unwrap();
        let backpack = store.create(make_create_req("Backpack", Some(&bedroom.id))).await.unwrap();
        let charger = store.create(make_create_req("Charger", Some(&backpack.id))).await.unwrap();
        let cache = store.all().await;
        let pp = ItemStore::parent_path(&charger.id, &cache);
        assert_eq!(pp, "Bedroom > Backpack");
    }

    #[tokio::test]
    async fn search_finds_by_substring_case_insensitive() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        store.create(make_create_req("Bedroom Shelf", None)).await.unwrap();
        store.create(make_create_req("Kitchen Drawer", None)).await.unwrap();
        store.create(make_create_req("bedroom closet", None)).await.unwrap();
        let results = store.search("bedroom", false).await;
        assert_eq!(results.len(), 2);
        let names: Vec<_> = results.iter().map(|i| i.name.as_str()).collect();
        assert!(names.contains(&"Bedroom Shelf"));
        assert!(names.contains(&"bedroom closet"));
    }

    #[tokio::test]
    async fn search_containers_only_filters_to_has_children() {
        let dir = TempDir::new().unwrap();
        let store = make_store(&dir).await;
        let parent = store.create(make_create_req("Box A", None)).await.unwrap();
        let _leaf = store.create(make_create_req("Box B", Some(&parent.id))).await.unwrap();
        store.create(make_create_req("Box C", None)).await.unwrap(); // no children

        // containers_only=true: only "Box A" has children
        let results = store.search("Box", true).await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Box A");

        // containers_only=false: all three match
        let results = store.search("Box", false).await;
        assert_eq!(results.len(), 3);
    }
}
