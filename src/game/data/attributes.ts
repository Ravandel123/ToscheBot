// The eight attributes of the server RPG — the owner's set (resolves RPG/'s P5
// fork, 2026-07-03; Luck was dropped). Values live on the d100 roll-under scale
// designed in RPG/Ruleset.md: every race starts from ATTRIBUTE_BASE shifted by
// its `attributeModifiers` (races.ts), plus the creation point-buy
// (game/character/attributes.ts). Consumed by d100 checks (game/checks.ts).

export interface AttributeDefinition {
   name: string;
   abbreviation: string;
}

export const ATTRIBUTES = {
   strength: { name: 'Strength', abbreviation: 'STR' },
   endurance: { name: 'Endurance', abbreviation: 'END' },
   agility: { name: 'Agility', abbreviation: 'AGI' },
   dexterity: { name: 'Dexterity', abbreviation: 'DEX' },
   charisma: { name: 'Charisma', abbreviation: 'CHA' },
   willpower: { name: 'Willpower', abbreviation: 'WIL' },
   perception: { name: 'Perception', abbreviation: 'PER' },
   intelligence: { name: 'Intelligence', abbreviation: 'INT' },
} as const satisfies Record<string, AttributeDefinition>;

export type AttributeKey = keyof typeof ATTRIBUTES;

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTES) as AttributeKey[];

/** The species-neutral baseline every racial modifier shifts (RPG/Ruleset.md §4). */
export const ATTRIBUTE_BASE = 25;
