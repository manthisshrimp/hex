use std::path::PathBuf;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::fs;
use uuid::Uuid;
use crate::models::{Expense, Month, YearData, YearSummary};
use crate::error::AppError;

/// In-memory cache: year → Vec<Month> (all 12 months)
type YearCache = Arc<Mutex<HashMap<u32, Vec<Month>>>>;

#[derive(Clone)]
pub struct YearsStore {
    data_dir: PathBuf,
    cache: YearCache,
}

impl YearsStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let data_dir = PathBuf::from(data_dir);
        fs::create_dir_all(&data_dir).await?;
        Ok(Self { data_dir, cache: Arc::new(Mutex::new(HashMap::new())) })
    }

    fn year_file(&self, year: u32) -> PathBuf {
        self.data_dir.join(format!("{}.jsonl", year))
    }

    /// Load a year from disk into cache (or return 12 empty months if no file).
    async fn load_year(&self, year: u32) -> Result<Vec<Month>, AppError> {
        let path = self.year_file(year);
        if !path.exists() {
            return Ok(Self::empty_months(year));
        }
        let content = fs::read_to_string(&path).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        let mut month_map: HashMap<u8, Month> = HashMap::new();
        for line in content.lines() {
            if line.trim().is_empty() { continue; }
            let m: Month = serde_json::from_str(line)
                .map_err(|e| AppError::Storage(format!("Parse error in {}.jsonl: {}", year, e)))?;
            month_map.insert(m.month, m);
        }
        // Fill missing months
        let months = (1u8..=12).map(|i| {
            month_map.remove(&i).unwrap_or(Month { month: i, year, income: 0.0, expenses: vec![] })
        }).collect();
        Ok(months)
    }

    /// Get months for a year, loading from disk if not cached.
    async fn months_for_year(&self, year: u32) -> Result<Vec<Month>, AppError> {
        let cached = { self.cache.lock().unwrap().get(&year).cloned() };
        if let Some(months) = cached {
            return Ok(months);
        }
        let months = self.load_year(year).await?;
        self.cache.lock().unwrap().insert(year, months.clone());
        Ok(months)
    }

    /// Persist a year's months back to disk and update cache.
    async fn save_year(&self, year: u32, months: &[Month]) -> Result<(), AppError> {
        let lines: Vec<String> = months.iter()
            .map(|m| serde_json::to_string(m).unwrap_or_default())
            .collect();
        let content = format!("{}\n", lines.join("\n"));
        fs::write(self.year_file(year), content).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        self.cache.lock().unwrap().insert(year, months.to_vec());
        Ok(())
    }

    fn empty_months(year: u32) -> Vec<Month> {
        (1u8..=12).map(|i| Month { month: i, year, income: 0.0, expenses: vec![] }).collect()
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    pub async fn list_year_summaries(&self) -> Result<Vec<YearSummary>, AppError> {
        let mut entries = fs::read_dir(&self.data_dir).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        let mut summaries = Vec::new();
        while let Some(entry) = entries.next_entry().await.map_err(|e| AppError::Storage(e.to_string()))? {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".jsonl") { continue; }
            let year: u32 = match name.trim_end_matches(".jsonl").parse() {
                Ok(y) => y, Err(_) => continue,
            };
            let months = self.months_for_year(year).await?;
            let total_income: f64 = months.iter().map(|m| m.income).sum();
            let total_expenses: f64 = months.iter()
                .flat_map(|m| m.expenses.iter())
                .map(|e| e.amount).sum();
            summaries.push(YearSummary { year, total_income, total_expenses, remainder: total_income - total_expenses });
        }
        summaries.sort_by(|a, b| b.year.cmp(&a.year));
        Ok(summaries)
    }

    pub async fn get_year(&self, year: u32) -> Result<YearData, AppError> {
        let months = self.months_for_year(year).await?;
        Ok(YearData { year, months })
    }

    pub async fn create_year(&self, year: u32) -> Result<YearData, AppError> {
        let months = self.months_for_year(year).await?;
        let has_data = months.iter().any(|m| m.income > 0.0 || !m.expenses.is_empty());
        if has_data {
            return Err(AppError::Conflict("Year already exists with data".to_string()));
        }
        let empty = Self::empty_months(year);
        self.save_year(year, &empty).await?;
        Ok(YearData { year, months: empty })
    }

    pub async fn get_month(&self, year: u32, month: u8) -> Result<Month, AppError> {
        let months = self.months_for_year(year).await?;
        Ok(months.into_iter().find(|m| m.month == month)
            .unwrap_or(Month { month, year, income: 0.0, expenses: vec![] }))
    }

    pub async fn update_income(&self, year: u32, month: u8, income: f64) -> Result<Month, AppError> {
        let mut months = self.months_for_year(year).await?;
        let m = months.iter_mut().find(|m| m.month == month)
            .ok_or_else(|| AppError::NotFound("Month not found".to_string()))?;
        m.income = income;
        let updated = m.clone();
        self.save_year(year, &months).await?;
        Ok(updated)
    }

    pub async fn add_expense(&self, year: u32, month: u8, mut expense: Expense) -> Result<Expense, AppError> {
        let mut months = self.months_for_year(year).await?;
        let m = months.iter_mut().find(|m| m.month == month)
            .ok_or_else(|| AppError::NotFound("Month not found".to_string()))?;
        expense.id = Uuid::new_v4().to_string();
        m.expenses.push(expense.clone());
        self.save_year(year, &months).await?;
        Ok(expense)
    }

    pub async fn update_expense(
        &self, year: u32, month: u8, expense_id: &str,
        day: Option<u8>, category_id: Option<String>,
        description: Option<String>, amount: Option<f64>,
    ) -> Result<Expense, AppError> {
        let mut months = self.months_for_year(year).await?;
        let m = months.iter_mut().find(|m| m.month == month)
            .ok_or_else(|| AppError::NotFound("Month not found".to_string()))?;
        let exp = m.expenses.iter_mut().find(|e| e.id == expense_id)
            .ok_or_else(|| AppError::NotFound("Expense not found".to_string()))?;
        if let Some(d) = day { exp.day = d; }
        if let Some(c) = category_id { exp.category_id = c; }
        if let Some(d) = description { exp.description = d; }
        if let Some(a) = amount { exp.amount = a; }
        let updated = exp.clone();
        self.save_year(year, &months).await?;
        Ok(updated)
    }

    pub async fn remove_expense(&self, year: u32, month: u8, expense_id: &str) -> Result<(), AppError> {
        let mut months = self.months_for_year(year).await?;
        let m = months.iter_mut().find(|m| m.month == month)
            .ok_or_else(|| AppError::NotFound("Month not found".to_string()))?;
        let before = m.expenses.len();
        m.expenses.retain(|e| e.id != expense_id);
        if m.expenses.len() == before {
            return Err(AppError::NotFound("Expense not found".to_string()));
        }
        self.save_year(year, &months).await
    }

    pub async fn is_category_used(&self, category_id: &str) -> Result<bool, AppError> {
        let mut entries = fs::read_dir(&self.data_dir).await
            .map_err(|e| AppError::Storage(e.to_string()))?;
        while let Some(entry) = entries.next_entry().await.map_err(|e| AppError::Storage(e.to_string()))? {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".jsonl") { continue; }
            let year: u32 = match name.trim_end_matches(".jsonl").parse() {
                Ok(y) => y, Err(_) => continue,
            };
            let months = self.months_for_year(year).await?;
            for month in &months {
                if month.expenses.iter().any(|e| e.category_id == category_id) {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn make_store(dir: &TempDir) -> YearsStore {
        YearsStore::new(dir.path().to_str().unwrap()).await.unwrap()
    }

    #[tokio::test]
    async fn test_get_year_returns_12_months_when_missing() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        let year = store.get_year(2026).await.unwrap();
        assert_eq!(year.months.len(), 12);
        assert!(year.months.iter().all(|m| m.expenses.is_empty()));
    }

    #[tokio::test]
    async fn test_create_year_persists() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        store.create_year(2025).await.unwrap();
        let file = temp.path().join("2025.jsonl");
        assert!(file.exists());
    }

    #[tokio::test]
    async fn test_create_year_duplicate_with_data_fails() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        store.create_year(2025).await.unwrap();
        // Add income to make it "have data"
        store.update_income(2025, 1, 5000.0).await.unwrap();
        let result = store.create_year(2025).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_income_and_get_month() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;
        store.update_income(2026, 3, 12000.0).await.unwrap();
        let month = store.get_month(2026, 3).await.unwrap();
        assert_eq!(month.income, 12000.0);
    }

    #[tokio::test]
    async fn test_add_and_remove_expense() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;

        use crate::models::Expense;
        let exp = store.add_expense(2026, 5, Expense {
            id: String::new(), // will be assigned
            day: 10,
            category_id: "cat-groceries".to_string(),
            description: "Test".to_string(),
            amount: 99.99,
        }).await.unwrap();

        assert!(!exp.id.is_empty());

        let month = store.get_month(2026, 5).await.unwrap();
        assert_eq!(month.expenses.len(), 1);

        store.remove_expense(2026, 5, &exp.id).await.unwrap();
        let month = store.get_month(2026, 5).await.unwrap();
        assert!(month.expenses.is_empty());
    }

    #[tokio::test]
    async fn test_update_expense() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;

        use crate::models::Expense;
        let exp = store.add_expense(2026, 1, Expense {
            id: String::new(),
            day: 1, category_id: "cat-other".to_string(),
            description: "Old".to_string(), amount: 10.0,
        }).await.unwrap();

        let updated = store.update_expense(2026, 1, &exp.id, None, None, Some("New".to_string()), Some(20.0)).await.unwrap();
        assert_eq!(updated.description, "New");
        assert_eq!(updated.amount, 20.0);
    }

    #[tokio::test]
    async fn test_is_category_used() {
        let temp = TempDir::new().unwrap();
        let store = make_store(&temp).await;

        use crate::models::Expense;
        store.add_expense(2026, 1, Expense {
            id: String::new(), day: 1,
            category_id: "cat-groceries".to_string(),
            description: "".to_string(), amount: 1.0,
        }).await.unwrap();

        assert!(store.is_category_used("cat-groceries").await.unwrap());
        assert!(!store.is_category_used("cat-other").await.unwrap());
    }
}
