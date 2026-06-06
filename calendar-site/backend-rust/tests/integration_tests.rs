#[cfg(test)]
mod tests {
    use calendar_backend::AuthManager;
    use calendar_backend::storage::{EventStore, CategoryStore};
    use calendar_backend::models::{CreateEventRequest, UpdateEventRequest, CreateCategoryRequest};
    use tempfile::TempDir;

    // --- Auth tests ---

    #[tokio::test]
    async fn test_hash_is_deterministic() {
        let h1 = AuthManager::hash("secret");
        let h2 = AuthManager::hash("secret");
        assert_eq!(h1, h2);
    }

    #[tokio::test]
    async fn test_wrong_password_does_not_match() {
        let h1 = AuthManager::hash("correct");
        let h2 = AuthManager::hash("wrong");
        assert_ne!(h1, h2);
    }

    // --- EventStore tests ---

    #[tokio::test]
    async fn test_event_create_and_read() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("events.jsonl");
        let store = EventStore::new(path.to_str().unwrap()).await.unwrap();

        let ev = store.create(CreateEventRequest {
            date: "2026-01-15".to_string(),
            title: "Test".to_string(),
            description: None, category_id: None,
            color: None, start_time: None, end_time: None, all_day: None,
        }).await.unwrap();

        assert_eq!(ev.date, "2026-01-15");
        assert_eq!(ev.title, "Test");

        let all = store.all().await;
        assert_eq!(all.len(), 1);
    }

    #[tokio::test]
    async fn test_event_update() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("events.jsonl");
        let store = EventStore::new(path.to_str().unwrap()).await.unwrap();
        let ev = store.create(CreateEventRequest {
            date: "2026-01-15".to_string(), title: "Old".to_string(),
            description: None, category_id: None, color: None,
            start_time: None, end_time: None, all_day: None,
        }).await.unwrap();

        let updated = store.update(&ev.id, UpdateEventRequest {
            title: Some("New".to_string()),
            date: None, description: None, category_id: None,
            color: None, start_time: None, end_time: None, all_day: None,
        }).await.unwrap();

        assert_eq!(updated.unwrap().title, "New");
    }

    #[tokio::test]
    async fn test_event_delete() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("events.jsonl");
        let store = EventStore::new(path.to_str().unwrap()).await.unwrap();
        let ev = store.create(CreateEventRequest {
            date: "2026-01-15".to_string(), title: "ToDelete".to_string(),
            description: None, category_id: None, color: None,
            start_time: None, end_time: None, all_day: None,
        }).await.unwrap();

        let deleted = store.delete(&ev.id).await.unwrap();
        assert!(deleted);
        assert!(store.all().await.is_empty());
    }

    #[tokio::test]
    async fn test_events_persist_to_disk() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("events.jsonl");
        {
            let store = EventStore::new(path.to_str().unwrap()).await.unwrap();
            store.create(CreateEventRequest {
                date: "2026-01-15".to_string(), title: "Persist".to_string(),
                description: None, category_id: None, color: None,
                start_time: None, end_time: None, all_day: None,
            }).await.unwrap();
        }
        let store2 = EventStore::new(path.to_str().unwrap()).await.unwrap();
        let all = store2.all().await;
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].title, "Persist");
    }

    // --- CategoryStore tests ---

    #[tokio::test]
    async fn test_categories_seed_defaults() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("categories.json");
        let store = CategoryStore::new(path.to_str().unwrap()).await.unwrap();
        let cats = store.all().await;
        assert!(!cats.is_empty(), "defaults should be seeded");
        assert!(cats.iter().any(|c| c.name == "Work"));
    }

    #[tokio::test]
    async fn test_category_create_and_delete() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("categories.json");
        let store = CategoryStore::new(path.to_str().unwrap()).await.unwrap();

        let cat = store.create(CreateCategoryRequest {
            name: "Vacation".to_string(),
            color: Some("#ff0000".to_string()),
            is_non_working: Some(true),
        }).await.unwrap();

        assert_eq!(cat.name, "Vacation");
        assert!(cat.is_non_working);

        let deleted = store.delete(&cat.id).await.unwrap();
        assert_eq!(deleted, cat.id);
    }

    #[tokio::test]
    async fn test_category_duplicate_name_rejected() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("categories.json");
        let store = CategoryStore::new(path.to_str().unwrap()).await.unwrap();
        store.create(CreateCategoryRequest {
            name: "UniqueX".to_string(), color: None, is_non_working: None,
        }).await.unwrap();
        let result = store.create(CreateCategoryRequest {
            name: "uniquex".to_string(), color: None, is_non_working: None,
        }).await;
        assert!(result.is_err());
    }
}
