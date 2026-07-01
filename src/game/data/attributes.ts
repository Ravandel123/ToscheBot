export interface AttributeDefinition {
   name: string;
   abbreviation: string;
   default: number;
}

export const ATTRIBUTES = {
   strength: { name: 'Strength', abbreviation: 'STR', default: 10 },
   toughness: { name: 'Toughness', abbreviation: 'TOU', default: 10 },
   agility: { name: 'Agility', abbreviation: 'AGI', default: 10 },
   dexterity: { name: 'Dexterity', abbreviation: 'DEX', default: 10 },
   perception: { name: 'Perception', abbreviation: 'PER', default: 10 },
   intelligence: { name: 'Intelligence', abbreviation: 'INT', default: 10 },
   willpower: { name: 'Willpower', abbreviation: 'WIL', default: 10 },
   charisma: { name: 'Charisma', abbreviation: 'CHA', default: 10 },
   luck: { name: 'Luck', abbreviation: 'LCK', default: 10 },
} as const satisfies Record<string, AttributeDefinition>;

export type AttributeKey = keyof typeof ATTRIBUTES;
