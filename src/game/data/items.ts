import { FORAGABLE_ITEMS } from './foragables.js';
import { ARMOR } from './items/armor.js';
import { CLUTTER } from './items/clutter.js';
import { CONSUMABLES } from './items/consumables.js';
import { CRAFTING_MATERIALS } from './items/craftingMaterials.js';
import { SHIELDS } from './items/shields.js';
import type { ItemDefinition } from './items/types.js';
import { WEAPONS } from './items/weapons.js';

// The item catalog (D28) — static content in code (D10): the DB stores only
// item INSTANCES ({ instanceId, itemId, quality, quantity, durability })
// referencing these definitions by stable slug. This file is the FACADE (D50):
// the type system lives in items/types.ts, the entries in one items/ file per
// kind — everything is re-exported here, so consumers only ever import
// './items.js'. Adding an item = one entry in its kind's file; adding a kind =
// a union member + ITEM_KINDS entry in types.ts + a new catalog file spread
// into ITEMS below. Ids are append-only (D10): never rename or delete one
// that may live in a character doc.

export * from './items/types.js';

// Spread order = display order within a kind (the panel's category tabs come
// from ITEM_KINDS). Foraged materials keep their profession-only layer
// (families, looks, identify difficulty) in foragables.ts (D43) and are spread
// in here so a foraged find is an ordinary `material` instance everywhere else.
export const ITEMS = {
   ...WEAPONS,
   ...SHIELDS,
   ...ARMOR,
   ...CONSUMABLES,
   ...FORAGABLE_ITEMS,
   ...CRAFTING_MATERIALS,
   ...CLUTTER,
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function isItemId(id: string): id is ItemId {
   return id in ITEMS;
}

/** Resolves a stored item id, tolerating unknown ones (D10 rule 3: a rename
 *  that skipped migration must degrade gracefully, not crash the panel). */
export function itemDefinition(id: string): ItemDefinition | null {
   return isItemId(id) ? ITEMS[id] : null;
}
