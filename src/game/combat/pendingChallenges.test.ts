import { describe, expect, it } from 'vitest';
import { PENDING_CHALLENGE_TTL_MS, PendingChallenges } from './pendingChallenges.js';

describe('PendingChallenges', () => {
   it('blocks a second challenge to the same character until it is answered', () => {
      const pending = new PendingChallenges();
      expect(pending.waitingOn('bruna')).toBeNull();

      pending.note('bruna', 'Kelric', 1000);
      expect(pending.waitingOn('bruna', 2000)).toBe('Kelric');
      expect(pending.waitingOn('someone-else', 2000)).toBeNull();

      pending.clear('bruna');
      expect(pending.waitingOn('bruna', 3000)).toBeNull();
   });

   it('stops blocking once the unanswered card is old', () => {
      const pending = new PendingChallenges();
      pending.note('bruna', 'Kelric', 0);

      expect(pending.waitingOn('bruna', PENDING_CHALLENGE_TTL_MS - 1)).toBe('Kelric');
      expect(pending.waitingOn('bruna', PENDING_CHALLENGE_TTL_MS)).toBeNull();
   });
});
