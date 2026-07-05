import {
   INVENTORY_PAGE_SIZE,
   INVENTORY_STACK_LIMIT,
   carriedWeightKg,
   carryCapacityKg,
   inventoryOf,
   type EquipSubject,
   type ItemInstance,
   type ResolvedItem,
} from './inventory.js';
import { ITEMS, ITEM_IDS, ITEM_KINDS, ITEM_KIND_IDS, itemDefinition, type ItemDefinition, type ItemKindId } from '../data/items.js';
import { DEFAULT_CONTAINER, isStorageContainerId, type StorageContainerId } from '../data/containers.js';

// Pure stash rules (D33) — no Discord, no DB. The stash is the character's
// owned-but-not-carried items, living in their OWN `Item` collection (one doc
// per instance/stack) rather than embedded on the character, because a hoard is
// UNBOUNDED (D32) and must never tax a hot-path character read. This module owns
// the browse-state that rides in customIds and the pure withdraw-eligibility
// check; itemService owns the (paginated, server-side) reads and the lock-held
// transfers. Whole entries move as a unit — partial-stack transfers are deferred
// (same scope call as partial-stack drops, D28).

// The stash pages server-side, so its sorts must be expressible as a Mongo sort
// on a STORED field. `acquiredAt` is the only one that qualifies without
// denormalizing catalog data (names/values are resolved from code, D10) — the
// pack keeps the richer name/weight/value sorts. `direction` feeds `.sort()`.
export interface StashSortDefinition {
   name: string;
   /** Mongo sort direction on `acquiredAt`. */
   direction: 1 | -1;
}

export const STASH_SORTS = {
   newest: { name: 'Newest first', direction: -1 },
   oldest: { name: 'Oldest first', direction: 1 },
} as const satisfies Record<string, StashSortDefinition>;

export type StashSortId = keyof typeof STASH_SORTS;

export const DEFAULT_STASH_SORT: StashSortId = 'newest';

export const STASH_PAGE_SIZE = INVENTORY_PAGE_SIZE;

/** Category + sort + page WITHIN a container, packed as 'home_chest.weapon.newest.0'
 *  to ride in customIds (D33). Mirrors the pack's BrowseState with a container axis. */
export interface StashBrowseState {
   container: StorageContainerId;
   kind: ItemKindId;
   sort: StashSortId;
   page: number;
}

export function stashBrowseState(
   container: StorageContainerId = DEFAULT_CONTAINER,
   kind: ItemKindId = ITEM_KIND_IDS[0],
   sort: StashSortId = DEFAULT_STASH_SORT,
   page = 0,
): StashBrowseState {
   return { container, kind, sort, page };
}

export function packStashState(state: StashBrowseState): string {
   return `${state.container}.${state.kind}.${state.sort}.${state.page}`;
}

/** Parses a packed stash browse state, falling back field-by-field on anything stale. */
export function parseStashState(raw: string | undefined): StashBrowseState {
   const [container, kind, sort, page] = (raw ?? '').split('.');
   const parsedPage = Number.parseInt(page ?? '', 10);

   return {
      container: container && isStorageContainerId(container) ? container : DEFAULT_CONTAINER,
      kind: kind && kind in ITEM_KINDS ? kind as ItemKindId : ITEM_KIND_IDS[0],
      sort: sort && sort in STASH_SORTS ? sort as StashSortId : DEFAULT_STASH_SORT,
      page: Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0,
   };
}

// --- Withdraw eligibility (the pack has a carry limit; the stash does not) --------

export type WithdrawFitCheck =
   | { ok: true }
   | { ok: false; reason: 'inventory-full' | 'too-heavy' };

/** Whether a withdrawn entry fits back into the pack. A withdrawn stack lands as
 *  ONE new entry (no auto-merge — that keeps the transfer idempotent, D33), so
 *  it always costs one slot against INVENTORY_STACK_LIMIT plus its full weight. */
export function canWithdrawInto(character: EquipSubject, definition: ItemDefinition, quantity: number): WithdrawFitCheck {
   if (inventoryOf(character).length + 1 > INVENTORY_STACK_LIMIT)
      return { ok: false, reason: 'inventory-full' };

   if (carriedWeightKg(character) + definition.weightKg * quantity > carryCapacityKg(character))
      return { ok: false, reason: 'too-heavy' };

   return { ok: true };
}

// --- Resolving a stored stash instance to a display item --------------------------

/** Pairs a stored stash instance with its catalog definition, dropping unknown
 *  item ids from view (they stay in the collection untouched — D10 rule 3). This
 *  is what lets the stash panel reuse the `/inventory` item renderers verbatim. */
export function resolveStashInstance(instance: ItemInstance): ResolvedItem | null {
   const definition = itemDefinition(instance.itemId);
   return definition ? { instance, definition } : null;
}

/** Total entries of a container split by catalog kind — computed from a
 *  server-side itemId→count roll-up, so the whole stash never loads (D33). */
export function tallyKinds(itemIdCounts: Iterable<{ itemId: string; count: number }>): Record<ItemKindId, number> {
   const counts = Object.fromEntries(ITEM_KIND_IDS.map((kind) => [kind, 0])) as Record<ItemKindId, number>;

   for (const { itemId, count } of itemIdCounts) {
      const definition = itemDefinition(itemId);
      if (definition)
         counts[definition.kind] += count;
   }

   return counts;
}

/** The catalog item ids of one kind — the `$in` set a server-side category page
 *  filters on (kind is not stored on the Item doc; it derives from itemId). */
export function itemIdsOfKind(kind: ItemKindId): string[] {
   return ITEM_IDS.filter((id) => ITEMS[id].kind === kind);
}
