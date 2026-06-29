use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use chrono::Utc;
use crate::models::Character;
use crate::error::AppError;

#[derive(Clone)]
pub struct CharacterStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Character>>,
}

impl CharacterStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("character.json");
        fs::create_dir_all(data_dir).await?;

        let character = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            serde_json::from_str(&content)?
        } else {
            let today = Utc::now().format("%Y-%m-%d").to_string();
            let default = Character {
                hp: 100.0,
                gold: 0.0,
                last_tick_date: today,
                renown: 0.0,
                name: None,
                last_reward_claim: None,
            };
            let content = serde_json::to_string_pretty(&default)?;
            fs::write(&file_path, content).await?;
            default
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(character)) })
    }

    pub fn get(&self) -> Character {
        self.cache.lock().unwrap().clone()
    }

    pub async fn save(&self, character: Character) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            *cache = character;
        } // MutexGuard dropped before await
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let character = { self.cache.lock().unwrap().clone() }; // guard dropped before await
        let content = serde_json::to_string_pretty(&character)
            .map_err(|e| AppError::Storage(e.to_string()))?;
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
