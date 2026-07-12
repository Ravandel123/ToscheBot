import type { ShieldDefinition } from './types.js';

// Shield catalog entries (D28/D50) — spread into ITEMS by ../items.js.
// Ids are append-only (D10); 🟡 all numbers are balance placeholders.

export const SHIELDS = {
   wooden_buckler: {
      kind: 'shield',
      name: 'Wooden Buckler',
      description: 'A fist-sized answer to sharp questions.',
      material: 'wood',
      weightKg: 1.5,
      value: 20,
      slots: ['offHand'],
      armor: 1,
      durabilityMax: 40,
   },
   iron_kite_shield: {
      kind: 'shield',
      name: 'Iron Kite Shield',
      description: 'Covers you from chin to shin, provided you can lug it.',
      material: 'iron',
      weightKg: 4.5,
      value: 130,
      slots: ['offHand'],
      armor: 2,
      durabilityMax: 80,
      attributeRequirements: { strength: 30 },
      attributeModifiers: { agility: -5 },
   },
} as const satisfies Record<string, ShieldDefinition>;
