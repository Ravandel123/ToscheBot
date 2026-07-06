import { describe, expect, it } from 'vitest';
import { applyEntry, runSeed, validateRoster } from './seed.js';
import type { SeedCharacter } from './seed-data.js';
import { characterService } from '../db/services/characterService.js';
import { accountService } from '../db/services/accountService.js';
import { CharacterLockManager } from '../core/locks.js';
import { useTestDb } from '../testing/memoryDb.js';
import { ATTRIBUTE_BASE } from '../game/data/attributes.js';

// The seed's validation is pure (no DB); the replay is exercised end-to-end
// against the in-memory Mongo so a schema/flow change that would corrupt a
// restored character is caught here, not on the live server after a wipe.

const OWNER = '123456789012345678'; // a plausible 18-digit Discord id

function entry(overrides: Partial<SeedCharacter> = {}): SeedCharacter {
   return {
      ownerId: OWNER,
      username: 'Ravandel',
      name: 'Tosch',
      race: 'canid',
      gender: 'male',
      attributes: { strength: 20, agility: 15, willpower: 15 }, // sums to 50
      ...overrides,
   };
}

describe('validateRoster (pure)', () => {
   it('accepts a well-formed entry', () => {
      expect(validateRoster([entry()])).toEqual([]);
   });

   it('rejects a point-buy that does not sum to 50', () => {
      const problems = validateRoster([entry({ attributes: { strength: 10 } })]);
      expect(problems.some((p) => p.includes('sum to exactly 50'))).toBe(true);
   });

   it('rejects an over-cap single attribute', () => {
      const problems = validateRoster([entry({ attributes: { strength: 30, willpower: 20 } })]);
      expect(problems.some((p) => p.includes('attributes.strength'))).toBe(true);
   });

   it('rejects a malformed ownerId', () => {
      const problems = validateRoster([entry({ ownerId: 'not-an-id' })]);
      expect(problems.some((p) => p.includes('ownerId'))).toBe(true);
   });

   it('rejects a duplicate owner+name within the roster', () => {
      const problems = validateRoster([entry(), entry()]);
      expect(problems.some((p) => p.includes('duplicate'))).toBe(true);
   });
});

describe('seed replay (against a real DB)', () => {
   useTestDb();

   it('restores an approved, active character owned by the account', async () => {
      const outcome = await applyEntry(entry(), new CharacterLockManager());
      expect(outcome).toBe('created');

      const active = await accountService.getActiveCharacter(OWNER, 'Ravandel');
      expect(active).not.toBeNull();
      expect(active?.identity.name).toBe('Tosch');
      expect(active?.approvalStatus).toBe('approved');
      expect(active?.ownerId).toBe(OWNER);
   });

   it('applies the point-buy on top of the racial base', async () => {
      await applyEntry(entry(), new CharacterLockManager());
      const active = await accountService.getActiveCharacter(OWNER, 'Ravandel');

      // canid strength base = ATTRIBUTE_BASE + 5, plus the 20 allocated.
      expect(active?.attributes.strength).toBe(ATTRIBUTE_BASE + 5 + 20);
      expect(active?.attributeAllocation.strength).toBe(20);
   });

   it('is idempotent — a rerun skips the existing character', async () => {
      const locks = new CharacterLockManager();
      await applyEntry(entry(), locks);

      const second = await applyEntry(entry(), locks);

      expect(second).toBe('skipped');
      expect(await characterService.countOwned(OWNER)).toBe(1);
   });

   it('runSeed reports created vs skipped across a mixed rerun', async () => {
      const locks = new CharacterLockManager();
      const roster = [entry(), entry({ name: 'Salomeh', race: 'lutren' })];

      const first = await runSeed(roster, locks);
      expect(first.created).toBe(2);

      const second = await runSeed(roster, locks);
      expect(second).toMatchObject({ created: 0, skipped: 2 });
   });
});
