// calendar-site/backend-rust/src/storage/events.rs
use std::{path::PathBuf, sync::Arc};
use tokio::{fs, sync::Mutex};
use tokio::io::AsyncWriteExt;
use chrono::Utc;
use uuid::Uuid;
use crate::{
    error::AppError,
    models::{Event, CreateEventRequest, UpdateEventRequest, ReorderRequest},
};

#[derive(Clone)]
pub struct EventStore {
    path: PathBuf,
    cache: Arc<Mutex<Vec<Event>>>,
}

impl EventStore {
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

    async fn load(path: &PathBuf) -> Result<Vec<Event>, AppError> {
        let content = fs::read_to_string(path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        content.lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l)
                .map_err(|e| AppError::Storage(format!("Parse error: {e}"))))
            .collect()
    }

    async fn flush(&self) -> Result<(), AppError> {
        let cache = self.cache.lock().await;
        let content: String = cache.iter()
            .map(|e| serde_json::to_string(e).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        let content = if content.is_empty() { content } else { content + "\n" };
        fs::write(&self.path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }

    pub async fn all(&self) -> Vec<Event> {
        self.cache.lock().await.clone()
    }

    pub async fn in_range(&self, start: &str, end: &str) -> Vec<Event> {
        self.cache.lock().await.iter()
            .filter(|e| e.date.as_str() >= start && e.date.as_str() <= end)
            .cloned().collect()
    }

    pub async fn for_date(&self, date: &str) -> Vec<Event> {
        self.cache.lock().await.iter()
            .filter(|e| e.date == date)
            .cloned().collect()
    }

    pub async fn count_for_date(&self, date: &str) -> usize {
        self.cache.lock().await.iter()
            .filter(|e| e.date == date)
            .count()
    }

    pub async fn by_id(&self, id: &str) -> Option<Event> {
        self.cache.lock().await.iter()
            .find(|e| e.id == id)
            .cloned()
    }

    pub async fn create(&self, req: CreateEventRequest) -> Result<Event, AppError> {
        let now = Utc::now().to_rfc3339();
        let mut cache = self.cache.lock().await;
        // New events sort after existing ones on the same day.
        let order = cache.iter()
            .filter(|e| e.date == req.date)
            .map(|e| e.order)
            .max()
            .map_or(0, |m| m + 1);
        let event = Event {
            id: Uuid::new_v4().to_string(),
            date: req.date,
            title: req.title,
            description: req.description.unwrap_or_default(),
            category_id: req.category_id.unwrap_or_default(),
            color: req.color.unwrap_or_default(),
            start_time: req.start_time.unwrap_or_default(),
            end_time: req.end_time.unwrap_or_default(),
            all_day: req.all_day.unwrap_or(false),
            partial: req.partial.unwrap_or(false),
            order,
            created_at: now.clone(),
            updated_at: now,
        };
        // Append single line — O(1), no full rewrite
        let line = serde_json::to_string(&event).unwrap() + "\n";
        let mut file = tokio::fs::OpenOptions::new()
            .append(true).open(&self.path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        file.write_all(line.as_bytes()).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        cache.push(event.clone());
        Ok(event)
    }

    pub async fn update(&self, id: &str, req: UpdateEventRequest) -> Result<Option<Event>, AppError> {
        let mut cache = self.cache.lock().await;
        let Some(ev) = cache.iter_mut().find(|e| e.id == id) else {
            return Ok(None);
        };
        if let Some(v) = req.date        { ev.date        = v; }
        if let Some(v) = req.title       { ev.title       = v; }
        if let Some(v) = req.description { ev.description = v; }
        if let Some(v) = req.category_id { ev.category_id = v; }
        if let Some(v) = req.color       { ev.color       = v; }
        if let Some(v) = req.start_time  { ev.start_time  = v; }
        if let Some(v) = req.end_time    { ev.end_time    = v; }
        if let Some(v) = req.all_day     { ev.all_day     = v; }
        if let Some(v) = req.partial     { ev.partial     = v; }
        ev.updated_at = Utc::now().to_rfc3339();
        let result = ev.clone();
        drop(cache);
        self.flush().await?;
        Ok(Some(result))
    }

    // Assign order = position in `ids` for events on `date`. Ids not on the date are ignored.
    pub async fn reorder(&self, req: ReorderRequest) -> Result<(), AppError> {
        let mut cache = self.cache.lock().await;
        for (i, id) in req.ids.iter().enumerate() {
            if let Some(ev) = cache.iter_mut().find(|e| &e.id == id && e.date == req.date) {
                ev.order = i as i32;
            }
        }
        drop(cache);
        self.flush().await
    }

    pub async fn delete(&self, id: &str) -> Result<bool, AppError> {
        let mut cache = self.cache.lock().await;
        let before = cache.len();
        cache.retain(|e| e.id != id);
        if cache.len() == before { return Ok(false); }
        drop(cache);
        self.flush().await?;
        Ok(true)
    }
}
