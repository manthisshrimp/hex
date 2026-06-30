/// The boss reachable from a brand-new account before any reveal event fires.
pub const STARTER_BOSS: &str = "gloomfang";

#[derive(Debug, Clone)]
pub struct BossDef {
    pub id: &'static str,
    pub name: &'static str,
    pub lore: &'static str,
    pub tier: &'static str,
    /// Relative likelihood of being revealed. Higher = more common.
    /// 0 means never revealed at random (starter / event-only).
    pub reveal_weight: u32,
    /// Flavour shown the moment this boss is sighted/revealed.
    pub reveal_text: &'static str,
    pub duration_days: u32,
    /// Fixed total HP (in p-units), independent of party size. Daily damage is
    /// `daily_completion` ∈ [0, 1): a casual perfect day (3/3) ≈ 0.54, a good
    /// day (5/5) ≈ 0.76, a maxed day (10/10) ≈ 0.96. Only lesser bosses have
    /// `base_hp` low enough that a solo player at ~3/3 can finish in time;
    /// greater+ are unsoloable even at 10/10 every day and need a party.
    pub base_hp: f64,
    /// Target average daily completion — informational difficulty hint only;
    /// no longer drives HP.
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
        // ── LESSER (weight 50) ────────────────────────────────────────────────
        BossDef {
            id: "gloomfang",
            name: "Gloomfang",
            lore: "A slavering wolf-beast that haunts the forest edge, feeding on broken promises.",
            tier: "lesser",
            reveal_weight: 50,
            reveal_text: "Paw-prints the size of shields circle the camp. Something has been watching, and it is hungry.",
            duration_days: 5,
            base_hp: 2.3,
            threshold: 0.50,
            damage_multiplier: 1.25,
            reward_gold: 300.0,
            reward_item: Some("rnw-4"),
            reward_item_chance: 0.4,
            reward_heal: 25.0,
            reward_heal_chance: 0.6,
        },
        BossDef {
            id: "mirefen_lurker",
            name: "The Mirefen Lurker",
            lore: "A bloated marsh-thing that swells fat on every excuse left to rot in the shallows.",
            tier: "lesser",
            reveal_weight: 50,
            reveal_text: "The fen has gone silent. No frogs, no birds — only a slow, wet breathing somewhere beneath the reeds.",
            duration_days: 6,
            base_hp: 2.7,
            threshold: 0.55,
            damage_multiplier: 1.3,
            reward_gold: 450.0,
            reward_item: Some("rnw-3"),
            reward_item_chance: 0.45,
            reward_heal: 25.0,
            reward_heal_chance: 0.55,
        },
        // ── GREATER (weight 22) ───────────────────────────────────────────────
        BossDef {
            id: "ashwarden",
            name: "The Ashwarden",
            lore: "Ancient golem born of failed resolve, its body fused from the ash of abandoned habits.",
            tier: "greater",
            reveal_weight: 22,
            reveal_text: "A messenger collapses at the gate, robes seared black. The Ashwarden has woken, and its embers march on every keep in the vale.",
            duration_days: 7,
            base_hp: 9.0,
            threshold: 0.65,
            damage_multiplier: 1.5,
            reward_gold: 600.0,
            reward_item: Some("rnw-6"),
            reward_item_chance: 0.5,
            reward_heal: 20.0,
            reward_heal_chance: 0.4,
        },
        BossDef {
            id: "stormcaller",
            name: "The Stormcaller",
            lore: "A sky-tyrant that gathers where focus scatters, calling down ruin on the unprepared.",
            tier: "greater",
            reveal_weight: 22,
            reveal_text: "The horizon blackens out of season. Thunder rolls with a cadence too deliberate to be weather.",
            duration_days: 8,
            base_hp: 10.0,
            threshold: 0.70,
            damage_multiplier: 1.6,
            reward_gold: 850.0,
            reward_item: Some("rnw-7"),
            reward_item_chance: 0.55,
            reward_heal: 25.0,
            reward_heal_chance: 0.4,
        },
        BossDef {
            id: "dreadtide",
            name: "Dreadtide",
            lore: "A tidal behemoth that surges when discipline ebbs, swallowing the careless whole.",
            tier: "greater",
            reveal_weight: 22,
            reveal_text: "Far out on the black water a bell tolls where no bell should be. The Dreadtide rises with the dark moon.",
            duration_days: 10,
            base_hp: 14.0,
            threshold: 0.75,
            damage_multiplier: 1.75,
            reward_gold: 1000.0,
            reward_item: Some("rnw-11"),
            reward_item_chance: 0.6,
            reward_heal: 30.0,
            reward_heal_chance: 0.35,
        },
        // ── ANCIENT (weight 8) ────────────────────────────────────────────────
        BossDef {
            id: "hollow_king",
            name: "The Hollow King",
            lore: "A crowned husk that rules a court of the half-finished, demanding tribute in steadfastness.",
            tier: "ancient",
            reveal_weight: 8,
            reveal_text: "You find a throne room of dust and crowns, every seat filled by a king who never finished his reign. One throne stands empty, waiting.",
            duration_days: 12,
            base_hp: 26.0,
            threshold: 0.82,
            damage_multiplier: 1.9,
            reward_gold: 1500.0,
            reward_item: Some("rnw-9"),
            reward_item_chance: 0.7,
            reward_heal: 40.0,
            reward_heal_chance: 0.45,
        },
        BossDef {
            id: "the_undying_vigil",
            name: "The Undying Vigil",
            lore: "An ageless sentinel that tests only the most steadfast. It has never been defeated twice by the same party.",
            tier: "ancient",
            reveal_weight: 8,
            reveal_text: "The watchtower is cold, its lanterns long dead, its sentinels standing yet unbreathing — keeping an endless vigil for a foe that never tires.",
            duration_days: 14,
            base_hp: 35.0,
            threshold: 0.90,
            damage_multiplier: 2.0,
            reward_gold: 2000.0,
            reward_item: Some("rnw-12"),
            reward_item_chance: 0.8,
            reward_heal: 50.0,
            reward_heal_chance: 0.5,
        },
        // ── MYTHIC (weight 2) ─────────────────────────────────────────────────
        BossDef {
            id: "the_sundering",
            name: "The Sundering",
            lore: "Not a beast but an ending — the slow unmaking that comes for every resolve left untended long enough.",
            tier: "mythic",
            reveal_weight: 2,
            reveal_text: "The stars are wrong tonight. A seam of nothing has opened across the sky, and through it something vast and patient regards you.",
            duration_days: 18,
            base_hp: 63.0,
            threshold: 0.95,
            damage_multiplier: 2.5,
            reward_gold: 3500.0,
            reward_item: Some("rnw-10"),
            reward_item_chance: 0.9,
            reward_heal: 60.0,
            reward_heal_chance: 0.6,
        },
    ]
}

