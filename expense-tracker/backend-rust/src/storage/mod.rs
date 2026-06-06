pub mod categories;
pub mod years;

pub use categories::CategoriesStore;
pub use years::YearsStore;

/// Shared application storage — both stores behind Arc so AppState can clone cheaply.
#[derive(Clone)]
pub struct AppStore {
    pub categories: CategoriesStore,
    pub years: YearsStore,
}

impl AppStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        Ok(Self {
            categories: CategoriesStore::new(data_dir).await?,
            years: YearsStore::new(data_dir).await?,
        })
    }
}
