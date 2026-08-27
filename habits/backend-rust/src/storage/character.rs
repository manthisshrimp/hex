use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::fs;
use chrono::Utc;
use crate::models::Character;
use crate::error::AppError;
use crate::game::GameConfig;
use super::HabitsStore;

#[derive(Clone)]
pub struct CharacterStore {
    file_path: PathBuf,
    cache: Arc<Mutex<Character>>,
    habits: HabitsStore,
}

impl CharacterStore {
    pub async fn new(data_dir: &str, habits: HabitsStore) -> Result<Self, anyhow::Error> {
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

        Ok(Self { file_path, cache: Arc::new(Mutex::new(character)), habits })
    }

    pub fn get(&self) -> Character {
        self.cache.lock().unwrap().clone()
    }

    pub async fn save(&self, character: Character) -> Result<(), AppError> {
        // Back at full HP => nobody owes anything: wipe every habit's HP debt.
        // Done here because every HP write in the app funnels through save().
        let full_hp = character.hp >= GameConfig::default().max_hp;
        {
            let mut cache = self.cache.lock().unwrap();
            *cache = character;
        } // MutexGuard dropped before await
        self.persist().await?;
        if full_hp {
            self.habits.clear_all_health_removed().await?;
        }
        Ok(())
    }

    async fn persist(&self) -> Result<(), AppError> {
        let character = { self.cache.lock().unwrap().clone() }; // guard dropped before await
        let content = serde_json::to_string_pretty(&character)
            .map_err(|e| AppError::Storage(e.to_string()))?;
        fs::write(&self.file_path, content).await
            .map_err(|e| AppError::Storage(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn stores() -> (tempfile::TempDir, HabitsStore, CharacterStore) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_str().unwrap();
        let habits = HabitsStore::new(path).await.unwrap();
        let character = CharacterStore::new(path, habits.clone()).await.unwrap();
        (dir, habits, character)
    }

    #[tokio::test]
    async fn full_hp_clears_habit_debt() {
        let (_dir, habits, character) = stores().await;
        let id = habits.get_all().first().unwrap().id.clone();
        habits.update_health_removed(&id, 40.0).await.unwrap();

        let mut ch = character.get();
        ch.hp = 60.0;
        character.save(ch.clone()).await.unwrap();
        assert_eq!(habits.get_all().iter().find(|h| h.id == id).unwrap().health_removed, 40.0);

        ch.hp = 100.0;
        character.save(ch).await.unwrap();
        assert_eq!(habits.get_all().iter().find(|h| h.id == id).unwrap().health_removed, 0.0);
    }
}
