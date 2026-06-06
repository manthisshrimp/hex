use serde::{Deserialize, Serialize};

// ── Categories ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryRequest {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCategoryRequest {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CategoriesResponse {
    pub categories: Vec<Category>,
}

// ── Expenses / Months ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Expense {
    pub id: String,
    pub day: u8,
    #[serde(rename = "categoryId")]
    pub category_id: String,
    pub description: String,
    pub amount: f64,
}

/// One line in YYYY.jsonl
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Month {
    pub month: u8,
    pub year: u32,
    pub income: f64,
    pub expenses: Vec<Expense>,
}

#[derive(Debug, Serialize)]
pub struct YearData {
    pub year: u32,
    pub months: Vec<Month>,
}

#[derive(Debug, Serialize)]
pub struct YearSummary {
    pub year: u32,
    #[serde(rename = "totalIncome")]
    pub total_income: f64,
    #[serde(rename = "totalExpenses")]
    pub total_expenses: f64,
    pub remainder: f64,
}

#[derive(Debug, Serialize)]
pub struct MonthResponse {
    pub month: u8,
    pub year: u32,
    pub income: f64,
    pub expenses: Vec<Expense>,
    pub remainder: f64,
    #[serde(rename = "totalExpenses")]
    pub total_expenses: f64,
}

// ── Request bodies ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateYearRequest {
    pub year: u32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncomeRequest {
    pub income: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateExpenseRequest {
    pub day: u8,
    #[serde(rename = "categoryId")]
    pub category_id: String,
    pub description: Option<String>,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExpenseRequest {
    pub day: Option<u8>,
    #[serde(rename = "categoryId")]
    pub category_id: Option<String>,
    pub description: Option<String>,
    pub amount: Option<f64>,
}

// ── Category breakdown ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CategoryBreakdown {
    #[serde(rename = "categoryId")]
    pub category_id: String,
    #[serde(rename = "categoryName")]
    pub category_name: String,
    pub color: String,
    pub total: f64,
    pub count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expense_roundtrip() {
        let e = Expense {
            id: "abc".to_string(),
            day: 5,
            category_id: "cat-groceries".to_string(),
            description: "Milk".to_string(),
            amount: 12.50,
        };
        let json = serde_json::to_string(&e).unwrap();
        let e2: Expense = serde_json::from_str(&json).unwrap();
        assert_eq!(e.id, e2.id);
        assert_eq!(e.amount, e2.amount);
    }

    #[test]
    fn test_month_serialization_field_names() {
        let m = Month { month: 3, year: 2026, income: 5000.0, expenses: vec![] };
        let v: serde_json::Value = serde_json::to_value(&m).unwrap();
        assert!(v.get("month").is_some());
        assert!(v.get("year").is_some());
        assert!(v.get("income").is_some());
        assert!(v.get("expenses").is_some());
    }
}
