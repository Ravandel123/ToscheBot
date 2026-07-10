import { describe, expect, it } from 'vitest';
import { applyNpc, runNpcSeed } from './npcSeed.js';
import { characterService } from '../db/services/characterService.js';
import { useTestDb } from '../testing/memoryDb.js';
import { ATTRIBUTE_BASE } from '../game/data/attributes.js';
import { NPC_IDS, npcCharacterId, type NpcDefinition } from '../game/data/npcs.js';

// The NPC seed end-to-end against the in-memory Mongo (like seed.db.test.ts):
// the create path must mint a fully usable ownerless character, and the update
// path must refresh ONLY the static half — resetting an NPC's mutated state on
// a reseed is the exact bug AUDIT §3.3 warns about, so it's pinned here.

const NPC_ID = 'test_npc';
const CHARACTER_ID = npcCharacterId(NPC_ID);

function definition(overrides: Partial<NpcDefinition> = {}): NpcDefinition {
   return {
      name: 'Testard',
      race: 'canid',
      gender: 'male',
      epithet: 'the Test Subject',
      bio: 'Exists to be seeded.',
      homeLocationId: 'plaza',
      archetype: 'homebody',
      ...overrides,
   };
}

describe('applyNpc', () => {
   useTestDb();

   it('mints an approved, ownerless character at its home with racial-base attributes', async () => {
      const outcome = await applyNpc(NPC_ID, definition());
      expect(outcome).toBe('created');

      const npc = await characterService.get(CHARACTER_ID);
      expect(npc?.ownerId).toBeNull();
      expect(npc?.approvalStatus).toBe('approved');
      expect(npc?.locationId).toBe('plaza');
      expect(npc?.identity.race).toBe('canid');
      expect(npc?.attributes.strength).toBe(ATTRIBUTE_BASE + 5); // canid racial base, no point-buy
   });

   it('grants starting inventory (stacked) and coins on create', async () => {
      await applyNpc(NPC_ID, definition({
         startingInventory: [{ itemId: 'travel_rations', quantity: 3 }, { itemId: 'iron_dagger' }],
         startingCoins: 100,
      }));

      const npc = await characterService.get(CHARACTER_ID);
      expect(npc?.currencies.deltradaCoins).toBe(100);
      expect(npc?.inventory).toHaveLength(2);
      expect(npc?.inventory.find((item) => item.itemId === 'travel_rations')?.quantity).toBe(3);
   });

   it('is idempotent — rerunning the same definition changes nothing', async () => {
      const def = definition({ startingInventory: [{ itemId: 'iron_dagger' }], startingCoins: 50 });
      await applyNpc(NPC_ID, def);

      const second = await applyNpc(NPC_ID, def);

      expect(second).toBe('unchanged');
      const npc = await characterService.get(CHARACTER_ID);
      expect(npc?.inventory).toHaveLength(1);
      expect(npc?.currencies.deltradaCoins).toBe(50);
   });

   it('refreshes the static half on a changed definition (identity, race, home)', async () => {
      await applyNpc(NPC_ID, definition());

      const outcome = await applyNpc(NPC_ID, definition({
         epithet: 'the Reassigned',
         race: 'felis',
         homeLocationId: 'tavern',
      }));

      expect(outcome).toBe('updated');
      const npc = await characterService.get(CHARACTER_ID);
      expect(npc?.identity.epithet).toBe('the Reassigned');
      expect(npc?.locationId).toBe('tavern');
      expect(npc?.identity.race).toBe('felis');
      expect(npc?.attributes.strength).toBe(ATTRIBUTE_BASE - 5); // rebased on the felis base
   });

   it('never resets mutable state on update — pack and coins survive a reseed', async () => {
      await applyNpc(NPC_ID, definition({ startingInventory: [{ itemId: 'iron_dagger' }], startingCoins: 50 }));
      await characterService.applyCurrencyDeltas(CHARACTER_ID, { deltradaCoins: 25 }); // the world happened

      const outcome = await applyNpc(NPC_ID, definition({
         epithet: 'the Refreshed',
         startingInventory: [{ itemId: 'war_maul' }], // create-only: must NOT be granted now
         startingCoins: 9999, // create-only: must NOT be re-applied
      }));

      expect(outcome).toBe('updated');
      const npc = await characterService.get(CHARACTER_ID);
      expect(npc?.currencies.deltradaCoins).toBe(75);
      expect(npc?.inventory).toHaveLength(1);
      expect(npc?.inventory[0]?.itemId).toBe('iron_dagger');
   });

   it('fails loudly when a starting grant cannot land (roster typo, not a silent skip)', async () => {
      const overloaded = definition({ startingInventory: [{ itemId: 'war_maul', quantity: 10 }] }); // 55 kg > canid 30
      await expect(applyNpc(NPC_ID, overloaded)).rejects.toThrow('war_maul');
   });
});

describe('runNpcSeed over the real roster', () => {
   useTestDb();

   it('creates the full cast, then a second run is all unchanged', async () => {
      const first = await runNpcSeed();
      expect(first.created).toBe(NPC_IDS.length);
      expect(first.lines).toHaveLength(NPC_IDS.length);

      const second = await runNpcSeed();
      expect(second).toMatchObject({ created: 0, updated: 0, unchanged: NPC_IDS.length });
   });

   it('seeded NPCs stand in presence lists (D31)', async () => {
      await runNpcSeed();

      const present = await characterService.atLocation('tavern');
      const names = present.map((who) => who.identity.name);

      expect(names).toContain('Serna');
      expect(names).toContain('Marrek');
      expect(present.every((who) => who.ownerId === null)).toBe(true);
   });
});
