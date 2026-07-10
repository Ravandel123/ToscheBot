import { describe, expect, it } from 'vitest';
import { characterService } from './characterService.js';
import { inventoryService } from './inventoryService.js';
import { identificationOf, inventoryOf } from '../../game/character/inventory.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Layer-1 tests for the identification writes (R16/S1): what a mock can't
// prove — that mystery grants really stay separate instances, that a reveal's
// merge is inc-before-pull with the right quantities, and that the positional
// filter guards degrade a stale instanceId to a null, never a wrong write.
useTestDb();

const VEIL = { descriptorId: 'amber_capped' };

async function freshCharacter() {
   const character = await characterService.create('owner-1', { name: 'Tester', race: 'canid' });
   return character._id;
}

describe('inventoryService.grantItems with a mystery veil', () => {
   it('persists the veil fields on a fresh instance', async () => {
      const id = await freshCharacter();

      const result = await inventoryService.grantItems(id, 'ashgill_fungus', 'common', 1, { ...VEIL, apparentItemId: 'honeycap_mushroom' });
      expect(result.ok).toBe(true);

      const [stored] = inventoryOf((await characterService.get(id))!);
      expect(stored.identified).toBe(false);
      expect(stored.descriptorId).toBe('amber_capped');
      expect(stored.apparentItemId).toBe('honeycap_mushroom');
   });

   it('never merges a mystery into an identified stack, nor an identified grant into a mystery', async () => {
      const id = await freshCharacter();

      await inventoryService.grantItems(id, 'stingweed', 'common', 3);
      await inventoryService.grantItems(id, 'stingweed', 'common', 1, VEIL);
      await inventoryService.grantItems(id, 'stingweed', 'common', 2);

      const pack = inventoryOf((await characterService.get(id))!);
      expect(pack).toHaveLength(2); // the identified stack (3+2) + the mystery
      expect(pack.find((item) => identificationOf(item) === 'identified')?.quantity).toBe(5);
      expect(pack.find((item) => identificationOf(item) === 'unidentified')?.quantity).toBe(1);
   });
});

describe('inventoryService.applyIdentification', () => {
   it('reveal lifts the veil and merges into the identified stack (quantity summed)', async () => {
      const id = await freshCharacter();
      await inventoryService.grantItems(id, 'stingweed', 'common', 3);
      const granted = await inventoryService.grantItems(id, 'stingweed', 'common', 1, VEIL);
      if (!granted.ok)
         throw new Error('grant failed');

      const landedOn = await inventoryService.applyIdentification(id, granted.instanceId, { apply: 'reveal' });

      const pack = inventoryOf((await characterService.get(id))!);
      expect(pack).toHaveLength(1);
      expect(pack[0].quantity).toBe(4);
      expect(landedOn).toBe(pack[0].instanceId);
      expect(identificationOf(pack[0])).toBe('identified');
   });

   it('reveal without a merge target just clears the veil in place', async () => {
      const id = await freshCharacter();
      const granted = await inventoryService.grantItems(id, 'ashgill_fungus', 'common', 1, { ...VEIL, apparentItemId: 'honeycap_mushroom' });
      if (!granted.ok)
         throw new Error('grant failed');

      const landedOn = await inventoryService.applyIdentification(id, granted.instanceId, { apply: 'reveal' });

      const [stored] = inventoryOf((await characterService.get(id))!);
      expect(landedOn).toBe(granted.instanceId);
      expect(stored.identified).toBe(true);
      expect(stored.apparentItemId).toBeUndefined();
      expect(stored.descriptorId).toBeUndefined();
   });

   it('mislabel stamps the confident wrong id and keeps the veil', async () => {
      const id = await freshCharacter();
      const granted = await inventoryService.grantItems(id, 'ashgill_fungus', 'common', 1, VEIL);
      if (!granted.ok)
         throw new Error('grant failed');

      await inventoryService.applyIdentification(id, granted.instanceId, { apply: 'mislabel', apparentItemId: 'honeycap_mushroom' });

      const [stored] = inventoryOf((await characterService.get(id))!);
      expect(identificationOf(stored)).toBe('mislabeled');
      expect(stored.apparentItemId).toBe('honeycap_mushroom');
      expect(stored.descriptorId).toBe('amber_capped'); // the look survives for a later re-roll
   });

   it('degrades a stale instanceId to null (double-click safety)', async () => {
      const id = await freshCharacter();
      expect(await inventoryService.applyIdentification(id, 'no-such-id', { apply: 'reveal' })).toBeNull();
   });
});
