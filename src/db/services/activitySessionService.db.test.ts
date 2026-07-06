import { describe, expect, it } from 'vitest';
import { activitySessionService } from './activitySessionService.js';
import { useTestDb } from '../../testing/memoryDb.js';

// The step guard is the whole point of the durability layer (D17): it must make
// a repeated `advance` at the same step a no-op (double-click / crash-replay
// safety). Only a real optimistic update proves that — mocks can't.
useTestDb();

describe('activitySessionService.advance (step-guarded, D17)', () => {
   it('advances only when the expected step matches', async () => {
      const session = await activitySessionService.create('challenge', ['char-1'], { hp: 10 });

      const first = await activitySessionService.advance(session._id, 0, { hp: 8 });
      expect(first?.step).toBe(1);
      expect(first?.state).toEqual({ hp: 8 });
   });

   it('ignores a stale/duplicate advance at an already-passed step', async () => {
      const session = await activitySessionService.create('challenge', ['char-1']);
      await activitySessionService.advance(session._id, 0, { moved: true });

      // A double-click / replay still pointing at step 0 must be a safe no-op.
      const duplicate = await activitySessionService.advance(session._id, 0, { moved: 'again' });

      expect(duplicate).toBeNull();
      const current = await activitySessionService.get(session._id);
      expect(current?.step).toBe(1);
      expect(current?.state).toEqual({ moved: true }); // the stale write did not land
   });
});

describe('activitySessionService busy checks (cross-restart lock)', () => {
   it('reports an active session as the participant being busy', async () => {
      await activitySessionService.create('challenge', ['char-1', 'char-2']);

      expect(await activitySessionService.getActiveForParticipant('char-1')).not.toBeNull();
      expect(await activitySessionService.activeParticipantIds()).toEqual(
         expect.arrayContaining(['char-1', 'char-2']),
      );
   });

   it('treats a lapsed session as no longer busy (lazy expiry)', async () => {
      // A negative TTL puts expiresAt in the past — the doc still exists (the TTL
      // sweep is periodic) but must read as expired.
      await activitySessionService.create('challenge', ['char-1'], {}, -1000);

      expect(await activitySessionService.getActiveForParticipant('char-1')).toBeNull();
      expect(await activitySessionService.activeParticipantIds()).not.toContain('char-1');
   });

   it('a completed session frees the participant', async () => {
      const session = await activitySessionService.create('challenge', ['char-1']);
      await activitySessionService.complete(session._id);

      expect(await activitySessionService.getActiveForParticipant('char-1')).toBeNull();
   });
});
