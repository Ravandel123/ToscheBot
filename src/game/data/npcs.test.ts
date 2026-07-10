import { describe, expect, it } from 'vitest';
import { NPCS, npcCharacterId, npcDefinition, npcIdFromCharacter, type NpcDefinition, type NpcId } from './npcs.js';
import { ITEMS } from './items.js';
import { effectiveAttributes, emptyAllocation } from '../character/attributes.js';
import { BIO_MAX_LENGTH, EPITHET_MAX_LENGTH, NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../character/identity.js';

// Content-integrity checks for the NPC roster (D44): ids/races/homes/items are
// compile-time checked by the catalog types; everything the types can't see
// (lengths, weights vs carry capacity, plausible amounts) fails `npm test`
// here, not inside a live `npm run seed-npcs`.

const entries = Object.entries(NPCS) as [NpcId, NpcDefinition][];

describe('NPCS roster content', () => {
   it('has a cast at all', () => {
      expect(entries.length).toBeGreaterThan(0);
   });

   it('names are unique (case-insensitive) and within identity limits', () => {
      const names = entries.map(([, npc]) => npc.name.toLowerCase());
      expect(new Set(names).size, 'duplicate NPC names').toBe(names.length);

      for (const [id, npc] of entries) {
         expect(npc.name.length, `${id} name length`).toBeGreaterThanOrEqual(NAME_MIN_LENGTH);
         expect(npc.name.length, `${id} name length`).toBeLessThanOrEqual(NAME_MAX_LENGTH);
         expect(npc.epithet.length, `${id} epithet length`).toBeLessThanOrEqual(EPITHET_MAX_LENGTH);
         expect(npc.bio.length, `${id} bio length`).toBeLessThanOrEqual(BIO_MAX_LENGTH);
      }
   });

   it('character ids are customId-safe (no colons — they ride in customIds)', () => {
      for (const [id] of entries)
         expect(npcCharacterId(id), `${id} character id`).not.toContain(':');
   });

   it('starting amounts are sane integers', () => {
      for (const [id, npc] of entries) {
         const coins = npc.startingCoins ?? 0;
         expect(Number.isInteger(coins) && coins >= 0, `${id} startingCoins`).toBe(true);

         for (const grant of npc.startingInventory ?? []) {
            const quantity = grant.quantity ?? 1;
            expect(Number.isInteger(quantity) && quantity >= 1, `${id} grants ${grant.itemId} ×${quantity}`).toBe(true);
         }
      }
   });

   // grantItems enforces carry capacity (strength in kg) at seed time and the
   // seed throws on a refusal — catch the overweight roster entry here instead.
   it('starting inventory fits the racial carry capacity', () => {
      for (const [id, npc] of entries) {
         const capacity = effectiveAttributes(npc.race, emptyAllocation()).strength;
         const weight = (npc.startingInventory ?? [])
            .reduce((sum, grant) => sum + ITEMS[grant.itemId].weightKg * (grant.quantity ?? 1), 0);

         expect(weight, `${id} starting inventory weight`).toBeLessThanOrEqual(capacity);
      }
   });

   // S3 builds the shop on the plaza merchant's inventory + gold pool.
   it('keeps a merchant with a gold pool at the plaza (the S3 shop anchor)', () => {
      const merchant = entries.find(([, npc]) => npc.archetype === 'merchant' && npc.homeLocationId === 'plaza');
      expect(merchant).toBeDefined();
      expect(merchant?.[1].startingCoins ?? 0).toBeGreaterThan(0);
   });
});

describe('npc id resolution', () => {
   it('round-trips a roster id through the character id', () => {
      expect(npcIdFromCharacter(npcCharacterId('plaza_merchant'))).toBe('plaza_merchant');
      expect(npcDefinition(npcCharacterId('plaza_merchant'))?.name).toBe(NPCS.plaza_merchant.name);
   });

   it('resolves player and stale ids to null (D10 rule 3)', () => {
      expect(npcIdFromCharacter(crypto.randomUUID())).toBeNull();
      expect(npcIdFromCharacter(npcCharacterId('retired_npc'))).toBeNull();
      expect(npcDefinition('not-an-npc')).toBeNull();
   });
});
