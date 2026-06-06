// calendar-site/backend-rust/src/storage/mod.rs
pub mod events;
pub mod categories;
pub use events::EventStore;
pub use categories::CategoryStore;