pub fn find(id: &str) -> Option<BossDef> {
    catalogue().into_iter().find(|b| b.id == id)
}

/// Pick a difficulty-weighted boss to reveal, skipping any id in `exclude`
/// (already revealed, currently hosted, or in an active quest). Harder bosses
/// have lower `reveal_weight`, so they surface less often. Returns None when
/// every revealable boss is already excluded.
pub fn pick_weighted_unrevealed(exclude: &[&str]) -> Option<BossDef> {
    use rand::Rng;
    let candidates: Vec<BossDef> = catalogue()
        .into_iter()
        .filter(|b| b.reveal_weight > 0 && !exclude.contains(&b.id))
        .collect();
    let total: u32 = candidates.iter().map(|b| b.reveal_weight).sum();
    if total == 0 {
        return None;
    }
    let mut roll = rand::thread_rng().gen_range(0..total);
    for b in candidates {
        if roll < b.reveal_weight {
            return Some(b);
        }
        roll -= b.reveal_weight;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalogue_has_eight_bosses() {
        assert_eq!(catalogue().len(), 8);
    }

    #[test]
    fn difficulty_matches_tier() {
        use crate::game::daily_completion;
        let casual = daily_completion(3, 3);  // ~0.537 — a modest perfect day
        let maxed = daily_completion(10, 10); // ~0.964 — best possible day
        for b in catalogue() {
            let d = b.duration_days as f64;
            if b.tier == "lesser" {
                // A casual 3/3-per-day solo run must finish a lesser boss.
                assert!(
                    b.base_hp <= casual * d,
                    "lesser {} should fall to 3/3 solo: base_hp {} > {:.2}",
                    b.id, b.base_hp, casual * d
                );
            } else {
                // Everything tougher must survive even a maxed 10/10 solo run.
                assert!(
                    b.base_hp > maxed * d,
                    "{} {} must be unsoloable: base_hp {} <= {:.2} (10/10 solo total)",
                    b.tier, b.id, b.base_hp, maxed * d
                );
            }
        }
    }

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

    #[test]
    fn starter_exists_and_is_revealable() {
        let b = find(STARTER_BOSS).expect("starter boss must exist");
        assert!(b.reveal_weight > 0);
    }

    #[test]
    fn harder_tiers_have_lower_weight() {
        let weight = |id: &str| find(id).unwrap().reveal_weight;
        assert!(weight("gloomfang") > weight("ashwarden"));   // lesser > greater
        assert!(weight("ashwarden") > weight("the_undying_vigil")); // greater > ancient
        assert!(weight("the_undying_vigil") > weight("the_sundering")); // ancient > mythic
    }

    #[test]
    fn weighted_pick_respects_exclude() {
        // Exclude all but one → that one must come back.
        let all: Vec<&str> = catalogue().iter().map(|b| b.id).collect();
        let keep = "the_sundering";
        let exclude: Vec<&str> = all.into_iter().filter(|id| *id != keep).collect();
        let picked = pick_weighted_unrevealed(&exclude).expect("one candidate remains");
        assert_eq!(picked.id, keep);
    }

    #[test]
    fn weighted_pick_none_when_all_excluded() {
        let all: Vec<&str> = catalogue().iter().map(|b| b.id).collect();
        assert!(pick_weighted_unrevealed(&all).is_none());
    }
}
