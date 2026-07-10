import { Character } from '../models/character.js';
import { characterService } from './characterService.js';
import {
   canAddItems,
   createItemInstance,
   findItem,
   findStack,
   inventoryOf,
   qualityOf,
   slotOfInstance,
   type EquipPlan,
   type ItemInstance,
   type MysteryFields,
} from '../../game/character/inventory.js';
import { ITEM_KINDS, itemDefinition, type ConsumableDefinition, type ItemQualityId } from '../../game/data/items.js';
import type { EquipmentSlotId } from '../../game/data/equipmentSlots.js';

// Inventory writes (D28). CONTRACT: callers hold the character's lock
// (`client.locks.runExclusive`) around read-decide-write flows — that is what
// makes two open panels / a panel + a command safe against each other. Every
// write here is ADDITIONALLY filter-guarded on the exact instance it touches,
// so a stale request (item dropped from another window a heartbeat ago)
// degrades to a typed failure the panel can explain, never a corrupt doc.

export type GrantResult =
   | { ok: true; instanceId: string }
   | { ok: false; reason: 'not-found' | 'unknown-item' | 'inventory-full' | 'too-heavy' };

export type RemoveResult =
   | { ok: true; removed: ItemInstance }
   | { ok: false; reason: 'not-found' };

export type ConsumeResult =
   | { ok: true; definition: ConsumableDefinition; depleted: boolean }
   | { ok: false; reason: 'not-found' | 'not-consumable' };

