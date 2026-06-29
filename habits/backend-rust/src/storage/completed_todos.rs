use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::models::CompletedTodo;
use crate::error::AppError;

/// Append-only log of completed tasks, used to compute the weekly turn-in batch.
#[derive(Clone)]
pub struct CompletedTodosStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<CompletedTodo>>>,
}

impl CompletedTodosStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("completed-todos.jsonl");
        fs::create_dir_all(data_dir).await?;

        let items = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() { continue; }
                let item: CompletedTodo = serde_json::from_str(line)?;
                items.push(item);
            }
            items
        } else {
            Vec::new()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(items)) })
    }

    pub fn get_all(&self) -> Vec<CompletedTodo> {
        self.cache.lock().unwrap().clone()
    }

    pub async fn append(&self, record: CompletedTodo) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.push(record);
        }
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let items = { self.cache.lock().unwrap().clone() };
        let content = items.iter()
            .map(|t| serde_json::to_string(t))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
