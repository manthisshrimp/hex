use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::models::{HealthEvent, GoldEvent};
use crate::error::AppError;

#[derive(Clone)]
pub struct EventsStore {
    health_file: PathBuf,
    gold_file: PathBuf,
    health_cache: Arc<Mutex<Vec<HealthEvent>>>,
    gold_cache: Arc<Mutex<Vec<GoldEvent>>>,
}

impl EventsStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let health_file = PathBuf::from(data_dir).join("health_events.jsonl");
        let gold_file = PathBuf::from(data_dir).join("gold_events.jsonl");
        fs::create_dir_all(data_dir).await?;

        let health_cache = if health_file.exists() {
            let content = fs::read_to_string(&health_file).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let event: HealthEvent = serde_json::from_str(line)?;
                items.push(event);
            }
            items
        } else {
            Vec::new()
        };

        let gold_cache = if gold_file.exists() {
            let content = fs::read_to_string(&gold_file).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let event: GoldEvent = serde_json::from_str(line)?;
                items.push(event);
            }
            items
        } else {
            Vec::new()
        };

        Ok(Self {
            health_file,
            gold_file,
            health_cache: Arc::new(Mutex::new(health_cache)),
            gold_cache: Arc::new(Mutex::new(gold_cache)),
        })
    }

    pub async fn append_health(&self, event: HealthEvent) -> Result<(), AppError> {
        {
            let mut cache = self.health_cache.lock().unwrap();
            cache.push(event);
        } // MutexGuard dropped before await
        self.persist_health().await
    }

    pub async fn append_gold(&self, event: GoldEvent) -> Result<(), AppError> {
        {
            let mut cache = self.gold_cache.lock().unwrap();
            cache.push(event);
        } // MutexGuard dropped before await
        self.persist_gold().await
    }

    /// Returns health events where tick_date >= since_date (YYYY-MM-DD).
    pub fn health_since(&self, since_date: &str) -> Vec<HealthEvent> {
        self.health_cache.lock().unwrap()
            .iter()
            .filter(|e| e.tick_date.as_str() >= since_date)
            .cloned()
            .collect()
    }

    /// Returns gold events where the date prefix of timestamp >= since_date (YYYY-MM-DD).
    pub fn gold_since(&self, since_date: &str) -> Vec<GoldEvent> {
        self.gold_cache.lock().unwrap()
            .iter()
            .filter(|e| e.timestamp.get(..10).unwrap_or("") >= since_date)
            .cloned()
            .collect()
    }

    async fn persist_health(&self) -> Result<(), AppError> {
        let events = { self.health_cache.lock().unwrap().clone() }; // guard dropped before await
        let content = events.iter()
            .map(|e| serde_json::to_string(e))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.health_file, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    async fn persist_gold(&self) -> Result<(), AppError> {
        let events = { self.gold_cache.lock().unwrap().clone() }; // guard dropped before await
        let content = events.iter()
            .map(|e| serde_json::to_string(e))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.gold_file, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
