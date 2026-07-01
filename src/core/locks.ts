import { log } from '../lib/log.js';

type DeferredOp = () => Promise<void>;

/**
 * In-memory per-player mutex + deferred-op queues (single process, single
 * guild — see CLAUDE.md "Concurrency model").
 *
 * - `runExclusive` locks a set of players for the duration of `fn`. Locks are
 *   always acquired in sorted id order, so overlapping requests can never
 *   deadlock (no circular wait).
 * - `deferOrRun` runs an op now if the player is free, or queues it (FIFO) to
 *   run the moment the player's lock is released — so a cron tick aimed at a
 *   player who is mid-fight lands right after the fight instead of being lost.
 *
 * Caveat: `fn` must not call `runExclusive` again for a player it already
 * holds — that self-wait would deadlock.
 */
export class PlayerLockManager {
   // Per-user tail of the acquire chain; awaiting it waits for all current holders.
   private readonly tails = new Map<string, Promise<void>>();
   private readonly held = new Set<string>();
   private readonly deferred = new Map<string, DeferredOp[]>();

   isLocked(userId: string): boolean {
      return this.held.has(userId);
   }

   lockedIds(): string[] {
      return [...this.held];
   }

   async runExclusive<T>(userIds: string[], fn: () => Promise<T>): Promise<T> {
      const ids = [...new Set(userIds)].sort();
      const releases: (() => void)[] = [];

      for (const id of ids) {
         releases.push(await this.acquireOne(id));
         this.held.add(id);
      }

      try {
         return await fn();
      } finally {
         for (const id of ids)
            this.held.delete(id);

         for (const release of releases)
            release();

         for (const id of ids)
            void this.drain(id);
      }
   }

   async deferOrRun(userId: string, op: DeferredOp): Promise<void> {
      if (!this.isLocked(userId)) {
         await op();
         return;
      }

      const queue = this.deferred.get(userId) ?? [];
      queue.push(op);
      this.deferred.set(userId, queue);
   }

   // Grants the caller the lock for `userId` once all earlier holders release,
   // and returns that holder's release function.
   private acquireOne(userId: string): Promise<() => void> {
      const previous = this.tails.get(userId) ?? Promise.resolve();
      let release!: () => void;
      const released = new Promise<void>((resolve) => {
         release = resolve;
      });

      this.tails.set(userId, previous.then(() => released));
      return previous.then(() => release);
   }

   private async drain(userId: string): Promise<void> {
      // A queued runExclusive may have re-locked this user; if so, leave the
      // queue for that holder's own release to drain.
      if (this.isLocked(userId))
         return;

      const queue = this.deferred.get(userId);
      if (!queue || queue.length === 0)
         return;

      this.deferred.delete(userId);

      for (const op of queue) {
         try {
            await op();
         } catch (error) {
            log.error(`Deferred op for player ${userId} failed:`, error);
         }
      }
   }
}
