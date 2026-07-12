import type { ConsumableDefinition } from './types.js';

// Consumable catalog entries (D28/D50) — spread into ITEMS by ../items.js.
// Ids are append-only (D10); 🟡 all effects/values are balance placeholders.

export const CONSUMABLES = {
   travel_rations: {
      kind: 'consumable',
      name: 'Travel Rations',
      description: 'Hardtack, dried carp, a knot of honeyed oats. Not good — enough.',
      weightKg: 0.5,
      value: 8,
      effects: { stamina: 5 },
   },
   dried_carp: {
      kind: 'consumable',
      name: 'Dried Carp',
      description: 'The riverbank\'s honest coin. Chewy.',
      weightKg: 0.3,
      value: 4,
      effects: { stamina: 3 },
   },
   healers_poultice: {
      kind: 'consumable',
      name: 'Healer\'s Poultice',
      description: 'Herbs and clean linen from the infirmary. Stings enough to know it works.',
      material: 'cloth',
      weightKg: 0.2,
      value: 30,
      effects: { health: 5 },
   },
   honeyed_mead: {
      kind: 'consumable',
      name: 'Honeyed Mead',
      description: 'The Sunken Tankard\'s cheapest cask. Courage by the mug.',
      weightKg: 1.0,
      value: 12,
      effects: { stamina: 2, health: 1 },
   },
} as const satisfies Record<string, ConsumableDefinition>;
