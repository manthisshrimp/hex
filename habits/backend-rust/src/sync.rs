use reqwest::Client;
use serde_json::json;
use std::env;
use tokio::fs;
use tracing::{info, warn};

#[derive(Clone)]
pub struct TaskBoardSync {
    client: Client,
    base_url: String,
    habits_user: String,
    api_key: String,
}

impl TaskBoardSync {
    pub async fn new() -> Option<Self> {
        let base_url = env::var("TASKBOARD_URL").unwrap_or_default();
        if base_url.is_empty() {
            info!("TASKBOARD_URL not set — task-board sync disabled");
            return None;
        }

        let key_path = env::var("OCTIRON_API_KEY_PATH")
            .unwrap_or_else(|_| "/root/.octiron-api-key".to_string());

        let api_key = match fs::read_to_string(&key_path).await {
            Ok(k) => k.trim().to_string(),
            Err(_) => {
                warn!("Octiron API key not found at {key_path} — task-board sync disabled");
                return None;
            }
        };

        let habits_user = env::var("TASKBOARD_HABITS_USER")
            .unwrap_or_else(|_| "aldus".to_string());

        info!("Task-board sync enabled → {base_url} (user: {habits_user})");
        Some(Self {
            client: Client::new(),
            base_url,
            habits_user,
            api_key,
        })
    }

    /// Create a task in task-board for the habits user. Returns the task-board task ID.
    pub async fn create_task(&self, title: &str, habits_id: &str) -> Option<String> {
        let url = format!("{}/api/service/tasks", self.base_url);
        let result = self
            .client
            .post(&url)
            .header("X-Api-Key", &self.api_key)
            .json(&json!({
                "ownerUsername": self.habits_user,
                "title": title,
                "habitsId": habits_id,
            }))
            .send()
            .await;

        match result {
            Ok(resp) if resp.status().is_success() => {
                let body: serde_json::Value = resp.json().await.ok()?;
                body["id"].as_str().map(|s| s.to_string())
            }
            Ok(resp) => {
                warn!("Task-board sync create_task failed: {}", resp.status());
                None
            }
            Err(e) => {
                warn!("Task-board sync create_task error: {e}");
                None
            }
        }
    }

    /// Mark a task done by its task-board ID.
    pub async fn complete_task(&self, task_board_id: &str) {
        let url = format!("{}/api/service/tasks/{}/done", self.base_url, task_board_id);
        if let Err(e) = self
            .client
            .put(&url)
            .header("X-Api-Key", &self.api_key)
            .json(&json!({}))
            .send()
            .await
        {
            warn!("Task-board sync complete_task error: {e}");
        }
    }

    /// Delete a task by its task-board ID.
    pub async fn delete_task(&self, task_board_id: &str) {
        let url = format!("{}/api/service/tasks/{}", self.base_url, task_board_id);
        if let Err(e) = self
            .client
            .delete(&url)
            .header("X-Api-Key", &self.api_key)
            .send()
            .await
        {
            warn!("Task-board sync delete_task error: {e}");
        }
    }
}
