import { randomUUID } from 'node:crypto';
import { Item, type ItemDoc } from '../models/item.js';
import { Character } from '../models/character.js';
import { characterService } from './characterService.js';
import {
   INVENTORY_STACK_LIMIT,
   inventoryOf,
   mintInstanceId,
   slotOfInstance,
   type ItemInstance,
} from '../../game/character/inventory.js';
import {
   STASH_PAGE_SIZE,
   STASH_SORTS,
   canWithdrawInto,
   itemIdsOfKind,
   tallyKinds,
   type StashSortId,
} from '../../game/character/stash.js';
import { isStorageContainerId } from '../../game/data/containers.js';
import { DEFAULT_ITEM_QUALITY, isItemQualityId, itemDefinition, type ItemKindId } from '../../game/data/items.js';

// Stash reads + transfers (D33). CONTRACT: deposit/withdraw run under the
// character's lock (`client.locks.runExclusive`) — same as inventoryService —
// so the pack side is read-decide-write-safe against the player's own panels.
// Cross-collection transfers are NOT transactional (the codebase deliberately
// stays single-doc atomic, D5/D6); instead each transfer INSERTS the destination
// copy BEFORE removing the source, so the failure mode of a crash mid-transfer
// is a recoverable DUPLICATE, never a lost item (favor-duplicate-over-loss).
// Reads NEVER load the whole stash: category pages and counts run server-side.

export interface StashPage {
   docs: ItemDoc[];
   /** The page actually returned (clamped — deletions can strand a stored page). */
   page: number;
   pageCount: number;
   totalCount: number;
}

export type DepositResult =
   | { ok: true }
   | { ok: false; reason: 'not-found' | 'unknown-container' };

export type WithdrawResult =
   | { ok: true }
   | { ok: false; reason: 'not-found' | 'unknown-container' | 'inventory-full' | 'too-heavy' };

