pub mod habits;
pub mod completions;
pub mod events;
pub mod character;
pub mod deadlines;
pub mod equipment;
pub mod random_event;
pub mod todos;
pub mod completed_todos;
pub mod deeds;
pub mod deed_logs;
pub mod party;
pub mod boss;

pub use habits::HabitsStore;
pub use completions::CompletionsStore;
pub use events::EventsStore;
pub use character::CharacterStore;
pub use deadlines::DeadlinesStore;
pub use equipment::EquipmentStore;
pub use random_event::RandomEventStore;
pub use todos::TodosStore;
pub use completed_todos::CompletedTodosStore;
pub use deeds::DeedsStore;
pub use deed_logs::DeedLogsStore;
pub use party::PartyStore;
pub use boss::BossStore;

#[derive(Clone)]
pub struct AppStore {
    pub habits: HabitsStore,
    pub completions: CompletionsStore,
    pub events: EventsStore,
    pub character: CharacterStore,
    pub deadlines: DeadlinesStore,
    pub equipment: EquipmentStore,
    pub random_events: RandomEventStore,
    pub todos: TodosStore,
    pub completed_todos: CompletedTodosStore,
    pub deeds: DeedsStore,
    pub deed_logs: DeedLogsStore,
    pub party: PartyStore,
    pub boss: BossStore,
}

impl AppStore {
    pub async fn new(data_dir: &str) -> Result<Self, anyhow::Error> {
        let habits = HabitsStore::new(data_dir).await?;
        let completions = CompletionsStore::new(data_dir).await?;
        let events = EventsStore::new(data_dir).await?;
        let character = CharacterStore::new(data_dir).await?;
        let deadlines = DeadlinesStore::new(data_dir).await?;
        let equipment = EquipmentStore::new(data_dir).await?;
        let random_events = RandomEventStore::new(data_dir).await?;
        let todos = TodosStore::new(data_dir).await?;
        let completed_todos = CompletedTodosStore::new(data_dir).await?;
        let deeds = DeedsStore::new(data_dir).await?;
        let deed_logs = DeedLogsStore::new(data_dir).await?;
        let party = PartyStore::new(data_dir).await?;
        let boss = BossStore::new(data_dir).await?;
        Ok(Self { habits, completions, events, character, deadlines, equipment, random_events, todos, completed_todos, deeds, deed_logs, party, boss })
    }
}