export const inventoryService = {
   /** Adds items to a character's pack, merging into an existing stack where
    *  the kind allows it (stack key = itemId + quality). Non-stackables arrive
    *  as `quantity` separate instances. A `mystery` grant (an unidentified/
    *  mislabeled find, R16) never merges — its veil is per-instance state.
    *  Enforces the stack cap and carry capacity — the only entry point for
    *  items coming into the world. */
   async grantItems(characterId: string, itemId: string, quality: ItemQualityId, quantity: number, mystery?: MysteryFields): Promise<GrantResult> {
      const amount = Math.max(1, Math.floor(quantity));
      const definition = itemDefinition(itemId);
      if (!definition)
         return { ok: false, reason: 'unknown-item' };

      const character = await characterService.get(characterId);
      if (!character)
         return { ok: false, reason: 'not-found' };

      const check = canAddItems(character, itemId, definition, quality, amount, mystery !== undefined);
      if (!check.ok)
         return check;

      if (check.stackWith) {
         await Character.updateOne(
            { _id: characterId, 'inventory.instanceId': check.stackWith.instanceId },
            { $inc: { 'inventory.$.quantity': amount } },
         );
         return { ok: true, instanceId: check.stackWith.instanceId };
      }

      // Stackables land as ONE entry carrying the quantity; non-stackables
      // (gear with its own durability) as one instance per unit.
      const existingIds = new Set(inventoryOf(character).map((item) => item.instanceId));
      const instances: ItemInstance[] = [];
      const perInstanceQuantities = ITEM_KINDS[definition.kind].stackable ? [amount] : Array<number>(amount).fill(1);

      for (const perInstance of perInstanceQuantities) {
         const instance = createItemInstance(itemId, definition, quality, perInstance, existingIds, mystery);
         existingIds.add(instance.instanceId);
         instances.push(instance);
      }

      await Character.updateOne({ _id: characterId }, { $push: { inventory: { $each: instances } } });
      return { ok: true, instanceId: instances[0].instanceId };
   },

   /**
    * Applies an Examine outcome (R16, game/professions/identify.ts) to one
    * pack instance. CONTRACT: the caller holds the character lock. 'reveal'
    * lifts the veil and — for stackable kinds — merges the now-known find into
    * an existing identified stack (inc-before-pull: a crash duplicates, never
    * loses, D33's transfer principle). 'mislabel' stamps the confident wrong
    * id. Returns the instanceId the item now lives under (the merge target's
    * on a merge), or null when the instance vanished (stale click).
    */
   async applyIdentification(characterId: string, instanceId: string, outcome: { apply: 'reveal' } | { apply: 'mislabel'; apparentItemId: string }): Promise<string | null> {
      const character = await characterService.get(characterId);
      const item = character ? findItem(character, instanceId) : null;
      if (!character || !item)
         return null;

      if (outcome.apply === 'mislabel') {
         // matchedCount, not modifiedCount: re-stamping the same label is a
         // no-op $set the in-memory mongod misreports (CLAUDE.md caveat).
         const result = await Character.updateOne(
            { _id: characterId, 'inventory.instanceId': instanceId },
            { $set: { 'inventory.$.identified': false, 'inventory.$.apparentItemId': outcome.apparentItemId } },
         );
         return result.matchedCount > 0 ? instanceId : null;
      }

      const revealed = await Character.updateOne(
         { _id: characterId, 'inventory.instanceId': instanceId },
         { $set: { 'inventory.$.identified': true }, $unset: { 'inventory.$.apparentItemId': '', 'inventory.$.descriptorId': '' } },
      );
      if (revealed.matchedCount === 0)
         return null;

      // Merge into an existing identified stack of the same (item, quality),
      // now that nothing distinguishes them. Same-doc writes under the lock.
      const target = ITEM_KINDS[item.definition.kind].stackable ? findStack(character, item.instance.itemId, qualityOf(item.instance)) : null;
      if (!target || target.instanceId === instanceId)
         return instanceId;

      const merged = await Character.updateOne(
         { _id: characterId, 'inventory.instanceId': target.instanceId },
         { $inc: { 'inventory.$.quantity': item.instance.quantity } },
      );
      if (merged.matchedCount === 0)
         return instanceId;

      await Character.updateOne({ _id: characterId }, { $pull: { inventory: { instanceId } } });
      return target.instanceId;
   },

   /** Drops a whole inventory entry (stack or single item), vacating any
    *  equipment slot that referenced it — one atomic write. Works even for
    *  items whose catalog id was retired (cleanup must never be impossible). */
   async removeStack(characterId: string, instanceId: string): Promise<RemoveResult> {
      const character = await characterService.get(characterId);
      const removed = character ? inventoryOf(character).find((item) => item.instanceId === instanceId) : undefined;
      if (!character || !removed)
         return { ok: false, reason: 'not-found' };

      const slot = slotOfInstance(character, instanceId);
      const update: Record<string, unknown> = { $pull: { inventory: { instanceId } } };
      if (slot)
         update.$unset = { [`equipment.${slot}`]: '' };

      const result = await Character.updateOne({ _id: characterId, 'inventory.instanceId': instanceId }, update);
      return result.modifiedCount > 0 ? { ok: true, removed } : { ok: false, reason: 'not-found' };
   },

   /** Applies a planEquip result: one $set of the target slot plus any slots
    *  the plan vacates. Guarded on the equipped instance still existing. */
   async applyEquipPlan(characterId: string, plan: EquipPlan): Promise<boolean> {
      const set: Record<string, string> = {};
      for (const [slot, instanceId] of Object.entries(plan.set))
         set[`equipment.${slot}`] = instanceId;

      const [equippedId] = Object.values(plan.set);
      const update: Record<string, unknown> = { $set: set };
      if (plan.clear.length > 0)
         update.$unset = Object.fromEntries(plan.clear.map((slot) => [`equipment.${slot}`, '']));

      const result = await Character.updateOne(
         { _id: characterId, ...(equippedId ? { 'inventory.instanceId': equippedId } : {}) },
         update,
      );
      return result.modifiedCount > 0;
   },

   /** Unequips whatever occupies `slot` (the item stays in the pack). Returns
    *  false when the slot was already empty (a stale click). */
   async clearEquipmentSlot(characterId: string, slot: EquipmentSlotId): Promise<boolean> {
      const result = await Character.updateOne(
         { _id: characterId, [`equipment.${slot}`]: { $exists: true } },
         { $unset: { [`equipment.${slot}`]: '' } },
      );
      return result.modifiedCount > 0;
   },

   /** Uses one charge of a consumable: quantity-guarded decrement, then the
    *  catalog effects as a clamped resource delta, then stack cleanup. */
   async consumeItem(characterId: string, instanceId: string): Promise<ConsumeResult> {
      const character = await characterService.get(characterId);
      const item = character ? findItem(character, instanceId) : null;
      if (!item)
         return { ok: false, reason: 'not-found' };
      if (item.definition.kind !== 'consumable')
         return { ok: false, reason: 'not-consumable' };

      // The $gte guard makes a double-click burn at most what exists.
      const result = await Character.updateOne(
         { _id: characterId, inventory: { $elemMatch: { instanceId, quantity: { $gte: 1 } } } },
         { $inc: { 'inventory.$.quantity': -1 } },
      );
      if (result.modifiedCount === 0)
         return { ok: false, reason: 'not-found' };

      await Character.updateOne({ _id: characterId }, { $pull: { inventory: { instanceId, quantity: { $lte: 0 } } } });
      await characterService.applyResourceDeltas(characterId, item.definition.effects);

      return { ok: true, definition: item.definition, depleted: item.instance.quantity <= 1 };
   },
};
