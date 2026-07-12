import type { CraftingMaterialDefinition } from './types.js';

// Crafting-material catalog entries (D28/D50) — spread into ITEMS by ../items.js.
// FORAGED materials live in ../foragables.ts instead (they carry the D43
// profession layer: families, looks, identify difficulty) and are spread into
// ITEMS alongside these. Ids are append-only (D10); 🟡 numbers are placeholders.

export const CRAFTING_MATERIALS = {
   iron_ingot: {
      kind: 'material',
      name: 'Iron Ingot',
      description: 'Waiting to become something sharper.',
      material: 'iron',
      weightKg: 2.0,
      value: 20,
   },
   oak_timber: {
      kind: 'material',
      name: 'Oak Timber',
      description: 'Seasoned heartwood. Shields, hafts, honest furniture.',
      material: 'wood',
      weightKg: 4.0,
      value: 10,
   },
   linen_bolt: {
      kind: 'material',
      name: 'Bolt of Linen',
      description: 'Bandages, banners, or a better shirt — weaver\'s choice.',
      material: 'cloth',
      weightKg: 1.0,
      value: 15,
   },
   carp_scales: {
      kind: 'material',
      name: 'Carp Scales',
      description: 'They catch the light. Some tamian pay for the shimmer.',
      material: 'bone',
      weightKg: 0.1,
      value: 2,
   },
} as const satisfies Record<string, CraftingMaterialDefinition>;
