use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use uuid::Uuid;
use crate::models::{Deed, CreateDeedRequest, UpdateDeedRequest, Importance};
use crate::error::AppError;

#[derive(Clone)]
pub struct DeedsStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<Deed>>>,
}

impl DeedsStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("deeds.jsonl");
        fs::create_dir_all(data_dir).await?;

        let deeds = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() { continue; }
                let deed: Deed = serde_json::from_str(line)?;
                items.push(deed);
            }
            items
        } else {
            Vec::new()
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(deeds)) })
    }

    pub fn get_all(&self) -> Vec<Deed> {
        self.cache.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<Deed> {
        self.cache.lock().unwrap().iter().find(|d| d.id == id).cloned()
    }

    pub async fn create(&self, req: CreateDeedRequest) -> Result<Deed, AppError> {
        let deed = {
            let mut cache = self.cache.lock().unwrap();
            let deed = Deed {
                id: Uuid::new_v4().to_string(),
                name: req.name.trim().to_string(),
                deed_type: req.deed_type,
                importance: req.importance,
                notes: req.notes.filter(|n| !n.trim().is_empty()),
            };
            cache.push(deed.clone());
            deed
        };
        self.persist().await?;
        Ok(deed)
    }

    pub async fn update(&self, id: &str, req: UpdateDeedRequest) -> Result<Deed, AppError> {
        let updated = {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|d| d.id == id)
                .ok_or_else(|| AppError::NotFound("Deed not found".to_string()))?;
            if let Some(name) = req.name {
                cache[idx].name = name.trim().to_string();
            }
            if let Some(imp) = req.importance {
                cache[idx].importance = imp;
            }
            if let Some(notes) = req.notes {
                let trimmed = notes.trim().to_string();
                cache[idx].notes = if trimmed.is_empty() { None } else { Some(trimmed) };
            }
            cache[idx].clone()
        };
        self.persist().await?;
        Ok(updated)
    }

    pub async fn delete(&self, id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|d| d.id == id)
                .ok_or_else(|| AppError::NotFound("Deed not found".to_string()))?;
            cache.remove(idx);
        }
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let deeds = { self.cache.lock().unwrap().clone() };
        let content = deeds.iter()
            .map(|d| serde_json::to_string(d))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}

pub fn deed_effect(importance: &Importance) -> f64 {
    match importance {
        Importance::Low => 3.0,
        Importance::Medium => 5.0,
        Importance::High => 8.0,
    }
}
