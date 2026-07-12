import type { ClutterDefinition } from './types.js';

// Clutter catalog entries (D28/D50) — spread into ITEMS by ../items.js.
// Ids are append-only (D10).

export const CLUTTER = {
   bent_spoon: {
      kind: 'clutter',
      name: 'Bent Spoon',
      description: 'Slightly bent. It has seen things, yes-yes.',
      material: 'iron',
      weightKg: 0.1,
      value: 1,
   },
   cracked_tankard: {
      kind: 'clutter',
      name: 'Cracked Tankard',
      description: 'Retired from the Sunken Tankard after long and honorable service.',
      material: 'wood',
      weightKg: 0.4,
      value: 2,
   },
   smooth_river_stone: {
      kind: 'clutter',
      name: 'Smooth River Stone',
      description: 'Perfectly ordinary. You picked it up anyway.',
      material: 'stone',
      weightKg: 0.2,
      value: 1,
   },
   mysterious_sock: {
      kind: 'clutter',
      name: 'Mysterious Sock',
      description: 'Just the one. Its partner is a story nobody knows.',
      material: 'cloth',
      weightKg: 0.1,
      value: 1,
   },
} as const satisfies Record<string, ClutterDefinition>;
