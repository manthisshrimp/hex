/// Static catalogue of random events. Passive events auto-resolve; choice
/// events require the player to pick an option. One passive event (`a_threat_stirs`)
/// reveals a difficulty-weighted boss instead of applying a stat outcome.

#[derive(Clone)]
pub struct OutcomeDef {
    pub text: &'static str,
    pub hp_delta: f64,
    pub gold_delta: f64,
}

#[derive(Clone, PartialEq)]
pub enum StatType {
    Armor,
    Damage,
    Hp,
    None,
}

impl StatType {
    pub fn as_str(&self) -> &'static str {
        match self {
            StatType::Armor => "armor",
            StatType::Damage => "damage",
            StatType::Hp => "hp",
            StatType::None => "none",
        }
    }
}

#[derive(Clone)]
pub struct PassiveTier {
    pub min_stat: u32,
    pub outcome: OutcomeDef,
}

#[derive(Clone)]
pub enum ChoiceEffect {
    Fixed(OutcomeDef),
    StatCheck {
        stat: StatType,
        threshold: u32,
        above: OutcomeDef,
        below: OutcomeDef,
    },
}

#[derive(Clone)]
pub struct ChoiceOption {
    pub label: &'static str,
    pub prompt: &'static str,
    pub effect: ChoiceEffect,
}

#[derive(Clone)]
pub enum EventKind {
    Passive {
        stat: StatType,
        tiers: Vec<PassiveTier>, // sorted ascending by min_stat
    },
    Choice {
        options: Vec<ChoiceOption>,
    },
}

#[derive(Clone)]
pub struct EventDef {
    pub id: &'static str,
    pub title: &'static str,
    pub text: &'static str,
    pub kind: EventKind,
    pub reveals_boss: Option<&'static str>,
}

