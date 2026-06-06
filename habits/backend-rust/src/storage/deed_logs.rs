use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::models::DeedLog;
use crate::error::AppError;

#[derive(Clone)]
pub struct DeedLogsStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<DeedLog>>>,
}

impl DeedLogsStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("deed_logs.jsonl");
        fs::create_dir_all(data_dir).await?;

        let logs = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() { continue; }
                let log: DeedLog = serde_json::from_str(line)?;
                items.push(log);
            }
            items
        } else {
            Vec::new()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(logs)) })
    }

    pub fn get_all(&self) -> Vec<DeedLog> {
        self.cache.lock().unwrap().clone()
    }

    pub fn logged_today(&self, deed_id: &str, today: &str) -> bool {
        self.cache.lock().unwrap()
            .iter()
            .any(|l| l.deed_id == deed_id && l.logged_at == today)
    }

    pub async fn append(&self, log: DeedLog) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.push(log);
        }
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let logs = { self.cache.lock().unwrap().clone() };
        let content = logs.iter()
            .map(|l| serde_json::to_string(l))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
