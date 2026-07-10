import { afterEach, describe, expect, it, vi } from 'vitest';
import playHandler from './play.js';
import inventoryHandler from './inventory.js';
import { accountService } from '../../db/services/accountService.js';
import { characterService } from '../../db/services/characterService.js';
import { inventoryService } from '../../db/services/inventoryService.js';
import { Character } from '../../db/models/character.js';
import { identificationOf, inventoryOf } from '../../game/character/inventory.js';
import { FORAGE_AP_COST } from '../../game/professions/gather.js';
import { fakeButton, fakeClient } from '../../testing/fakeInteraction.js';
import { useTestDb } from '../../testing/memoryDb.js';

// Layer-2 flow tests for S1: the whole forage loop (hub click → AP spend →
// gather → grant → skill credit → hub repaint) and the Examine re-check on the
// inventory card, against the in-memory DB. Randomness is mocked so outcomes
// are deterministic; real Discord behaviour stays a manual smoke test.
useTestDb();

afterEach(() => vi.restoreAllMocks());

const USER = { userId: 'u1', displayName: 'Rav' };

async function readyForager(actionPoints = 5): Promise<string> {
   const client = fakeClient();
   await accountService.getOrCreate(USER.userId, USER.displayName);
   const character = await characterService.create(USER.userId, { name: 'Forager', race: 'canid' });
   await characterService.submitForApproval(character._id);
   await characterService.approve(character._id);
   await characterService.setLocation(character._id, 'riverbank');
   await Character.updateOne({ _id: character._id }, { $set: { 'actionPoints.current': actionPoints } });
   await accountService.setActiveCharacter(USER.userId, USER.displayName, character._id, client.locks);
   return character._id;
}

describe('play:act:forage (the first live gather, S1)', () => {
   it('spends AP, grants the haul, credits the skill path and repaints the hub', async () => {
      const characterId = await readyForager();
      // random 0 everywhere: gather roll 1 (success), identify sweep roll 1
      // (everything recognized), first table entry, lowest quality jitter.
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const { interaction, captured } = fakeButton('play:act:forage', USER);
      await playHandler.handle(fakeClient(), interaction);

      const character = (await characterService.get(characterId))!;
      expect(captured.deferredUpdate).toBe(true);
      expect(captured.updates).toHaveLength(1); // the hub, repainted in place
      expect(character.actionPoints.current).toBe(5 - FORAGE_AP_COST);
      expect(inventoryOf(character).length).toBeGreaterThan(0);
      // Learn-by-doing (D40): the rolled gather banked progress on the path.
      expect(character.progression.skills.foraging?.progress ?? 0).toBeGreaterThan(0);
   });

   it('refuses without enough AP — no roll, no items', async () => {
      const characterId = await readyForager(0);
      const { interaction, captured } = fakeButton('play:act:forage', USER);

      await playHandler.handle(fakeClient(), interaction);

      const character = (await characterService.get(characterId))!;
      expect(inventoryOf(character)).toHaveLength(0);
      expect(character.progression.skills.foraging).toBeUndefined();
      expect(captured.updates).toHaveLength(1); // hub repaint with the refusal banner
   });
});

describe('inventory:examine (the R16 re-check)', () => {
   it('reveals a mystery on a good roll, spending AP and merging into the known stack', async () => {
      const characterId = await readyForager();
      await inventoryService.grantItems(characterId, 'stingweed', 'common', 2);
      const granted = await inventoryService.grantItems(characterId, 'stingweed', 'common', 1, { descriptorId: 'ragged_nettle' });
      if (!granted.ok)
         throw new Error('grant failed');

      vi.spyOn(Math, 'random').mockReturnValue(0); // identify roll 1 — success
      const { interaction, captured } = fakeButton(`inventory:examine:${characterId}:${granted.instanceId}:material.name.0`, USER);
      await inventoryHandler.handle(fakeClient(), interaction);

      const character = (await characterService.get(characterId))!;
      const pack = inventoryOf(character);
      expect(pack).toHaveLength(1); // merged into the identified stack
      expect(pack[0].quantity).toBe(3);
      expect(identificationOf(pack[0])).toBe('identified');
      expect(character.actionPoints.current).toBe(4); // the uniform Examine AP
      expect(character.progression.skills.identify_forage?.progress ?? 0).toBeGreaterThan(0);
      expect(captured.updates).toHaveLength(1);
   });

   it('a failed examine can stamp a confident WRONG label — and the reply never says so', async () => {
      const characterId = await readyForager();
      const granted = await inventoryService.grantItems(characterId, 'ashgill_fungus', 'common', 1, { descriptorId: 'amber_capped' });
      if (!granted.ok)
         throw new Error('grant failed');

      // 1st random: identify roll (0.99 → 100, failure); then mislabel chance
      // (0 → yes) and the lookalike pick (honeycap — the shared look).
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0);
      const { interaction } = fakeButton(`inventory:examine:${characterId}:${granted.instanceId}:material.name.0`, USER);
      await inventoryHandler.handle(fakeClient(), interaction);

      const [stored] = inventoryOf((await characterService.get(characterId))!);
      expect(identificationOf(stored)).toBe('mislabeled');
      expect(stored.apparentItemId).toBe('honeycap_mushroom');
      expect(stored.itemId).toBe('ashgill_fungus'); // the truth, untouched underneath
   });
});
