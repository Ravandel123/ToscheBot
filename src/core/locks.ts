import { log } from '../lib/log.js';

type DeferredOp = () => Promise<void>;

/**
 * In-memory per-character mutex + deferred-op queues (single process, single
 * guild — see CLAUDE.md "Concurrency model"). Keyed by Character._id, NOT by
 * Discord user id: resources/AP live on characters, and NPCs (ownerId: null)
 * must be lockable too. "One user, one activity at a time" is enforced
 * separately, by the active-character switch guard in accountService.
 *
 * - `runExclusive` locks a set of characters for the duration of `fn`. Locks
 *   are always acquired in sorted id order, so overlapping requests can never
 *   deadlock (no circular wait).
 * - `deferOrRun` runs an op now if the character is free, or queues it (FIFO).
 *   Queued ops are drained by the holder BEFORE the lock is handed to the next
 *   waiter — so a cron tick aimed at a character who is mid-fight lands right
 *   after the fight and can never interleave with the next critical section.
 *
 * Caveat: neither `fn` nor a deferred op may call `runExclusive` for a
 * character the caller already holds — that self-wait would deadlock. Deferred
 * ops must stay small, self-contained atomic DB writes.
 */
export class CharacterLockManager {
   // Per-character tail of the acquire chain; awaiting it waits for all current holders.
   private readonly tails = new Map<string, Promise<void>>();
   private readonly held = new Set<string>();
   private readonly deferred = new Map<string, DeferredOp[]>();

   isLocked(characterId: string): boolean {
      return this.held.has(characterId);
   }

   lockedIds(): string[] {
      return [...this.held];
   }

   async runExclusive<T>(characterIds: string[], fn: () => Promise<T>): Promise<T> {
      const ids = [...new Set(characterIds)].sort();
      const releases: (() => void)[] = [];

      for (const id of ids) {
         releases.push(await this.acquireOne(id));
         this.held.add(id);
      }

      try {
         return await fn();
      } finally {
         // Drain while still holding: ops queued mid-fn (e.g. a regen tick)
         // must land before the next holder's critical section can start.
         for (const id of ids)
            await this.drain(id);

         // No await between delete and release, so no op can slip into the
         // just-emptied queue before the next holder takes over.
         for (const id of ids)
            this.held.delete(id);

         for (const release of releases)
            release();
      }
   }

   async deferOrRun(characterId: string, op: DeferredOp): Promise<void> {
      if (!this.isLocked(characterId)) {
         await op();
         return;
      }

      const queue = this.deferred.get(characterId) ?? [];
      queue.push(op);
      this.deferred.set(characterId, queue);
   }

   // Grants the caller the lock for `characterId` once all earlier holders
   // release, and returns that holder's release function.
   private acquireOne(characterId: string): Promise<() => void> {
      const previous = this.tails.get(characterId) ?? Promise.resolve();
      let release!: () => void;
      const released = new Promise<void>((resolve) => {
         release = resolve;
      });

      this.tails.set(characterId, previous.then(() => released));
      return previous.then(() => release);
   }

   private async drain(characterId: string): Promise<void> {
      // Loop: an op may queue more work for this character while we await.
      for (let queue = this.deferred.get(characterId); queue?.length; queue = this.deferred.get(characterId)) {
         this.deferred.delete(characterId);

         for (const op of queue)
            try {
               await op();
            } catch (error) {
               log.error(`Deferred op for character ${characterId} failed:`, error);
            }
      }
   }
}
