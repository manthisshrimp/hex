use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::error::AppError;

#[derive(Clone)]
pub struct DeadlinesStore {
    file_path: PathBuf,
    cache: Arc<Mutex<HashMap<String, String>>>,
}

impl DeadlinesStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("deadlines.json");
        fs::create_dir_all(data_dir).await?;

        let deadlines: HashMap<String, String> = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            serde_json::from_str(&content)?
        } else {
            HashMap::new()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(deadlines)) })
    }

    pub fn get(&self, habit_id: &str) -> Option<String> {
        self.cache.lock().unwrap().get(habit_id).cloned()
    }

    pub async fn set(&self, habit_id: &str, deadline: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.insert(habit_id.to_string(), deadline.to_string());
        } // MutexGuard dropped before await
        self.persist().await
    }

    pub async fn remove(&self, habit_id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.remove(habit_id);
        } // MutexGuard dropped before await
        self.persist().await
    }

    pub fn get_all(&self) -> HashMap<String, String> {
        self.cache.lock().unwrap().clone()
    }

    pub async fn save_all(&self, deadlines: HashMap<String, String>) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            *cache = deadlines;
        } // MutexGuard dropped before await
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let deadlines = { self.cache.lock().unwrap().clone() }; // guard dropped before await
        let content = serde_json::to_string_pretty(&deadlines)
            .map_err(|e| AppError::Storage(e.to_string()))?;
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
