#[derive(Debug, Clone)]
pub struct BossDef {
    pub id: &'static str,
    pub name: &'static str,
    pub lore: &'static str,
    pub tier: &'static str,
    pub duration_days: u32,
    pub threshold: f64,
    pub damage_multiplier: f64,
    pub reward_gold: f64,
    pub reward_item: Option<&'static str>,
    pub reward_item_chance: f64,
    pub reward_heal: f64,
    pub reward_heal_chance: f64,
}

pub fn catalogue() -> Vec<BossDef> {
    vec![
        BossDef {
            id: "gloomfang",
            name: "Gloomfang",
            lore: "A slavering wolf-beast that haunts the forest edge, feeding on broken promises.",
            tier: "lesser",
            duration_days: 5,
            threshold: 0.50,
            damage_multiplier: 1.25,
            reward_gold: 300.0,
            reward_item: Some("rnw-4"),
            reward_item_chance: 0.4,
            reward_heal: 25.0,
            reward_heal_chance: 0.6,
        },
        BossDef {
            id: "ashwarden",
            name: "The Ashwarden",
            lore: "Ancient golem born of failed resolve, its body fused from the ash of abandoned habits.",
            tier: "greater",
            duration_days: 7,
            threshold: 0.65,
            damage_multiplier: 1.5,
            reward_gold: 600.0,
            reward_item: Some("rnw-6"),
            reward_item_chance: 0.5,
            reward_heal: 20.0,
            reward_heal_chance: 0.4,
        },
        BossDef {
            id: "dreadtide",
            name: "Dreadtide",
            lore: "A tidal behemoth that surges when discipline ebbs, swallowing the careless whole.",
            tier: "greater",
            duration_days: 10,
            threshold: 0.75,
            damage_multiplier: 1.75,
            reward_gold: 1000.0,
            reward_item: Some("rnw-11"),
            reward_item_chance: 0.6,
            reward_heal: 30.0,
            reward_heal_chance: 0.35,
        },
        BossDef {
            id: "the_undying_vigil",
            name: "The Undying Vigil",
            lore: "An ageless sentinel that tests only the most steadfast. It has never been defeated twice by the same party.",
            tier: "ancient",
            duration_days: 14,
            threshold: 0.90,
            damage_multiplier: 2.0,
            reward_gold: 2000.0,
            reward_item: Some("rnw-12"),
            reward_item_chance: 0.8,
            reward_heal: 50.0,
            reward_heal_chance: 0.5,
        },
    ]
}

pub fn find(id: &str) -> Option<BossDef> {
    catalogue().into_iter().find(|b| b.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_thresholds_valid() {
        for b in catalogue() {
            assert!(b.threshold > 0.0 && b.threshold <= 1.0,
                "boss {} threshold {} out of range", b.id, b.threshold);
        }
    }

    #[test]
    fn all_reward_items_exist() {
        let valid_ids = ["rnw-1","rnw-2","rnw-3","rnw-4","rnw-5","rnw-6",
                         "rnw-7","rnw-8","rnw-9","rnw-10","rnw-11","rnw-12"];
        for b in catalogue() {
            if let Some(item) = b.reward_item {
                assert!(!item.is_empty(), "boss {} reward_item is empty", b.id);
                assert!(valid_ids.contains(&item), "boss {} reward_item '{}' not in catalogue", b.id, item);
            }
        }
    }

    #[test]
    fn find_returns_correct_boss() {
        let b = find("gloomfang").expect("gloomfang must exist");
        assert_eq!(b.id, "gloomfang");
        assert_eq!(b.tier, "lesser");
    }
}
