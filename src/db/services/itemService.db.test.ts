import { describe, expect, it } from 'vitest';
import { itemService } from './itemService.js';
import { inventoryService } from './inventoryService.js';
import { characterService } from './characterService.js';
import { Character } from '../models/character.js';
import { useTestDb } from '../../testing/memoryDb.js';
import { inventoryOf } from '../../game/character/inventory.js';
import { DEFAULT_CONTAINER } from '../../game/data/containers.js';

// The D33 transfers are cross-collection and deliberately NON-transactional
// (insert-before-remove, favor-duplicate-over-loss). Only a real two-collection
// DB shows the pack-side $pull, the Item-side insert, and the carry-capacity
// re-check on withdraw actually cohere.
useTestDb();

async function withDagger() {
   const character = await characterService.create('owner-1', { name: 'Packrat', race: 'canid' });
   const grant = await inventoryService.grantItems(character._id, 'iron_dagger', 'common', 1);
   if (!grant.ok)
      throw new Error(`grant failed: ${grant.reason}`);
   return { characterId: character._id, instanceId: grant.instanceId };
}

describe('itemService.deposit (pack → stash)', () => {
   it('moves a pack entry into the container and out of the pack', async () => {
      const { characterId, instanceId } = await withDagger();

      const result = await itemService.deposit(characterId, DEFAULT_CONTAINER, instanceId);
      expect(result).toEqual({ ok: true });

      const character = await characterService.get(characterId);
      expect(inventoryOf(character!)).toHaveLength(0);

      const page = await itemService.browseStash(characterId, DEFAULT_CONTAINER, 'weapon', 'newest', 0);
      expect(page.totalCount).toBe(1);
      expect(page.docs[0]?.itemId).toBe('iron_dagger');
   });

   it('rejects an unknown container without touching the pack', async () => {
      const { characterId, instanceId } = await withDagger();

      const result = await itemService.deposit(characterId, 'no_such_place', instanceId);

      expect(result).toEqual({ ok: false, reason: 'unknown-container' });
      expect(inventoryOf((await characterService.get(characterId))!)).toHaveLength(1);
   });

   it('rejects a stale/unknown instance id', async () => {
      const { characterId } = await withDagger();

      const result = await itemService.deposit(characterId, DEFAULT_CONTAINER, 'deadbeef');

      expect(result).toEqual({ ok: false, reason: 'not-found' });
   });
});

describe('itemService.withdraw (stash → pack)', () => {
   it('round-trips an item back into the pack and empties the stash', async () => {
      const { characterId, instanceId } = await withDagger();
      await itemService.deposit(characterId, DEFAULT_CONTAINER, instanceId);

      const stored = await itemService.browseStash(characterId, DEFAULT_CONTAINER, 'weapon', 'newest', 0);
      const handle = stored.docs[0].instanceId;

      const result = await itemService.withdraw(characterId, DEFAULT_CONTAINER, handle);
      expect(result).toEqual({ ok: true });

      const character = await characterService.get(characterId);
      expect(inventoryOf(character!)).toHaveLength(1);
      expect(inventoryOf(character!)[0].itemId).toBe('iron_dagger');

      const after = await itemService.browseStash(characterId, DEFAULT_CONTAINER, 'weapon', 'newest', 0);
      expect(after.totalCount).toBe(0);
   });

   it('refuses to withdraw past carry capacity (the pack is capped, the stash is not)', async () => {
      // Grant a heavy maul while strong enough to carry it, stash it, then become
      // too weak — the stash keeps it, but it no longer fits the pack.
      const character = await characterService.create('owner-2', { name: 'Weakling', race: 'canid' });
      const grant = await inventoryService.grantItems(character._id, 'war_maul', 'common', 1);
      if (!grant.ok)
         throw new Error(`grant failed: ${grant.reason}`);
      await itemService.deposit(character._id, DEFAULT_CONTAINER, grant.instanceId);

      await Character.updateOne({ _id: character._id }, { $set: { 'attributes.strength': 3 } });
      const stored = await itemService.browseStash(character._id, DEFAULT_CONTAINER, 'weapon', 'newest', 0);

      const result = await itemService.withdraw(character._id, DEFAULT_CONTAINER, stored.docs[0].instanceId);

      expect(result).toEqual({ ok: false, reason: 'too-heavy' });
      // The item is still safely in the stash — a failed withdraw loses nothing.
      const after = await itemService.browseStash(character._id, DEFAULT_CONTAINER, 'weapon', 'newest', 0);
      expect(after.totalCount).toBe(1);
   });
});