/// Returns the full catalogue. Cheap to call — all data is 'static.
pub fn catalogue() -> Vec<EventDef> {
    vec![
        // ── PASSIVE (8) ──────────────────────────────────────────────────────
        EventDef {
            id: "bandit-ambush",
            title: "Bandit Ambush",
            text: "A group of armed men steps from the shadows, blades drawn. No words are exchanged.",
            kind: EventKind::Passive {
                stat: StatType::Armor,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "The bandits strike swiftly. Blood and coin scatter in the mud.", hp_delta: -12.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 15, outcome: OutcomeDef { text: "Your armor turns aside the worst of it. You limp away poorer for the encounter.", hp_delta: -5.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 30, outcome: OutcomeDef { text: "They see your plate and think twice. You walk on, unharmed.", hp_delta: 0.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "storm-in-the-pass",
            title: "Storm in the Pass",
            text: "A savage mountain storm descends without warning. The wind carries ice and the cold is merciless.",
            kind: EventKind::Passive {
                stat: StatType::Armor,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "The cold bites deep through your thin clothes. You arrive shivering and bruised.", hp_delta: -8.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 15, outcome: OutcomeDef { text: "Wind-battered but standing. Your gear keeps the worst at bay.", hp_delta: -2.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 30, outcome: OutcomeDef { text: "You find shelter in your heavy mantle. The storm passes around you.", hp_delta: 3.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "plague-village",
            title: "Plague Village",
            text: "The village smells of burning herbs and rot. The afflicted watch you pass with hollow eyes.",
            kind: EventKind::Passive {
                stat: StatType::Hp,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "Already weakened, the sickness takes a severe toll. The fever lasts for days.", hp_delta: -15.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 40, outcome: OutcomeDef { text: "You carry it for days before the fever breaks. Your body holds.", hp_delta: -8.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 70, outcome: OutcomeDef { text: "Your constitution holds against the pestilence. A mild malaise, nothing more.", hp_delta: -3.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "old-wound",
            title: "Old Wound",
            text: "An old scar pulls tight in the cold. Something is tearing loose beneath the skin.",
            kind: EventKind::Passive {
                stat: StatType::Hp,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "The wound reopens badly. You lose precious days to recovery.", hp_delta: -10.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 50, outcome: OutcomeDef { text: "A dull ache, but manageable. You bind it tightly and press on.", hp_delta: -3.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "moonlit-spring",
            title: "Moonlit Spring",
            text: "Hidden in a forest glade, a spring shimmers with soft silver light. The water is clear and cold and still.",
            kind: EventKind::Passive {
                stat: StatType::Hp,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "The sacred water heals your grievous wounds. You emerge restored, feeling almost new.", hp_delta: 18.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 50, outcome: OutcomeDef { text: "The cool water soothes your weary body. You rest here a while.", hp_delta: 10.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 80, outcome: OutcomeDef { text: "A gentle refreshment. Your body needed little — you drink deeply anyway.", hp_delta: 5.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "arena-exhibition",
            title: "Arena Exhibition",
            text: "A traveling arena has set up in the next town. The ringmaster calls for challengers from the crowd.",
            kind: EventKind::Passive {
                stat: StatType::Damage,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "You are thrown from the ring in moments. The crowd jeers and pelts you with scraps.", hp_delta: -5.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 10, outcome: OutcomeDef { text: "A creditable showing earns the crowd's silver. You leave bruised but richer.", hp_delta: -2.0, gold_delta: 50.0 } },
                    PassiveTier { min_stat: 25, outcome: OutcomeDef { text: "A masterful display. The arena master presses a heavy purse into your hands.", hp_delta: 0.0, gold_delta: 130.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "forest-dungeon",
            title: "Forest Dungeon",
            text: "The mouth of a dungeon gapes between two ancient oaks. Something glints deep in the dark.",
            kind: EventKind::Passive {
                stat: StatType::Damage,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "The creatures within overwhelm you. You barely escape with your life.", hp_delta: -15.0, gold_delta: 0.0 } },
                    PassiveTier { min_stat: 10, outcome: OutcomeDef { text: "You clear the upper chambers, finding modest treasure before retreating.", hp_delta: -3.0, gold_delta: 30.0 } },
                    PassiveTier { min_stat: 25, outcome: OutcomeDef { text: "You cut through to the vault. The hoard is yours to carry.", hp_delta: -5.0, gold_delta: 100.0 } },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "ancient-shrine",
            title: "Ancient Shrine",
            text: "Half-buried in moss and time, a shrine stands at a crossroads. The air smells of incense long faded.",
            kind: EventKind::Passive {
                stat: StatType::None,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "You kneel at the forgotten altar. A warmth spreads through your chest like embers catching flame.", hp_delta: 12.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: None,
        },
        // ── CHOICE (12) ──────────────────────────────────────────────────────
        EventDef {
            id: "merchant-offer",
            title: "The Merchant's Proposition",
            text: "A cloaked merchant steps from the fog, holding up a small vial of glowing liquid. They say nothing. They don't need to.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Buy it",
                        prompt: "Pay 80 gold for a restorative tonic.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You uncork the vial and drink. Warmth floods through your limbs.", hp_delta: 10.0, gold_delta: -80.0 }),
                    },
                    ChoiceOption {
                        label: "Walk away",
                        prompt: "The road has no room for trinkets.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You leave the merchant to their fog.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "cursed-tome",
            title: "The Cursed Tome",
            text: "A tome of forbidden knowledge lies open on a ruined altar. The pages are filled with ciphers that seem to shift as you read.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Study it",
                        prompt: "Transcribe its secrets for later sale.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "The knowledge burns into your mind. Your head splits with visions, but the secrets are yours.", hp_delta: -8.0, gold_delta: 30.0 }),
                    },
                    ChoiceOption {
                        label: "Burn it",
                        prompt: "Some things should stay buried.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "The flames consume it with a shriek. Perhaps that was wisdom.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "crossroads-gamble",
            title: "The Crossroads Gamble",
            text: "A masked figure blocks the road, holding a pair of dice. 'One throw — double your blood, or double my coin.'",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Take the wager",
                        prompt: "A chance to win big — or bleed for it.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Damage,
                            threshold: 20,
                            above: OutcomeDef { text: "Your edge wins the bet. The masked figure tips their hat and vanishes.", hp_delta: 0.0, gold_delta: 80.0 },
                            below: OutcomeDef { text: "You lose badly. The dice were loaded.", hp_delta: -15.0, gold_delta: 0.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Decline",
                        prompt: "Gamblers die broke.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You step around the figure. They mutter something unpleasant.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "arena-challenge",
            title: "The Arena Challenge",
            text: "A champion calls you out by name in the town square. The crowd parts. Both of you know how this ends.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Accept",
                        prompt: "Meet them in the ring.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Damage,
                            threshold: 20,
                            above: OutcomeDef { text: "Bloodied but victorious. The crowd erupts. The purse is substantial.", hp_delta: -5.0, gold_delta: 100.0 },
                            below: OutcomeDef { text: "You take a beating. They throw you some consolation coin.", hp_delta: -20.0, gold_delta: 20.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Refuse",
                        prompt: "Walk away — live to fight another day.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You turn your back on the arena. The champion shouts something after you.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "dark-ritual",
            title: "The Dark Ritual",
            text: "Hooded figures encircle a silver chalice in the moonlight. They gesture for you to approach and share in the rite.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Join them",
                        prompt: "Whatever power they serve, you'll take a share of it.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You emerge from the circle richer, but something has been traded away.", hp_delta: -12.0, gold_delta: 50.0 }),
                    },
                    ChoiceOption {
                        label: "Refuse",
                        prompt: "Some debts cannot be repaid.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You back away into the dark. The chanting resumes without you.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "wounded-traveller",
            title: "The Wounded Traveller",
            text: "A traveller lies bleeding by the road. They reach toward you with trembling hands.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Help them",
                        prompt: "Share your supplies and bind their wounds.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You share what you have. They bless you with grateful eyes — and somehow, you feel stronger for it.", hp_delta: 5.0, gold_delta: -40.0 }),
                    },
                    ChoiceOption {
                        label: "Pass by",
                        prompt: "You cannot save everyone.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You step around them. The weight of it follows you down the road.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "goblin-horde",
            title: "Goblin Horde",
            text: "A pack of goblins blocks the road, chittering and waving crude blades. There are more than expected.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Fight through",
                        prompt: "Cut a path and take what they're carrying.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Damage,
                            threshold: 15,
                            above: OutcomeDef { text: "You scatter them with brutal efficiency. Their pockets yield a surprising haul.", hp_delta: -5.0, gold_delta: 80.0 },
                            below: OutcomeDef { text: "They swarm you from all sides. You escape, barely.", hp_delta: -20.0, gold_delta: 10.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Flee",
                        prompt: "Discretion is the better part of valor.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You sprint away, taking a parting blow from a thrown rock.", hp_delta: -3.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "forbidden-well",
            title: "The Forbidden Well",
            text: "A well of shimmering liquid stands alone in a ruined plaza. A carved warning reads: 'Only the worthy may drink.'",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Drink",
                        prompt: "Take the risk. The worthy always do.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Hp,
                            threshold: 60,
                            above: OutcomeDef { text: "The liquid invigorates your strong frame. You feel invincible.", hp_delta: 20.0, gold_delta: 0.0 },
                            below: OutcomeDef { text: "It burns through your weakened frame like fire. The warning was sincere.", hp_delta: -10.0, gold_delta: 0.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Leave it",
                        prompt: "Carved warnings have earned their place.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You leave the well and its shimmering secret untouched.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "mercenary-camp",
            title: "Mercenary Camp",
            text: "Battle-worn mercenaries have made camp near a stream. Their surgeon leans against a cart of supplies, bored.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Pay for healing",
                        prompt: "100 gold for a proper patch-up.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "Their surgeon works quickly and without sentiment. You leave mended, if poorer.", hp_delta: 20.0, gold_delta: -100.0 }),
                    },
                    ChoiceOption {
                        label: "Move on",
                        prompt: "You've survived worse.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You nod to the mercenaries and keep walking.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "alchemy-lab",
            title: "The Alchemist's Lab",
            text: "An abandoned laboratory contains rare reagents worth a fortune — or enough for one powerful remedy.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Brew a remedy",
                        prompt: "Spend 40 gold in supplies. Results depend on your resilience.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Armor,
                            threshold: 20,
                            above: OutcomeDef { text: "Your steady hands produce a potent cure. The effect is immediate.", hp_delta: 15.0, gold_delta: -40.0 },
                            below: OutcomeDef { text: "The mixture goes wrong. You inhale acrid fumes. Costly in every sense.", hp_delta: -5.0, gold_delta: -40.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Sell the reagents",
                        prompt: "Raw materials fetch good coin at the right market.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You haul the reagents to the nearest alchemist, who pays without complaint.", hp_delta: 0.0, gold_delta: 60.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "treasure-map",
            title: "The Treasure Map",
            text: "A dying thief presses a worn map into your hands. 'It's real,' they whisper. 'Take it. Find it.'",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Follow the map",
                        prompt: "The destination is guarded. Bring your edge.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Damage,
                            threshold: 20,
                            above: OutcomeDef { text: "You cut through the guardians and claim the cache. The thief's dying gift was genuine.", hp_delta: -5.0, gold_delta: 150.0 },
                            below: OutcomeDef { text: "The guardians are tougher than expected. You grab what you can and run.", hp_delta: -5.0, gold_delta: 30.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Sell the map",
                        prompt: "Let someone else risk it — for a finder's fee.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "A merchant's eyes light up. The map fetches fair coin and you keep your skin.", hp_delta: 0.0, gold_delta: 40.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "forsaken-temple",
            title: "The Forsaken Temple",
            text: "An ancient temple wreathed in dark mist. The doors hang open. Somewhere inside, something glitters.",
            kind: EventKind::Choice {
                options: vec![
                    ChoiceOption {
                        label: "Enter",
                        prompt: "The bold claim the treasures the timid leave behind.",
                        effect: ChoiceEffect::StatCheck {
                            stat: StatType::Damage,
                            threshold: 25,
                            above: OutcomeDef { text: "You cut through the temple's guardians and emerge battered and wealthy.", hp_delta: -8.0, gold_delta: 120.0 },
                            below: OutcomeDef { text: "The guardians nearly kill you. You crawl out with barely your life and a handful of coin.", hp_delta: -25.0, gold_delta: 20.0 },
                        },
                    },
                    ChoiceOption {
                        label: "Leave it be",
                        prompt: "Mist and ruin rarely lead to treasure worth taking.",
                        effect: ChoiceEffect::Fixed(OutcomeDef { text: "You walk past the dark threshold and don't look back.", hp_delta: 0.0, gold_delta: 0.0 }),
                    },
                ],
            },
            reveals_boss: None,
        },
        EventDef {
            id: "a_threat_stirs",
            title: "A Threat Stirs",
            text: "A weathered ranger staggers into camp, clutching a report. \"I've tracked it for days,\" she rasps. \"Something stirs in the dark. Gather your allies before it comes to you.\"",
            kind: EventKind::Passive {
                stat: StatType::None,
                tiers: vec![
                    PassiveTier { min_stat: 0, outcome: OutcomeDef { text: "The warning unsettles you, but knowledge is power. A new foe has been marked on your map.", hp_delta: 0.0, gold_delta: 0.0 } },
                ],
            },
            reveals_boss: Some(REVEAL_WEIGHTED),
        },
    ]
}

/// Sentinel `reveals_boss` value: reveal a difficulty-weighted random boss
/// (rather than a specific one) when this event resolves.
pub const REVEAL_WEIGHTED: &str = "__weighted__";

/// Selection weight for an event. The reveal event is weighted up so boss
/// sightings happen on a useful cadence; everything else is uniform.
fn event_weight(e: &EventDef) -> u32 {
    if e.reveals_boss.is_some() { 80 } else { 10 }
}

/// Pick a random event id, avoiding the last `exclude_recent` events.
pub fn pick_event_id(history_event_ids: &[String]) -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let cat = catalogue();
    let recent: std::collections::HashSet<&str> = history_event_ids.iter()
        .rev().take(3).map(|s| s.as_str()).collect();
    let available: Vec<&EventDef> = cat.iter().filter(|e| !recent.contains(e.id)).collect();
    let pool: Vec<&EventDef> = if available.is_empty() { cat.iter().collect() } else { available };
    let total: u32 = pool.iter().map(|e| event_weight(e)).sum();
    let mut roll = rng.gen_range(0..total);
    for e in &pool {
        let w = event_weight(e);
        if roll < w {
            return e.id.to_string();
        }
        roll -= w;
    }
    pool[0].id.to_string()
}

/// Next event date = today + 3–5 days.
pub fn next_event_date(today: chrono::NaiveDate) -> String {
    use rand::Rng;
    let days = rand::thread_rng().gen_range(3i64..=5);
    (today + chrono::Duration::days(days)).format("%Y-%m-%d").to_string()
}

/// Resolve the outcome for a passive event given a stat value.
pub fn resolve_passive<'a>(tiers: &'a [PassiveTier], stat_value: u32) -> &'a OutcomeDef {
    tiers.iter()
        .filter(|t| t.min_stat <= stat_value)
        .last()
        .map(|t| &t.outcome)
        .unwrap_or(&tiers[0].outcome)
}

/// Resolve the outcome for a choice effect given character stats.
pub fn resolve_choice_effect<'a>(
    effect: &'a ChoiceEffect,
    damage: u32,
    armor: u32,
    hp: f64,
) -> &'a OutcomeDef {
    match effect {
        ChoiceEffect::Fixed(outcome) => outcome,
        ChoiceEffect::StatCheck { stat, threshold, above, below } => {
            let val = match stat {
                StatType::Armor => armor,
                StatType::Damage => damage,
                StatType::Hp => hp as u32,
                StatType::None => 0,
            };
            if val >= *threshold { above } else { below }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_reveal_event_exists() {
        let cat = catalogue();
        let count = cat.iter().filter(|e| e.reveals_boss == Some(REVEAL_WEIGHTED)).count();
        assert_eq!(count, 1, "exactly one weighted reveal event expected");
    }

    #[test]
    fn reveal_event_is_weighted_higher() {
        let cat = catalogue();
        let reveal = cat.iter().find(|e| e.reveals_boss.is_some()).unwrap();
        let normal = cat.iter().find(|e| e.reveals_boss.is_none()).unwrap();
        assert!(event_weight(reveal) > event_weight(normal));
    }

    #[test]
    fn pick_event_id_returns_valid_id() {
        let cat = catalogue();
        let id = pick_event_id(&[]);
        assert!(cat.iter().any(|e| e.id == id), "picked id {} not in catalogue", id);
    }
}
