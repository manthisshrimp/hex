use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use uuid::Uuid;
use chrono::Utc;
use crate::models::{Habit, Importance, CreateHabitRequest, UpdateHabitRequest};
use crate::error::AppError;

#[derive(Clone)]
pub struct HabitsStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Vec<Habit>>>,
}

impl HabitsStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let file_path = PathBuf::from(data_dir).join("habits.jsonl");
        fs::create_dir_all(data_dir).await?;

        let habits = if file_path.exists() {
            let content = fs::read_to_string(&file_path).await?;
            let mut items = Vec::new();
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let habit: Habit = serde_json::from_str(line)?;
                items.push(habit);
            }
            items
        } else {
            let now = Utc::now().to_rfc3339();
            let seed = Habit {
                id: "system-open-app".to_string(),
                name: "Open the app".to_string(),
                importance: Importance::Low,
                frequency: "daily".to_string(),
                window_days: 1,
                active: true,
                system: true,
                created_at: now,
                position: 0,
                notes: None,
                show_on_days: None,
                inscribed: false,
                inscribed_at: None,
            };
            let defaults = vec![seed];
            let content = defaults.iter()
                .map(|h| serde_json::to_string(h))
                .collect::<Result<Vec<_>, _>>()?
                .join("\n");
            fs::write(&file_path, content).await?;
            defaults
        };

        Ok(Self { file_path, cache: Arc::new(Mutex::new(habits)) })
    }

    pub fn get_all(&self) -> Vec<Habit> {
        self.cache.lock().unwrap().clone()
    }

    pub fn get_by_id(&self, id: &str) -> Option<Habit> {
        self.cache.lock().unwrap().iter().find(|h| h.id == id).cloned()
    }

    pub async fn create(&self, req: CreateHabitRequest) -> Result<Habit, AppError> {
        let habit = {
            let mut cache = self.cache.lock().unwrap();
            let next_pos = cache.iter().filter(|h| !h.system).map(|h| h.position).max().map_or(0, |m| m + 1);
            let habit = Habit {
                id: Uuid::new_v4().to_string(),
                name: req.name.trim().to_string(),
                importance: req.importance,
                frequency: req.frequency,
                window_days: req.window_days.unwrap_or(1),
                active: true,
                system: false,
                created_at: Utc::now().to_rfc3339(),
                position: next_pos,
                notes: req.notes.filter(|n| !n.trim().is_empty()),
                show_on_days: req.show_on_days.filter(|d| !d.is_empty()),
                inscribed: false,
                inscribed_at: None,
            };
            cache.push(habit.clone());
            habit
        }; // MutexGuard dropped before await
        self.persist().await?;
        Ok(habit)
    }

    pub async fn update(&self, id: &str, req: UpdateHabitRequest) -> Result<Habit, AppError> {
        let updated = {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|h| h.id == id)
                .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;
            if cache[idx].system {
                return Err(AppError::Validation("Cannot modify system habit".to_string()));
            }
            if let Some(name) = req.name {
                cache[idx].name = name.trim().to_string();
            }
            if let Some(importance) = req.importance {
                cache[idx].importance = importance;
            }
            if let Some(freq) = req.frequency {
                cache[idx].frequency = freq;
            }
            if let Some(wd) = req.window_days {
                cache[idx].window_days = wd.max(1);
            }
            if let Some(active) = req.active {
                cache[idx].active = active;
            }
            if let Some(notes) = req.notes {
                let trimmed = notes.trim().to_string();
                cache[idx].notes = if trimmed.is_empty() { None } else { Some(trimmed) };
            }
            if let Some(days) = req.show_on_days {
                cache[idx].show_on_days = if days.is_empty() { None } else { Some(days) };
            }
            cache[idx].clone()
        }; // MutexGuard dropped before await
        self.persist().await?;
        Ok(updated)
    }

    pub async fn delete(&self, id: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|h| h.id == id)
                .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;
            if cache[idx].system {
                return Err(AppError::Validation("Cannot modify system habit".to_string()));
            }
            cache.remove(idx);
        } // MutexGuard dropped before await
        self.persist().await?;
        Ok(())
    }

    /// Move a habit up or down in user-defined order relative to other non-system habits.
    pub async fn move_habit_direction(&self, id: &str, direction: &str) -> Result<(), AppError> {
        {
            let mut cache = self.cache.lock().unwrap();

            // Build a sorted list of cache indices for non-system habits.
            let mut indexed: Vec<usize> = (0..cache.len())
                .filter(|&i| !cache[i].system)
                .collect();
            indexed.sort_by(|&a, &b| {
                cache[a].position.cmp(&cache[b].position)
                    .then_with(|| cache[a].created_at.cmp(&cache[b].created_at))
            });

            // Normalize to 0-based positions.
            for (rank, &ci) in indexed.iter().enumerate() {
                cache[ci].position = rank as u32;
            }

            // Find this habit's rank in the sorted order.
            let rank = indexed.iter().position(|&ci| cache[ci].id == id)
                .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;

            let swap_rank = if direction == "up" {
                if rank == 0 { return Ok(()); }
                rank - 1
            } else {
                if rank + 1 >= indexed.len() { return Ok(()); }
                rank + 1
            };

            // Swap position values.
            let ci_a = indexed[rank];
            let ci_b = indexed[swap_rank];
            cache[ci_a].position = swap_rank as u32;
            cache[ci_b].position = rank as u32;
        }
        self.persist().await
    }

    pub async fn inscribe(&self, id: &str) -> Result<Habit, AppError> {
        let updated = {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|h| h.id == id)
                .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;
            if cache[idx].system {
                return Err(AppError::Validation("Cannot inscribe system habit".to_string()));
            }
            cache[idx].inscribed = true;
            cache[idx].inscribed_at = Some(Utc::now().to_rfc3339());
            cache[idx].clone()
        };
        self.persist().await?;
        Ok(updated)
    }

    pub async fn restore(&self, id: &str) -> Result<Habit, AppError> {
        let updated = {
            let mut cache = self.cache.lock().unwrap();
            let idx = cache.iter().position(|h| h.id == id)
                .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;
            cache[idx].inscribed = false;
            cache[idx].inscribed_at = None;
            cache[idx].clone()
        };
        self.persist().await?;
        Ok(updated)
    }

    /// Shift all habit `created_at` dates back by `days` days (for debug time simulation).
    pub async fn shift_created_at_back(&self, days: i64) -> Result<(), AppError> {
        use chrono::NaiveDate;
        {
            let mut cache = self.cache.lock().unwrap();
            for h in cache.iter_mut() {
                if let Some(date_str) = h.created_at.get(..10) {
                    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        let new_date = d - chrono::Duration::days(days);
                        let tail = h.created_at.get(10..).unwrap_or("T00:00:00Z");
                        h.created_at = format!("{}{}", new_date.format("%Y-%m-%d"), tail);
                    }
                }
            }
        }
        self.persist().await
    }

    async fn persist(&self) -> Result<(), AppError> {
        let habits = { self.cache.lock().unwrap().clone() }; // guard dropped before await
        let content = habits.iter()
            .map(|h| serde_json::to_string(h))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Storage(e.to_string()))?
            .join("\n");
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}
