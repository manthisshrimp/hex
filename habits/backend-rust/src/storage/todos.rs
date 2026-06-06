use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::models::Todo;
use crate::error::AppError;

#[derive(Clone)]
pub struct TodosStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<Todo>>>,
}

impl TodosStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("todos.jsonl");
        fs::create_dir_all(data_dir).await?;

        let todos = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() { continue; }
                let todo: Todo = serde_json::from_str(line)?;
                items.push(todo);
            }
            items
        } else {
            Vec::new()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(todos)) })
    }

    pub fn get_all(&self) -> Vec<Todo> {
        self.cache.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<Todo> {
        self.cache.lock().unwrap().iter().find(|t| t.id == id).cloned()
    }

    pub async fn create(&self, todo: Todo) -> Result<Todo, AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.push(todo.clone());
        }
        self.persist().await?;
        Ok(todo)
    }

    pub async fn remove(&self, id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.retain(|t| t.id != id);
        }
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let todos = { self.cache.lock().unwrap().clone() };
        let content = todos.iter()
            .map(|t| serde_json::to_string(t))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
