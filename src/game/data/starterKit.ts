import type { ItemId, ItemQualityId } from './items.js';

// What every approved character is issued once, on its first `/play`: enough to
// fight a geared duel and patch up after it. 🟡 Contents are a first guess.
//
// SWITCHED OFF (owner, 2026-11-14): whether and what to hand out is still being
// decided, so nothing is issued. The mechanism stays (service + flag + tests);
// a character that never received a kit still has `starterKitGranted` unset, so
// flipping this back on issues it on their next `/play`.
export const STARTER_KIT_ENABLED = false;

export interface StarterKitEntry {
   itemId: ItemId;
   quality: ItemQualityId;
   quantity: number;
}

export const STARTER_KIT: readonly StarterKitEntry[] = [
   { itemId: 'iron_dagger', quality: 'common', quantity: 1 },
   { itemId: 'leather_jerkin', quality: 'common', quantity: 1 },
   { itemId: 'healers_poultice', quality: 'common', quantity: 2 },
];
