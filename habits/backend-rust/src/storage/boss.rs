use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::models::BossState;
use crate::error::AppError;

#[derive(Clone)]
pub struct BossStore {
    file_path: PathBuf,
    cache: Arc<Mutex<BossState>>,
}

impl BossStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("boss.json");
        fs::create_dir_all(data_dir).await?;

        let state = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            BossState::default()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(state)) })
    }

    pub fn get(&self) -> BossState {
        self.cache.lock().unwrap().clone()
    }

    pub async fn save(&self, state: BossState) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            *cache = state;
        }
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let state = { self.cache.lock().unwrap().clone() };
        let content = serde_json::to_string_pretty(&state)
            .map_err(|e| AppError::Storage(e.to_string()))?;
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn round_trips_empty_state() {
        let dir = tempfile::tempdir().unwrap();
        let store = BossStore::new(dir.path().to_str().unwrap()).await.unwrap();
        let state = store.get();
        assert!(state.hosted.is_none());
        assert!(state.participating.is_none());
        assert!(state.revealed.is_empty());
    }
}
