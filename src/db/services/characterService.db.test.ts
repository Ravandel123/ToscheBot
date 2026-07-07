import { describe, expect, it } from 'vitest';
import { characterService } from './characterService.js';
import { Character } from '../models/character.js';
import { useTestDb } from '../../testing/memoryDb.js';
import { emptyAllocation } from '../../game/character/attributes.js';
import { ATTRIBUTE_BASE } from '../../game/data/attributes.js';

// Layer-1 tests: the real Mongo aggregation-pipeline clamps and status guards
// that a mock can't prove. Every method here writes through the actual queries.
useTestDb();

async function freshCharacter(race: 'canid' | null = null) {
   return characterService.create('owner-1', { name: 'Tester', race });
}

describe('characterService.applyResourceDeltas (clamped delta, D6)', () => {
   it('clamps a big loss to 0, never negative', async () => {
      const character = await freshCharacter();

      const updated = await characterService.applyResourceDeltas(character._id, { health: -999 });

      expect(updated?.resources.health.current).toBe(0);
   });

   it('clamps a big gain to max, never above', async () => {
      const character = await freshCharacter();
      await characterService.applyResourceDeltas(character._id, { health: -5 });

      const updated = await characterService.applyResourceDeltas(character._id, { health: +999 });

      expect(updated?.resources.health.current).toBe(updated?.resources.health.max);
   });

   it('composes two concurrent-style deltas without a lost update', async () => {
      const character = await freshCharacter(); // health starts at 20
      await characterService.applyResourceDeltas(character._id, { health: -3 });
      await characterService.applyResourceDeltas(character._id, { health: -4 });

      const after = await characterService.get(character._id);

      expect(after?.resources.health.current).toBe(13);
   });
});

describe('characterService.applyCurrencyDeltas (clamp >= 0, D6)', () => {
   it('never lets a balance go negative', async () => {
      const character = await freshCharacter();

      const updated = await characterService.applyCurrencyDeltas(character._id, { deltradaCoins: -50 });

      expect(updated?.currencies.deltradaCoins).toBe(0);
   });

   it('adds then subtracts to a correct running balance', async () => {
      const character = await freshCharacter();
      await characterService.applyCurrencyDeltas(character._id, { deltradaCoins: 100 });

      const updated = await characterService.applyCurrencyDeltas(character._id, { deltradaCoins: -30 });

      expect(updated?.currencies.deltradaCoins).toBe(70);
   });
});

describe('characterService.creditSkillUse (learn-by-doing, D34/D40)', () => {
   it('persists weighted progress across the whole path and reports rank-ups', async () => {
      const character = await freshCharacter();

      // The leaf band needs 5 uses/point: 2 + 2 + 1 ranks Bladesmithing up on
      // the third credit.
      await characterService.creditSkillUse(character._id, ['bladesmithing'], 2);
      await characterService.creditSkillUse(character._id, ['bladesmithing'], 2);
      const levelUps = await characterService.creditSkillUse(character._id, ['bladesmithing'], 1);

      expect(levelUps).toContainEqual({ node: 'bladesmithing', from: 0, to: 1 });

      const after = await characterService.get(character._id);
      expect(after?.progression?.skills.bladesmithing).toEqual({ points: 1, progress: 0 });
      // The branch above (10 uses/pt) banked the same 5 uses, no point yet.
      expect(after?.progression?.skills.weaponsmithing).toEqual({ points: 0, progress: 5 });
   });

   it('a non-positive weight writes nothing', async () => {
      const character = await freshCharacter();

      const levelUps = await characterService.creditSkillUse(character._id, ['striking'], 0);

      expect(levelUps).toEqual([]);
      const after = await characterService.get(character._id);
      expect(after?.progression?.skills.striking).toBeUndefined();
   });
});

describe('characterService.spendActionPoints (atomic check-and-spend)', () => {
   it('refuses a spend the character cannot afford (no overdraw)', async () => {
      const character = await freshCharacter(); // AP starts at 0

      const spent = await characterService.spendActionPoints(character._id, 5);

      expect(spent).toBe(false);
      expect((await characterService.get(character._id))?.actionPoints.current).toBe(0);
   });

   it('spends when affordable and debits exactly the cost', async () => {
      const character = await freshCharacter();
      await Character.updateOne({ _id: character._id }, { $set: { 'actionPoints.current': 10 } });

      const spent = await characterService.spendActionPoints(character._id, 4);

      expect(spent).toBe(true);
      expect((await characterService.get(character._id))?.actionPoints.current).toBe(6);
   });
});

