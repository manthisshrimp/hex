use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use crate::models::Completion;
use crate::error::AppError;

#[derive(Clone)]
pub struct CompletionsStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<Completion>>>,
}

impl CompletionsStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("completions.jsonl");
        fs::create_dir_all(data_dir).await?;

        let completions = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let completion: Completion = serde_json::from_str(line)?;
                items.push(completion);
            }
            items
        } else {
            Vec::new()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(completions)) })
    }

    pub fn get_all(&self) -> Vec<Completion> {
        self.cache.lock().unwrap().clone()
    }

    pub fn get_for_habit(&self, habit_id: &str) -> Vec<Completion> {
        self.cache.lock().unwrap()
            .iter()
            .filter(|c| c.habit_id == habit_id)
            .cloned()
            .collect()
    }

    /// Returns completions where completed_at (as date prefix) >= since_date (YYYY-MM-DD).
    pub fn get_since(&self, since_date: &str) -> Vec<Completion> {
        self.cache.lock().unwrap()
            .iter()
            .filter(|c| {
                // completed_at is ISO datetime; compare the date prefix
                c.completed_at.get(..10).unwrap_or("") >= since_date
            })
            .cloned()
            .collect()
    }

    pub fn count_for_habit(&self, habit_id: &str) -> usize {
        self.cache.lock().unwrap()
            .iter()
            .filter(|c| c.habit_id == habit_id)
            .count()
    }

    /// Shift all completion dates back by `days` days (for debug time simulation).
    pub async fn shift_dates_back(&self, days: i64) -> Result<(), AppError> {
        use chrono::NaiveDate;
        {
            let mut cache = self.cache.lock().unwrap();
            for c in cache.iter_mut() {
                if let Some(date_str) = c.completed_at.get(..10) {
                    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        let new_date = d - chrono::Duration::days(days);
                        let tail = c.completed_at.get(10..).unwrap_or("T00:00:00Z");
                        c.completed_at = format!("{}{}", new_date.format("%Y-%m-%d"), tail);
                    }
                }
            }
        }
        self.persist().await
    }

    pub async fn remove_for_habit(&self, habit_id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.retain(|c| c.habit_id != habit_id);
        }
        self.persist().await
    }

    pub async fn append(&self, completion: Completion) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            cache.push(completion);
        } // MutexGuard dropped before await
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let completions = { self.cache.lock().unwrap().clone() }; // guard dropped before await
        let content = completions.iter()
            .map(|c| serde_json::to_string(c))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
