// inventory/backend-rust/src/models.rs
use serde::{Deserialize, Serialize};

fn default_qty() -> u32 {
    1
}

// ---------------------------------------------------------------------------
// Persisted structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default = "default_qty")]
    pub required_quantity: u32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Check {
    pub id: String,
    pub location_id: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub entries: Vec<CheckEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckEntry {
    pub id: String,
    pub item_id: String,
    pub actual_quantity: u32,
    pub required_quantity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoSet {
    pub id: String,
    pub check_id: String,
    pub location_name: String,
    pub created_at: String,
    pub items: Vec<TodoSetItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoSetItem {
    pub id: String,
    pub item_id: String,
    pub item_name: String,
    pub path: String,
    pub required_quantity: u32,
    pub actual_quantity: u32,
    #[serde(default)]
    pub done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub done_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Request structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemRequest {
    pub name: String,
    pub parent_id: Option<String>,
    pub required_quantity: Option<u32>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemRequest {
    pub name: String,
    pub parent_id: Option<String>,
    pub required_quantity: u32,
    pub tags: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum CheckMode {
    #[default]
    OneLevel,
    Leaves,
    FullDepth,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckRequest {
    pub location_id: String,
    #[serde(default)]
    pub mode: CheckMode,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckEntryInput {
    pub item_id: String,
    pub actual_quantity: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitCheckRequest {
    pub entries: Vec<CheckEntryInput>,
}

// ---------------------------------------------------------------------------
// Response structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemResponse {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub required_quantity: u32,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub path: String,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemForCheck {
    pub id: String,
    pub name: String,
    pub required_quantity: u32,
    pub tags: Vec<String>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResponse {
    pub id: String,
    pub location_id: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub entries: Vec<CheckEntry>,
    pub items: Vec<ItemForCheck>,  // returned only on POST /api/checks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub todo_set_id: Option<String>,
}