describe('characterService.setRace (attribute rebase, D25)', () => {
   it('rebases effective attributes onto the new racial base', async () => {
      const character = await freshCharacter(); // raceless: every attribute = base

      await characterService.setRace(character._id, 'canid');
      const after = await characterService.get(character._id);

      // canid: strength +5, willpower +5, agility -5, charisma -5 on ATTRIBUTE_BASE.
      expect(after?.attributes.strength).toBe(ATTRIBUTE_BASE + 5);
      expect(after?.attributes.agility).toBe(ATTRIBUTE_BASE - 5);
      expect(after?.attributes.dexterity).toBe(ATTRIBUTE_BASE);
   });

   it('preserves the point-buy allocation across a race switch', async () => {
      const character = await freshCharacter();
      const allocation = { ...emptyAllocation(), strength: 10 };
      await characterService.setAttributeAllocation(character._id, null, allocation);

      await characterService.setRace(character._id, 'canid');
      const after = await characterService.get(character._id);

      // base(canid).strength (30) + allocation.strength (10) = 40.
      expect(after?.attributes.strength).toBe(ATTRIBUTE_BASE + 5 + 10);
      expect(after?.attributeAllocation.strength).toBe(10);
   });

   it('recomputes attribute-derived resource maxes and heals a full character to the new cap', async () => {
      const character = await freshCharacter(); // health/stamina start full at the raceless max
      expect(character.resources.health.max).toBe(20);

      await characterService.setRace(character._id, 'canid'); // +5 STR, +5 WIL raise Health/Stamina
      const after = await characterService.get(character._id);

      expect(after?.resources.health.max).toBeGreaterThan(20);
      expect(after?.resources.health.current).toBe(after?.resources.health.max); // stayed full
      expect(after?.resources.stamina.max).toBeGreaterThan(10);
      expect(after?.resources.stamina.current).toBe(after?.resources.stamina.max);
   });

   it('raises the cap without healing an already-damaged character', async () => {
      const character = await freshCharacter();
      await characterService.applyResourceDeltas(character._id, { health: -15 }); // down to 5/20

      await characterService.setRace(character._id, 'canid');
      const after = await characterService.get(character._id);

      expect(after?.resources.health.max).toBeGreaterThan(20);
      expect(after?.resources.health.current).toBe(5); // still wounded, not healed by the switch
   });
});

describe('characterService.setAttributeAllocation (resource recompute)', () => {
   it('raises Health/Stamina max when Constitution points are spent, healing a full character', async () => {
      const character = await freshCharacter();
      const allocation = { ...emptyAllocation(), constitution: 20 };

      await characterService.setAttributeAllocation(character._id, null, allocation);
      const after = await characterService.get(character._id);

      expect(after?.resources.health.max).toBeGreaterThan(20);
      expect(after?.resources.health.current).toBe(after?.resources.health.max);
   });
});

describe('characterService approval lifecycle guards (D13)', () => {
   it('walks draft → pending → approved', async () => {
      const character = await freshCharacter();

      expect(await characterService.submitForApproval(character._id)).toBe(true);
      expect(await characterService.approve(character._id)).toBe(true);
      expect((await characterService.get(character._id))?.approvalStatus).toBe('approved');
   });

   it('refuses to approve a character that is not pending (stale button)', async () => {
      const character = await freshCharacter(); // still a draft

      const approved = await characterService.approve(character._id);

      expect(approved).toBe(false);
      expect((await characterService.get(character._id))?.approvalStatus).toBe('draft');
   });

   it('reject records a reason and allows resubmission from rejected', async () => {
      const character = await freshCharacter();
      await characterService.submitForApproval(character._id);

      expect(await characterService.reject(character._id, 'name too plain')).toBe(true);
      const rejected = await characterService.get(character._id);
      expect(rejected?.approvalStatus).toBe('rejected');
      expect(rejected?.rejectionReason).toBe('name too plain');

      // rejected → pending clears the reason.
      expect(await characterService.submitForApproval(character._id)).toBe(true);
      expect((await characterService.get(character._id))?.rejectionReason).toBeUndefined();
   });
});
