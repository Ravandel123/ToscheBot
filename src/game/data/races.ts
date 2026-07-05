import type { AttributeKey } from './attributes.js';

// The seven anthropomorphic races of Dunia (BtWD). `attributeModifiers` are the
// hardcoded racial bases from RPG/Ruleset.md §4 (mapped onto the owner's P5
// attribute set: Toughness→Endurance, Fellowship→Charisma): +5 to two, −5 to
// two — net zero, applied to ATTRIBUTE_BASE. 🟡 Balance values, tunable there.

export interface RaceDefinition {
   name: string;
   description: string;
   /** Net-zero ±5 shifts applied to ATTRIBUTE_BASE (unlisted attributes = ±0). */
   attributeModifiers: Partial<Record<AttributeKey, number>>;
}

export const RACES = {
   canid: {
      name: 'Canid',
      description: 'Soldiers of militaristic Aisling — disciplined, martial.',
      attributeModifiers: { strength: 5, willpower: 5, agility: -5, charisma: -5 },
   },
   ermehn: {
      name: 'Ermehn',
      description: 'Exiles of the frozen Northern Wastes — tattooed, tribal, hardy.',
      attributeModifiers: { agility: 5, dexterity: 5, strength: -5, charisma: -5 },
   },
   felis: {
      name: 'Felis',
      description: 'Scholars of Kishar — clever, aloof.',
      attributeModifiers: { agility: 5, intelligence: 5, strength: -5, endurance: -5 },
   },
   lutren: {
      name: 'Lutren',
      description: 'Seafarers of coastal Lutra — proud, devout.',
      attributeModifiers: { dexterity: 5, charisma: 5, strength: -5, willpower: -5 },
   },
   polcan: {
      name: 'Polcan',
      description: 'Stateless exiles of the Western Sea — piratical, bronze-clad.',
      attributeModifiers: { strength: 5, endurance: 5, agility: -5, charisma: -5 },
   },
   tamian: {
      name: 'Tamian',
      description: 'Treetop dwellers of forest Terria — agile, industrious.',
      attributeModifiers: { agility: 5, perception: 5, strength: -5, endurance: -5 },
   },
   vulpin: {
      name: 'Vulpin',
      description: 'Cosmopolitans of desert Navran — accommodating, worldly.',
      attributeModifiers: { charisma: 5, intelligence: 5, strength: -5, willpower: -5 },
   },
} as const satisfies Record<string, RaceDefinition>;

export type RaceId = keyof typeof RACES;
