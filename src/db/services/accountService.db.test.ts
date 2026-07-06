import { describe, expect, it } from 'vitest';
import { accountService } from './accountService.js';
import { characterService } from './characterService.js';
import { activitySessionService } from './activitySessionService.js';
import { CharacterLockManager } from '../../core/locks.js';
import { useTestDb } from '../../testing/memoryDb.js';

// The switch guard (D13/D18) is "one user, one live activity": it must refuse
// while EITHER the current or the target character is busy (in-memory locked OR
// in a durable session). Proving that needs the real lock manager + the real
// session collection together.
useTestDb();

const USER = 'owner-1';

async function twoCharacters() {
   const a = await characterService.create(USER, { name: 'First', race: 'canid' });
   const b = await characterService.create(USER, { name: 'Second', race: 'lutren' });
   return { a: a._id, b: b._id };
}

describe('accountService.setActiveCharacter', () => {
   it('activates a character the user owns', async () => {
      const { a } = await twoCharacters();
      const locks = new CharacterLockManager();

      const result = await accountService.setActiveCharacter(USER, 'Rav', a, locks);

      expect(result).toEqual({ ok: true });
      expect((await accountService.getActiveCharacter(USER, 'Rav'))?._id).toBe(a);
   });

   it("refuses a character the user does not own", async () => {
      const mine = await characterService.create(USER, { name: 'Mine', race: 'canid' });
      const theirs = await characterService.create('someone-else', { name: 'Theirs', race: 'canid' });
      const locks = new CharacterLockManager();
      await accountService.setActiveCharacter(USER, 'Rav', mine._id, locks);

      const result = await accountService.setActiveCharacter(USER, 'Rav', theirs._id, locks);

      expect(result).toEqual({ ok: false, reason: 'not-owned' });
   });

   it('refuses to switch while the CURRENT character is locked mid-action', async () => {
      const { a, b } = await twoCharacters();
      const locks = new CharacterLockManager();
      await accountService.setActiveCharacter(USER, 'Rav', a, locks);

      await locks.runExclusive([a], async () => {
         const result = await accountService.setActiveCharacter(USER, 'Rav', b, locks);
         expect(result).toEqual({ ok: false, reason: 'current-busy' });
      });

      // Once the lock releases, the switch goes through.
      expect(await accountService.setActiveCharacter(USER, 'Rav', b, locks)).toEqual({ ok: true });
   });

   it('refuses to switch to a character busy in a durable session', async () => {
      const { a, b } = await twoCharacters();
      const locks = new CharacterLockManager();
      await accountService.setActiveCharacter(USER, 'Rav', a, locks);
      await activitySessionService.create('challenge', [b]);

      const result = await accountService.setActiveCharacter(USER, 'Rav', b, locks);

      expect(result).toEqual({ ok: false, reason: 'target-busy' });
   });
});