export const itemService = {
   /** Entries per catalog kind in one container — a server-side itemId roll-up
    *  (≤ catalog-size rows), so the whole stash never loads. Powers the hub tabs. */
   async countByKind(ownerId: string, container: string): Promise<Record<ItemKindId, number>> {
      const rows = await Item.aggregate<{ _id: string; count: number }>([
         { $match: { ownerId, container } },
         { $group: { _id: '$itemId', count: { $sum: 1 } } },
      ]);

      return tallyKinds(rows.map((row) => ({ itemId: row._id, count: row.count })));
   },

   /** One sorted, paged category of a container — a true server-side page
    *  (kind → the catalog itemId `$in` set; sort → a stored-field Mongo sort). */
   async browseStash(ownerId: string, container: string, kind: ItemKindId, sort: StashSortId, page: number): Promise<StashPage> {
      const filter = { ownerId, container, itemId: { $in: itemIdsOfKind(kind) } };

      const totalCount = await Item.countDocuments(filter);
      const pageCount = Math.max(1, Math.ceil(totalCount / STASH_PAGE_SIZE));
      const clampedPage = Math.min(Math.max(0, page), pageCount - 1);

      const docs = await Item.find(filter)
         .sort({ acquiredAt: STASH_SORTS[sort].direction, _id: 1 })
         .skip(clampedPage * STASH_PAGE_SIZE)
         .limit(STASH_PAGE_SIZE)
         .lean<ItemDoc[]>();

      return { docs, page: clampedPage, pageCount, totalCount };
   },

   /** The single stash entry a customId points at (owner-scoped), or null. */
   async getStashItem(ownerId: string, container: string, instanceId: string): Promise<ItemDoc | null> {
      return Item.findOne({ ownerId, container, instanceId }).lean<ItemDoc>();
   },

   /**
    * Moves a whole pack entry into a container. Insert-then-remove: the stash
    * copy lands first (item safe), then the pack entry is pulled (and any slot
    * it referenced vacated, as a stale-click safety net). A crash between the
    * two leaves a recoverable duplicate, never a loss.
    */
   async deposit(characterId: string, container: string, instanceId: string): Promise<DepositResult> {
      if (!isStorageContainerId(container))
         return { ok: false, reason: 'unknown-container' };

      const character = await characterService.get(characterId);
      const packItem = character ? inventoryOf(character).find((item) => item.instanceId === instanceId) : undefined;
      if (!character || !packItem)
         return { ok: false, reason: 'not-found' };

      // A stash handle unique within the owner's whole stash so { ownerId,
      // container, instanceId } resolves exactly one doc and rides customIds.
      // Uniqueness comes from the { ownerId, instanceId } unique index: mint
      // and insert, re-minting on the rare collision — never a stash-wide read.
      const docId = randomUUID();
      const doc = {
         _id: docId,
         ownerId: characterId,
         container,
         itemId: packItem.itemId,
         quality: packItem.quality,
         quantity: packItem.quantity,
         ...(packItem.durability === undefined ? {} : { durability: packItem.durability }),
         acquiredAt: packItem.acquiredAt instanceof Date ? packItem.acquiredAt : new Date(),
         // The identification veil (R16) survives the transfer — a stored
         // mystery is still a mystery when withdrawn.
         ...(packItem.identified === undefined ? {} : { identified: packItem.identified }),
         ...(packItem.apparentItemId === undefined ? {} : { apparentItemId: packItem.apparentItemId }),
         ...(packItem.descriptorId === undefined ? {} : { descriptorId: packItem.descriptorId }),
      };
      await insertWithFreshHandle(doc);

      const slot = slotOfInstance(character, instanceId);
      const update: Record<string, unknown> = { $pull: { inventory: { instanceId } } };
      if (slot)
         update.$unset = { [`equipment.${slot}`]: '' };

      const result = await Character.updateOne({ _id: characterId, 'inventory.instanceId': instanceId }, update);
      if (result.modifiedCount === 0) {
         // The pack entry vanished between our read and the pull (should not
         // happen under the lock) — roll back the stash copy so it isn't orphaned.
         await Item.deleteOne({ _id: docId });
         return { ok: false, reason: 'not-found' };
      }

      return { ok: true };
   },

   /**
    * Moves a whole container entry back into the pack (re-checking the carry
    * limit — the pack is capped, the stash is not). Push-then-delete: the pack
    * copy lands first (item safe) with a fresh pack instance id, then the stash
    * doc is deleted. A crash between leaves a recoverable duplicate, never a loss.
    */
   async withdraw(characterId: string, container: string, instanceId: string): Promise<WithdrawResult> {
      if (!isStorageContainerId(container))
         return { ok: false, reason: 'unknown-container' };

      const doc = await Item.findOne({ ownerId: characterId, container, instanceId }).lean<ItemDoc>();
      if (!doc)
         return { ok: false, reason: 'not-found' };

      const character = await characterService.get(characterId);
      if (!character)
         return { ok: false, reason: 'not-found' };

      const definition = itemDefinition(doc.itemId);
      if (definition) {
         const fit = canWithdrawInto(character, definition, doc.quantity);
         if (!fit.ok)
            return fit;
      } else if (inventoryOf(character).length + 1 > INVENTORY_STACK_LIMIT) {
         // Unknown item id (a retired catalog entry, D10 rule 3): still bound the
         // pack, but there is no weight to check.
         return { ok: false, reason: 'inventory-full' };
      }

      const instance: ItemInstance = {
         instanceId: mintInstanceId(new Set(inventoryOf(character).map((item) => item.instanceId))),
         itemId: doc.itemId,
         quality: isItemQualityId(doc.quality) ? doc.quality : DEFAULT_ITEM_QUALITY,
         quantity: doc.quantity,
         ...(doc.durability === undefined ? {} : { durability: doc.durability }),
         acquiredAt: doc.acquiredAt instanceof Date ? doc.acquiredAt : new Date(),
         ...(doc.identified === undefined ? {} : { identified: doc.identified }),
         ...(doc.apparentItemId === undefined ? {} : { apparentItemId: doc.apparentItemId }),
         ...(doc.descriptorId === undefined ? {} : { descriptorId: doc.descriptorId }),
      };

      await Character.updateOne({ _id: characterId }, { $push: { inventory: instance } });
      await Item.deleteOne({ _id: doc._id });

      return { ok: true };
   },
};

/** Inserts a stash doc with a freshly minted handle, re-minting when the
 *  { ownerId, instanceId } unique index rejects a collision. With an 8-hex
 *  handle space a retry is nearly impossible; running out means something is
 *  broken enough to surface as an error. */
async function insertWithFreshHandle(doc: Omit<ItemDoc, 'instanceId' | 'createdAt' | 'updatedAt'>): Promise<void> {
   for (let attempt = 0; attempt < 5; attempt++)
      try {
         await Item.create({ ...doc, instanceId: mintInstanceId(new Set()) });
         return;
      } catch (error) {
         if (!isDuplicateKeyError(error))
            throw error;
      }

   throw new Error(`Could not mint a unique stash handle for owner ${doc.ownerId}.`);
}

function isDuplicateKeyError(error: unknown): boolean {
   return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}
