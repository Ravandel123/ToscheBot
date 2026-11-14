// Duel-challenge spam guard (D59). A challenge card pings its target in the
// Spire channel, so two limits keep it civil:
//   * a challenger waits CHALLENGE_COOLDOWN_SECONDS between challenges;
//   * a character with an unanswered challenge cannot be challenged again
//     until they answer it — or until the card is old enough to be ignored.
// In-memory like the locks (one process): a restart forgets the pending set,
// which only re-allows a challenge. 🟡 Both numbers are placeholders.

export const CHALLENGE_COOLDOWN_SECONDS = 30;

/** An unanswered card stops blocking new challenges after this long. */
export const PENDING_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export class PendingChallenges {
   // challenged character id → who is waiting on them, and since when
   private readonly pending = new Map<string, { challengerName: string; postedAt: number }>();

   /** The challenger still waiting on this character's answer, or null. */
   waitingOn(opponentId: string, now: number = Date.now()): string | null {
      const entry = this.pending.get(opponentId);
      if (!entry)
         return null;

      if (now - entry.postedAt >= PENDING_CHALLENGE_TTL_MS) {
         this.pending.delete(opponentId);
         return null;
      }

      return entry.challengerName;
   }

   note(opponentId: string, challengerName: string, now: number = Date.now()): void {
      this.pending.set(opponentId, { challengerName, postedAt: now });
   }

   /** The challenge was answered (accepted, declined or cancelled). */
   clear(opponentId: string): void {
      this.pending.delete(opponentId);
   }
}

export const pendingChallenges = new PendingChallenges();
